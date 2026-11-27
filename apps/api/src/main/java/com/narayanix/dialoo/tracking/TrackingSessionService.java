package com.narayanix.dialoo.tracking;

import com.narayanix.dialoo.service.NotificationService;
import com.narayanix.dialoo.service.Sql;
import com.narayanix.dialoo.service.TrackingService;
import jakarta.annotation.PreDestroy;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Owns the whole journey lifecycle for a booking that is ON_THE_WAY:
 *   start / resume session  ->  validated GPS ingest (one pipeline for WebSocket AND the HTTPS fallback)  ->  arrive | stop | end.
 *
 * - The latest fix lives in memory ({@link LiveLocationStore}); the database gets a sampled write every {@code persist-interval-seconds}
 *   and on lifecycle transitions, so a restart loses at most one interval and sessions are rebuilt lazily from tracking_sessions.
 * - Every state change is pushed to /topic/bookings/{id}/tracking (subscription is authorised per booking, see StompAuthInterceptor).
 * - The booking status machine is untouched: ARRIVED is a property of the tracking session; the booking stays ON_THE_WAY until the
 *   partner enters the customer's start code (IN_PROGRESS), exactly as before.
 */
@Service
public class TrackingSessionService {
  private static final Logger log = LoggerFactory.getLogger(TrackingSessionService.class);
  public static final String TOPIC = "/topic/bookings/%d/tracking";

  public record Journey(long sessionId, long bookingId, long providerId, long providerUserId, long customerId, Double destLat, Double destLng, String bookingCode, String providerName) {}

  private static final class Live {
    final Journey j;
    volatile LocationGuard.Fix last;
    volatile long lastAcceptedMs, lastPersistMs;
    volatile boolean approachNotified;
    final AtomicBoolean routing = new AtomicBoolean();
    Live(Journey j) { this.j = j; }
  }

  private final JdbcTemplate db; private final Sql sql; private final LiveLocationStore store; private final TrackingProperties cfg;
  private final TrackingService routes; private final NotificationService notify; private final SimpMessagingTemplate ws;
  private final Map<Long, Live> live = new ConcurrentHashMap<>();
  private final Map<Long, Long> presenceAt = new ConcurrentHashMap<>();
  private final ThreadPoolExecutor pool = new ThreadPoolExecutor(2, 4, 30, TimeUnit.SECONDS, new ArrayBlockingQueue<>(200));

  public TrackingSessionService(JdbcTemplate db, Sql sql, LiveLocationStore store, TrackingProperties cfg, TrackingService routes,
                                NotificationService notify, SimpMessagingTemplate ws) {
    this.db = db; this.sql = sql; this.store = store; this.cfg = cfg; this.routes = routes; this.notify = notify; this.ws = ws;
  }

  @PreDestroy void shutdown() { pool.shutdownNow(); }

  // ------------------------------------------------------------------ lifecycle

  /** Creates the ACTIVE session for the booking, or resumes the existing one. Idempotent. Called when a booking becomes ON_THE_WAY. */
  public long start(long bookingId) {
    Live existing = runtime(bookingId);
    if (existing != null) return existing.j.sessionId();
    Map<String, Object> prev = latestSession(bookingId);
    if (prev != null && "ARRIVED".equals(prev.get("status"))) throw new IllegalArgumentException("You have already arrived for this booking.");
    List<Map<String, Object>> b = db.queryForList("SELECT provider_id FROM bookings WHERE id=?", bookingId);
    if (b.isEmpty()) throw new IllegalArgumentException("Booking not found or access denied");
    long providerId = ((Number) b.get(0).get("provider_id")).longValue();
    try {
      sql.insert("INSERT INTO tracking_sessions(booking_id,provider_id,status,started_at) VALUES(?,?,'ACTIVE',UTC_TIMESTAMP())", bookingId, providerId);
    } catch (DuplicateKeyException e) { /* another request created it first: resume that one */ }
    Live rt = runtime(bookingId);
    if (rt == null) throw new IllegalStateException("Could not start the tracking session");
    afterCommit(() -> broadcast(bookingId, event("started", rt.j.sessionId())));
    return rt.j.sessionId();
  }

