package com.narayanix.dialoo.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Event-driven notifications (SRS 29). A business action calls one method here; this class fans out to the
 * customer, the provider and every active admin/support user, and records a domain event for future queue/push workers.
 */
@Service
public class NotificationService {
  private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
  private final JdbcTemplate db; private final ObjectMapper json;
  public NotificationService(JdbcTemplate db, ObjectMapper json) { this.db = db; this.json = json; }

  public void toUser(Long userId, String type, String title, String body, String entityType, Long entityId, String audience, String priority) {
    if (userId == null) return;
    db.update("INSERT INTO notifications(user_id,type,title,body,entity_type,entity_id,audience,priority) VALUES(?,?,?,?,?,?,?,?)",
      userId, type, clip(title, 160), clip(body, 500), entityType, entityId, audience, priority);
  }

  public void toStaff(String type, String title, String body, String entityType, Long entityId, String priority) {
    List<Long> staff = db.queryForList("SELECT id FROM users WHERE role IN ('ADMIN','SUPER_ADMIN','SUPPORT') AND enabled=TRUE", Long.class);
    for (Long id : staff) toUser(id, type, title, body, entityType, entityId, "ADMIN", priority);
  }

  /** One call = customer + provider + all admins are told about a booking event. */
  public void bookingEvent(long bookingId, String eventType, String customerMsg, String providerMsg, String adminMsg, String title) {
    Map<String, Object> b = db.queryForMap(
      "SELECT b.booking_code, b.customer_id, p.user_id AS provider_user_id FROM bookings b JOIN providers p ON p.id=b.provider_id WHERE b.id=?", bookingId);
    long customerId = ((Number) b.get("customer_id")).longValue();
    long providerUserId = ((Number) b.get("provider_user_id")).longValue();
    String priority = eventType.equals("BOOKING_REQUESTED") || eventType.equals("BOOKING_CANCELLED") ? "HIGH" : "NORMAL";
    toUser(customerId, eventType, title, customerMsg, "BOOKING", bookingId, "USER", priority);
    toUser(providerUserId, eventType, title, providerMsg, "BOOKING", bookingId, "PROVIDER", priority);
    toStaff(eventType, title, adminMsg, "BOOKING", bookingId, priority);
    recordEvent(eventType, "BOOKING", bookingId, Map.of("bookingCode", String.valueOf(b.get("booking_code"))));
  }

  public int broadcast(String audience, String title, String body, long adminId) {
    String where = switch (audience) {
      case "CUSTOMERS" -> "role='CUSTOMER'";
      case "PROVIDERS" -> "role IN ('PROVIDER','BUSINESS')";
      case "ADMINS" -> "role IN ('ADMIN','SUPER_ADMIN','SUPPORT')";
      default -> "1=1";
    };
    int n = db.update("INSERT INTO notifications(user_id,type,title,body,audience,priority) SELECT id,'BROADCAST',?,?,'BROADCAST','NORMAL' FROM users WHERE enabled=TRUE AND " + where,
      clip(title, 160), clip(body, 500));
    db.update("INSERT INTO notification_broadcasts(title,body,audience,recipients,created_by) VALUES(?,?,?,?,?)", clip(title, 160), clip(body, 500), audience, n, adminId);
    return n;
  }

  public void recordEvent(String type, String aggregate, long id, Map<String, Object> payload) {
    try {
      db.update("INSERT INTO domain_events(event_type,aggregate_type,aggregate_id,payload) VALUES(?,?,?,?)", type, aggregate, id, json.writeValueAsString(payload));
    } catch (Exception e) { log.warn("Could not record domain event {}: {}", type, e.getMessage()); }
  }

  private static String clip(String s, int n) { return s == null ? null : s.substring(0, Math.min(n, s.length())); }
}
