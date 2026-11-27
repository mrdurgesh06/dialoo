package com.narayanix.dialoo.tracking;

import com.narayanix.dialoo.service.AuditService;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * Message-level security for STOMP (the handshake itself only checks the Origin header; identity is proven in the CONNECT frame):
 *  - CONNECT   : JWT required ("Authorization: Bearer ..." STOMP header).
 *  - SUBSCRIBE : only /topic/bookings/{id}/tracking for a booking you own (customer or its partner) - staff are audited -,
 *                /user/queue/** for yourself, and /topic/admin/tracking for staff. Everything else is refused.
 *  - SEND      : only /app/tracking/location, only by a partner session, only while the token is still valid, rate limited.
 */
@Component
public class StompAuthInterceptor implements ChannelInterceptor {
  private static final Pattern BOOKING_TOPIC = Pattern.compile("^/topic/bookings/(\\d+)/tracking$");
  private static final int MAX_SENDS = 12; private static final long WINDOW_MS = 10_000;

  private final WsAuthenticator auth; private final JdbcTemplate db; private final AuditService audit;
  private final Map<String, long[]> sendWindow = new ConcurrentHashMap<>();   // sessionId -> [windowStart, count]

  public StompAuthInterceptor(WsAuthenticator auth, JdbcTemplate db, AuditService audit) { this.auth = auth; this.db = db; this.audit = audit; }

  @Override public Message<?> preSend(Message<?> message, MessageChannel channel) {
    StompHeaderAccessor acc = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
    if (acc == null || acc.getCommand() == null) return message;
    StompCommand cmd = acc.getCommand();
    if (cmd == StompCommand.CONNECT || cmd == StompCommand.STOMP) {
      WsUser u = auth.authenticate(acc.getFirstNativeHeader("Authorization"));
      if (u == null) throw new MessageDeliveryException("UNAUTHORIZED");
      acc.setUser(u);
      return message;
    }
    if (cmd == StompCommand.DISCONNECT) { if (acc.getSessionId() != null) sendWindow.remove(acc.getSessionId()); return message; }
    if (!(acc.getUser() instanceof WsUser user)) throw new MessageDeliveryException("UNAUTHORIZED");

    if (cmd == StompCommand.SUBSCRIBE) {
      String dest = acc.getDestination();
      if (dest == null) throw new MessageDeliveryException("FORBIDDEN");
      Matcher m = BOOKING_TOPIC.matcher(dest);
      if (m.matches()) { authorizeBooking(user, Long.parseLong(m.group(1))); return message; }
      if (dest.startsWith("/user/queue/")) return message;
      if (dest.equals("/topic/admin/tracking") && user.isStaff()) return message;
      throw new MessageDeliveryException("FORBIDDEN");
    }
    if (cmd == StompCommand.SEND) {
      if (!"/app/tracking/location".equals(acc.getDestination()) || !"PROVIDER".equals(user.actor())) throw new MessageDeliveryException("FORBIDDEN");
      if (user.expired()) throw new MessageDeliveryException("TOKEN_EXPIRED");
      return withinRate(acc.getSessionId()) ? message : null;   // over the limit: silently dropped
    }
    return message;   // UNSUBSCRIBE, ACK, NACK, BEGIN, COMMIT, ABORT: harmless once authenticated
  }

  private boolean withinRate(String sessionId) {
    if (sessionId == null) return false;
    long now = System.currentTimeMillis();
    long[] w = sendWindow.computeIfAbsent(sessionId, k -> new long[]{now, 0});
    synchronized (w) {
      if (now - w[0] > WINDOW_MS) { w[0] = now; w[1] = 0; }
      return ++w[1] <= MAX_SENDS;
    }
  }

  private void authorizeBooking(WsUser user, long bookingId) {
    List<Map<String, Object>> r = db.queryForList("SELECT b.customer_id, p.user_id AS puid FROM bookings b JOIN providers p ON p.id=b.provider_id WHERE b.id=?", bookingId);
    if (r.isEmpty()) throw new MessageDeliveryException("FORBIDDEN");
    long customer = ((Number) r.get(0).get("customer_id")).longValue(), partner = ((Number) r.get(0).get("puid")).longValue();
    if (user.userId() == customer || user.userId() == partner) return;
    if (user.isStaff()) { audit.log(user.userId(), "ADMIN_TRACKING_SUBSCRIBE", "BOOKING", String.valueOf(bookingId), "Subscribed to live tracking", null); return; }
    throw new MessageDeliveryException("FORBIDDEN");
  }
}