  /** Ends the ACTIVE session (booking left ON_THE_WAY, cancelled, reassigned, expired ...). Idempotent; ARRIVED sessions are left alone. */
  public void end(long bookingId, String reason) {
    int n = db.update("UPDATE tracking_sessions SET status='ENDED', ended_at=UTC_TIMESTAMP(), end_reason=? WHERE booking_id=? AND status='ACTIVE'", reason, bookingId);
    db.update("DELETE FROM booking_tracking WHERE booking_id=?", bookingId);   // privacy: the live position lives only during the journey
    afterCommit(() -> {
      forgetRuntime(bookingId);
      if (n > 0) { Map<String, Object> e = event("ended", null); e.put("reason", reason); broadcast(bookingId, e); }
    });
  }

  /** Partner confirms arrival. Needs a fresh, accurate fix inside the arrival radius. Never completes the service. Idempotent. */
  public Map<String, Object> arrive(long bookingId, long userId) {
    Live rt = runtime(bookingId);
    if (rt == null) {
      Map<String, Object> s = latestSession(bookingId);
      if (s != null && "ARRIVED".equals(s.get("status")) && ownsAsProvider(bookingId, userId)) return arrivedResponse(true, null);
      throw new IllegalArgumentException("Booking not found or journey not active");
    }
    if (rt.j.providerUserId() != userId) throw new IllegalArgumentException("Booking not found or access denied");
    LocationGuard.Fix f = rt.last != null ? rt.last : store.get(bookingId);
    Double dist = null;
    if (rt.j.destLat() != null && rt.j.destLng() != null) {
      if (f == null || System.currentTimeMillis() - f.serverTs() > cfg.getUnavailableSeconds() * 1000L) throw new IllegalArgumentException("Waiting for a fresh GPS location. Check that location is on and try again.");
      if (f.accuracy() != null && f.accuracy() > cfg.getArrivalMaxAccuracyMeters()) throw new IllegalArgumentException("GPS accuracy is too low (" + Math.round(f.accuracy()) + " m). Move to an open area and try again.");
      dist = RouteMath.haversine(f.lat(), f.lng(), rt.j.destLat(), rt.j.destLng());
      if (dist > cfg.getArrivalRadiusMeters()) throw new IllegalArgumentException("You are still about " + Math.round(dist) + " m away. You can confirm arrival within " + Math.round(cfg.getArrivalRadiusMeters()) + " m of the address.");
    }
    int n = db.update("UPDATE tracking_sessions SET status='ARRIVED', arrived_at=UTC_TIMESTAMP(), ended_at=UTC_TIMESTAMP(), end_reason='ARRIVED' WHERE id=? AND status='ACTIVE'", rt.j.sessionId());
    if (n == 0) return arrivedResponse(true, dist);
    db.update("DELETE FROM booking_tracking WHERE booking_id=?", bookingId);   // journey tracking stops here
    forgetRuntime(bookingId);
    Map<String, Object> e = event("arrived", rt.j.sessionId());
    broadcast(bookingId, e);
    try {
      notify.toUser(rt.j.customerId(), "PROVIDER_ARRIVED", "Your Dialoo Partner has arrived", rt.j.providerName() + " has reached your address for " + rt.j.bookingCode() + ". Share your 4-digit start code to begin.", "BOOKING", bookingId, "USER", "HIGH");
      notify.recordEvent("BOOKING_PARTNER_ARRIVED", "BOOKING", bookingId, Map.of("bookingCode", String.valueOf(rt.j.bookingCode())));
    } catch (RuntimeException ex) { log.warn("Arrival notification failed: {}", ex.getMessage()); }
    return arrivedResponse(false, dist);
  }

  /** Partner stops sharing manually while the booking stays ON_THE_WAY (e.g. phone problem). Idempotent. */
  public void stop(long bookingId, long userId, boolean staff) {
    Live rt = runtime(bookingId);
    if (rt == null) { if (!staff && !ownsAsProvider(bookingId, userId)) throw new IllegalArgumentException("Booking not found or access denied"); return; }
    if (!staff && rt.j.providerUserId() != userId) throw new IllegalArgumentException("Booking not found or access denied");
    end(bookingId, staff ? "STOPPED_BY_STAFF" : "STOPPED_BY_PARTNER");
  }

  private Map<String, Object> arrivedResponse(boolean already, Double dist) {
    Map<String, Object> m = new LinkedHashMap<>(); m.put("arrived", true); m.put("alreadyArrived", already); m.put("distanceMeters", dist == null ? null : Math.round(dist)); return m;
  }

  // ------------------------------------------------------------------ ingest

  /** The single entry point for GPS fixes (WebSocket and HTTPS fallback). {@code userId} comes from the authenticated principal. */
  public IngestResult ingest(long bookingId, long userId, LocationUpdate u) {
    Live rt = runtime(bookingId);
    if (rt == null || rt.j.providerUserId() != userId) throw new IllegalArgumentException("Booking not found or journey not active");
    if (u.trackingSessionId() != null && u.trackingSessionId() != rt.j.sessionId()) throw new IllegalArgumentException("This tracking session has ended. Restart sharing.");
    if (u.latitude() == null || u.longitude() == null) throw new IllegalArgumentException("Invalid coordinates");
    long now = System.currentTimeMillis();
    synchronized (rt) {
      if (now - rt.lastAcceptedMs < cfg.getMinUpdateGapMillis()) return result("RATE_LIMITED", rt, null);
      LocationGuard.Fix fix = new LocationGuard.Fix(u.latitude(), u.longitude(), u.accuracy(), u.speed(), u.heading(),
        u.timestamp() == null ? now : u.timestamp(), now, u.sequenceNumber() == null ? 0 : u.sequenceNumber());
      LocationGuard.Result v = LocationGuard.check(rt.last, fix, now, cfg);
      switch (v.verdict()) {
        case DUPLICATE -> { return result("DUPLICATE", rt, null); }
        case OUT_OF_ORDER -> { return result("OUT_OF_ORDER", rt, null); }
        case REJECT -> throw new IllegalArgumentException(v.reason());
        default -> { }
      }
      LocationGuard.Fix kept = LocationGuard.smooth(rt.last, fix);
      rt.last = kept; rt.lastAcceptedMs = now;
      store.put(bookingId, kept);
      afterAccept(rt, kept, now);
      Double dist = rt.j.destLat() == null || rt.j.destLng() == null ? null : RouteMath.haversine(kept.lat(), kept.lng(), rt.j.destLat(), rt.j.destLng());
      return result("ACCEPTED", rt, dist);
    }
  }

  private IngestResult result(String r, Live rt, Double dist) {
    Double d = dist;
    if (d == null && rt.last != null && rt.j.destLat() != null) d = RouteMath.haversine(rt.last.lat(), rt.last.lng(), rt.j.destLat(), rt.j.destLng());
    boolean within = d != null && d <= cfg.getArrivalRadiusMeters();
    return new IngestResult(r, rt.j.sessionId(), rt.last == null ? 0L : rt.last.seq(), d == null ? null : (double) Math.round(d), within);
  }

  private void afterAccept(Live rt, LocationGuard.Fix f, long now) {
    long id = rt.j.bookingId();
    Map<String, Object> msg = event("location", rt.j.sessionId());
    msg.put("seq", f.seq()); msg.put("lat", f.lat()); msg.put("lng", f.lng()); msg.put("heading", f.heading()); msg.put("speed", f.speed()); msg.put("ts", now);
    Map<String, Object> pv = progressView(routes.cached(id), f);
    if (pv != null) msg.putAll(pv);
    broadcast(id, msg);

    if (rt.j.destLat() != null && rt.j.destLng() != null) {
      double dist = RouteMath.haversine(f.lat(), f.lng(), rt.j.destLat(), rt.j.destLng());
      if (!rt.approachNotified && dist <= cfg.getApproachingRadiusMeters()) {
        rt.approachNotified = true;
        try {
          db.update("UPDATE tracking_sessions SET approach_notified=TRUE WHERE id=?", rt.j.sessionId());
          notify.toUser(rt.j.customerId(), "PROVIDER_APPROACHING", "Your Dialoo Partner is almost there", rt.j.providerName() + " is about to reach your address (" + rt.j.bookingCode() + ").", "BOOKING", id, "USER", "NORMAL");
        } catch (RuntimeException e) { log.warn("Approach notification failed: {}", e.getMessage()); }
      }
      if (routes.due(id, f.lat(), f.lng(), rt.j.destLat(), rt.j.destLng(), now) && rt.routing.compareAndSet(false, true)) {
        double lat = f.lat(), lng = f.lng(), dLat = rt.j.destLat(), dLng = rt.j.destLng();
        try {
          pool.execute(() -> {
            try {
              TrackingService.Route r = routes.compute(id, lat, lng, dLat, dLng);
              LocationGuard.Fix cur = rt.last != null ? rt.last : f;
              Map<String, Object> m = event("route", rt.j.sessionId());
              m.put("route", routeView(r));
              Map<String, Object> pv2 = progressView(r, cur);
              if (pv2 != null) m.putAll(pv2);
              broadcast(id, m);
            } catch (RuntimeException e) { log.warn("Route refresh failed: {}", e.getMessage()); }
            finally { rt.routing.set(false); }
          });
        } catch (RejectedExecutionException e) { rt.routing.set(false); }
      }
    }
    if (now - rt.lastPersistMs >= cfg.getPersistIntervalSeconds() * 1000L) { rt.lastPersistMs = now; persist(rt, f); }
  }

  private void persist(Live rt, LocationGuard.Fix f) {
    try {
      db.update("INSERT INTO booking_tracking(booking_id,provider_id,latitude,longitude,accuracy_m,speed_mps,heading_deg,updated_at,session_id,seq) VALUES(?,?,?,?,?,?,?,UTC_TIMESTAMP(),?,?) " +
        "ON DUPLICATE KEY UPDATE latitude=VALUES(latitude),longitude=VALUES(longitude),accuracy_m=VALUES(accuracy_m),speed_mps=VALUES(speed_mps),heading_deg=VALUES(heading_deg),updated_at=UTC_TIMESTAMP(),session_id=VALUES(session_id),seq=VALUES(seq)",
        rt.j.bookingId(), rt.j.providerId(), f.lat(), f.lng(), f.accuracy(), f.speed(), f.heading(), rt.j.sessionId(), f.seq());
      db.update("INSERT INTO booking_location_history(session_id,latitude,longitude,accuracy_m,speed_mps,heading_deg,recorded_at) VALUES(?,?,?,?,?,?,UTC_TIMESTAMP())",
        rt.j.sessionId(), f.lat(), f.lng(), f.accuracy(), f.speed(), f.heading());
      db.update("UPDATE tracking_sessions SET last_location_at=UTC_TIMESTAMP(), last_seq=? WHERE id=?", f.seq(), rt.j.sessionId());
    } catch (RuntimeException e) { log.warn("Could not persist tracking state: {}", e.getMessage()); }
  }

  // ------------------------------------------------------------------ read model

  /** Everything the customer / partner / staff tracking screens need. Customers see the partner's position only while the journey is ACTIVE. */
  public Map<String, Object> snapshot(long bookingId, long userId, boolean staff) {
    List<Map<String, Object>> rows = db.queryForList(
      "SELECT b.status,b.latitude AS dlat,b.longitude AS dlng,b.service_address,b.eta_minutes,b.customer_id,p.user_id AS puid,p.business_name,p.avatar_emoji,p.average_rating,p.review_count,p.verified " +
      "FROM bookings b JOIN providers p ON p.id=b.provider_id WHERE b.id=?", bookingId);
    if (rows.isEmpty()) throw new IllegalArgumentException("Booking not found or access denied");
    Map<String, Object> r = rows.get(0);
    boolean isCustomer = ((Number) r.get("customer_id")).longValue() == userId, isProvider = ((Number) r.get("puid")).longValue() == userId;
    if (!isCustomer && !isProvider && !staff) throw new IllegalArgumentException("Booking not found or access denied");

    String status = (String) r.get("status");
    boolean liveBooking = "ON_THE_WAY".equals(status);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("status", status); out.put("live", liveBooking);
    out.put("role", isProvider ? "PROVIDER" : isCustomer ? "CUSTOMER" : "STAFF");
    Map<String, Object> partner = new LinkedHashMap<>();
    partner.put("name", r.get("business_name")); partner.put("avatarEmoji", r.get("avatar_emoji")); partner.put("rating", r.get("average_rating"));
    partner.put("reviewCount", r.get("review_count")); partner.put("verified", Boolean.TRUE.equals(r.get("verified")));
    out.put("partner", partner);
    out.put("config", clientConfig());
    Map<String, Object> sess = latestSession(bookingId);
    String state = sess == null ? "NOT_STARTED" : "ACTIVE".equals(sess.get("status")) ? "ACTIVE" : "ARRIVED".equals(sess.get("status")) ? "ARRIVED" : "ENDED";
    Map<String, Object> j = new LinkedHashMap<>();
    j.put("state", state); j.put("sessionId", sess == null ? null : sess.get("id")); j.put("endReason", sess == null ? null : sess.get("end_reason"));
    j.put("lastSeq", sess == null ? 0 : sess.get("last_seq"));
    out.put("journey", j);
    if (!liveBooking) return out;

    Double dlat = num(r.get("dlat")), dlng = num(r.get("dlng"));
    out.put("fallbackEtaMinutes", r.get("eta_minutes"));
    out.put("destination", dlat == null || dlng == null ? null : Map.of("lat", dlat, "lng", dlng, "address", String.valueOf(r.get("service_address"))));
    if ("ARRIVED".equals(state)) { out.put("arrived", true); out.put("provider", null); out.put("route", null); out.put("etaMinutes", null); return out; }
    if (!"ACTIVE".equals(state)) { out.put("provider", null); out.put("route", null); out.put("etaMinutes", null); return out; }

    LocationGuard.Fix f = currentFix(bookingId);
    if (f == null) { out.put("provider", null); out.put("route", null); out.put("etaMinutes", null); out.put("connection", "WAITING"); return out; }
    long age = Math.max(0, (System.currentTimeMillis() - f.serverTs()) / 1000);
    Map<String, Object> prov = new LinkedHashMap<>();
    prov.put("lat", f.lat()); prov.put("lng", f.lng()); prov.put("heading", f.heading()); prov.put("speed", f.speed());
    prov.put("ageSeconds", age); prov.put("stale", age > cfg.getStaleWarningSeconds()); prov.put("updatedAt", f.serverTs()); prov.put("seq", f.seq());
    out.put("provider", prov);
    out.put("connection", age > cfg.getUnavailableSeconds() ? "UNAVAILABLE" : age > cfg.getStaleWarningSeconds() ? "STALE" : "LIVE");
    TrackingService.Route route = routes.cached(bookingId);
    if (route == null) { out.put("route", null); out.put("etaMinutes", null); }
    else {
      Map<String, Object> pv = progressView(route, f);
      out.put("route", routeView(route));
      out.put("remainingMeters", pv.get("remainingMeters")); out.put("etaSeconds", pv.get("etaSeconds")); out.put("etaMinutes", pv.get("etaMinutes"));
    }
    if (isProvider || staff) {
      Double d = dlat == null || dlng == null ? null : RouteMath.haversine(f.lat(), f.lng(), dlat, dlng);
      out.put("distanceToDestinationMeters", d == null ? null : Math.round(d));
      out.put("withinArrivalRadius", d != null && d <= cfg.getArrivalRadiusMeters());
      out.put("accuracy", f.accuracy());
    }
    return out;
  }

  public Map<String, Object> clientConfig() {
    Map<String, Object> c = new LinkedHashMap<>();
    c.put("gpsIntervalSeconds", cfg.getGpsIntervalSeconds()); c.put("stationaryIntervalSeconds", cfg.getStationaryIntervalSeconds());
    c.put("minDistanceMeters", cfg.getMinDistanceMeters()); c.put("staleWarningSeconds", cfg.getStaleWarningSeconds());
    c.put("unavailableSeconds", cfg.getUnavailableSeconds()); c.put("arrivalRadiusMeters", cfg.getArrivalRadiusMeters());
    c.put("maxAccuracyMeters", cfg.getMaxAccuracyMeters()); c.put("nearbyDefaultRadiusKm", cfg.getNearbyDefaultRadiusKm());
    c.put("nearbyMaxRadiusKm", cfg.getNearbyMaxRadiusKm()); c.put("autocompleteDebounceMillis", cfg.getAutocompleteDebounceMillis());
    c.put("presenceIntervalSeconds", Math.max(cfg.getPartnerPresenceMinGapSeconds(), 30));
    return c;
  }

  private LocationGuard.Fix currentFix(long bookingId) {
    LocationGuard.Fix f = store.get(bookingId);
    if (f != null) return f;
    Live rt = runtime(bookingId);   // restores from booking_tracking after a restart
    return rt == null ? null : rt.last;
  }

  /** remainingMeters / etaSeconds / etaMinutes derived locally from the cached polyline - no Google call. */
  private Map<String, Object> progressView(TrackingService.Route r, LocationGuard.Fix f) {
    if (r == null || f == null) return null;
    RouteMath.Progress p = RouteMath.progress(r.coordinates(), f.lat(), f.lng());
    double remaining = p == null ? r.distanceMeters() : p.remainingMeters() + (p.offRouteMeters() > 50 ? p.offRouteMeters() : 0);
    double speed = r.durationSeconds() > 0 ? r.distanceMeters() / r.durationSeconds() : cfg.getFallbackSpeedKmh() / 3.6;
    speed = Math.max(2.0, Math.min(25.0, speed));
    double eta = remaining / speed;
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("remainingMeters", Math.round(remaining)); m.put("etaSeconds", Math.round(eta)); m.put("etaMinutes", Math.max(1, (int) Math.ceil(eta / 60.0)));
    return m;
  }

  private Map<String, Object> routeView(TrackingService.Route r) {
    Map<String, Object> ro = new LinkedHashMap<>();
    ro.put("coordinates", r.coordinates()); ro.put("distanceMeters", Math.round(r.distanceMeters())); ro.put("durationSeconds", Math.round(r.durationSeconds()));
    ro.put("source", r.source()); ro.put("computedAt", r.computedAt());
    return ro;
  }

  // ------------------------------------------------------------------ partner presence (online, no journey) - used for nearby discovery only

  public void recordPresence(long providerUserId, double lat, double lng, Double accuracy) {
    if (!Double.isFinite(lat) || !Double.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat == 0 && lng == 0)) throw new IllegalArgumentException("Invalid coordinates");
    if (accuracy != null && (accuracy < 0 || accuracy > cfg.getMaxAccuracyMeters())) throw new IllegalArgumentException("Location accuracy is too low");
    List<Map<String, Object>> p = db.queryForList("SELECT id FROM providers WHERE user_id=? AND status='APPROVED' AND available_now=TRUE AND deleted_at IS NULL", providerUserId);
    if (p.isEmpty()) throw new IllegalArgumentException("Go online first to share your location for nearby requests.");
    long pid = ((Number) p.get(0).get("id")).longValue(), now = System.currentTimeMillis();
    Long prev = presenceAt.get(pid);
    if (prev != null && now - prev < cfg.getPartnerPresenceMinGapSeconds() * 1000L) return;   // silently ignored: rate limit
    presenceAt.put(pid, now);
    db.update("INSERT INTO provider_live_location(provider_id,latitude,longitude,accuracy_m,location_at,updated_at) VALUES(?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) " +
      "ON DUPLICATE KEY UPDATE latitude=VALUES(latitude),longitude=VALUES(longitude),accuracy_m=VALUES(accuracy_m),location_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP()", pid, lat, lng, accuracy);
  }

  public void clearPresenceForUser(long providerUserId) {
    db.update("DELETE l FROM provider_live_location l JOIN providers p ON p.id=l.provider_id WHERE p.user_id=?", providerUserId);
  }

  // ------------------------------------------------------------------ helpers

  /** Active runtime for a booking: cached, or rebuilt from the database (restart recovery). Null when there is no ACTIVE session. */
  private Live runtime(long bookingId) {
    Live l = live.get(bookingId);
    if (l != null) return l;
    List<Map<String, Object>> r = db.queryForList(
      "SELECT s.id AS sid,s.last_seq,s.approach_notified,s.provider_id,p.user_id AS puid,p.business_name,b.customer_id,b.latitude AS dlat,b.longitude AS dlng,b.booking_code " +
      "FROM tracking_sessions s JOIN bookings b ON b.id=s.booking_id JOIN providers p ON p.id=s.provider_id WHERE s.booking_id=? AND s.status='ACTIVE'", bookingId);
    if (r.isEmpty()) return null;
    Map<String, Object> m = r.get(0);
    Journey j = new Journey(((Number) m.get("sid")).longValue(), bookingId, ((Number) m.get("provider_id")).longValue(), ((Number) m.get("puid")).longValue(),
      ((Number) m.get("customer_id")).longValue(), num(m.get("dlat")), num(m.get("dlng")), (String) m.get("booking_code"), (String) m.get("business_name"));
    Live fresh = new Live(j);
    fresh.approachNotified = Boolean.TRUE.equals(m.get("approach_notified"));
    List<Map<String, Object>> t = db.queryForList("SELECT latitude,longitude,accuracy_m,speed_mps,heading_deg,seq,TIMESTAMPDIFF(SECOND,updated_at,UTC_TIMESTAMP()) AS age_s FROM booking_tracking WHERE booking_id=?", bookingId);
    if (!t.isEmpty()) {
      Map<String, Object> x = t.get(0);
      long ts = System.currentTimeMillis() - (x.get("age_s") == null ? 0 : ((Number) x.get("age_s")).longValue()) * 1000;
      long seq = Math.max(((Number) x.get("seq")).longValue(), ((Number) m.get("last_seq")).longValue());
      fresh.last = new LocationGuard.Fix(num(x.get("latitude")), num(x.get("longitude")), num(x.get("accuracy_m")), num(x.get("speed_mps")), num(x.get("heading_deg")), ts, ts, seq);
      store.put(bookingId, fresh.last);
    }
    Live prev = live.putIfAbsent(bookingId, fresh);
    return prev != null ? prev : fresh;
  }

  private void forgetRuntime(long bookingId) { live.remove(bookingId); store.remove(bookingId); routes.forget(bookingId); }

  private Map<String, Object> latestSession(long bookingId) {
    List<Map<String, Object>> s = db.queryForList("SELECT id,status,end_reason,last_seq FROM tracking_sessions WHERE booking_id=? ORDER BY id DESC LIMIT 1", bookingId);
    return s.isEmpty() ? null : s.get(0);
  }

  private boolean ownsAsProvider(long bookingId, long userId) {
    return !db.queryForList("SELECT 1 FROM bookings b JOIN providers p ON p.id=b.provider_id WHERE b.id=? AND p.user_id=?", bookingId, userId).isEmpty();
  }

  private Map<String, Object> event(String type, Long sessionId) {
    Map<String, Object> m = new LinkedHashMap<>(); m.put("type", type); if (sessionId != null) m.put("sessionId", sessionId); return m;
  }

  private void broadcast(long bookingId, Map<String, Object> payload) {
    try { ws.convertAndSend(String.format(TOPIC, bookingId), payload); }
    catch (RuntimeException e) { log.debug("WebSocket broadcast failed: {}", e.getMessage()); }
  }

  private static void afterCommit(Runnable r) {
    if (TransactionSynchronizationManager.isSynchronizationActive()) {
      TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() { @Override public void afterCommit() { r.run(); } });
    } else r.run();
  }

  private static Double num(Object o) { return o == null ? null : ((Number) o).doubleValue(); }

  // ------------------------------------------------------------------ maintenance

  /** Safety net: ends sessions whose booking is no longer ON_THE_WAY or that ran longer than session-max-hours. */
  @Scheduled(fixedDelay = 60_000, initialDelay = 40_000)
  public void sweep() {
    try {
      List<Map<String, Object>> stale = db.queryForList(
        "SELECT s.booking_id, b.status FROM tracking_sessions s JOIN bookings b ON b.id=s.booking_id WHERE s.status='ACTIVE' AND (b.status<>'ON_THE_WAY' OR s.started_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)) LIMIT 200", cfg.getSessionMaxHours());
      for (Map<String, Object> s : stale) end(((Number) s.get("booking_id")).longValue(), "ON_THE_WAY".equals(s.get("status")) ? "EXPIRED" : "BOOKING_" + s.get("status"));
      live.keySet().removeIf(id -> db.queryForList("SELECT 1 FROM tracking_sessions WHERE booking_id=? AND status='ACTIVE'", id).isEmpty());
    } catch (RuntimeException e) { log.warn("Tracking sweep failed: {}", e.getMessage()); }
  }

  /** Daily retention: sampled history, stale partner positions, old presence timestamps. */
  @Scheduled(cron = "0 45 3 * * *")
  public void retention() {
    try {
      int total = 0, n;
      do { n = db.update("DELETE FROM booking_location_history WHERE recorded_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY) LIMIT 5000", cfg.getHistoryRetentionDays()); total += n; } while (n >= 5000);
      int pll = db.update("DELETE FROM provider_live_location WHERE updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)");
      presenceAt.values().removeIf(t -> System.currentTimeMillis() - t > 3_600_000);
      if (total > 0 || pll > 0) log.info("Tracking retention removed {} history row(s) and {} stale partner position(s)", total, pll);
    } catch (RuntimeException e) { log.warn("Tracking retention failed: {}", e.getMessage()); }
  }
}
