package com.narayanix.dialoo.controller;

import com.narayanix.dialoo.service.AuditService;
import com.narayanix.dialoo.service.CurrentUser;
import com.narayanix.dialoo.service.PermissionService;
import com.narayanix.dialoo.tracking.LiveLocationStore;
import com.narayanix.dialoo.tracking.LocationGuard;
import com.narayanix.dialoo.tracking.MapsUsageMeter;
import com.narayanix.dialoo.tracking.TrackingProperties;
import com.narayanix.dialoo.tracking.TrackingSessionService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Admin live tracking (permission BOOKING_VIEW, same RBAC as the bookings table). Data minimisation: lists show coordinates rounded to
 * 4 decimals (~11 m); the exact current position is only returned by the booking detail call. No location history is exposed.
 * Every first access in a 5-minute window is written to audit_logs.
 */
@RestController @RequestMapping("/api/v1/admin/tracking")
public class AdminTrackingController {
  private static final long AUDIT_WINDOW_MS = 300_000;
  private final JdbcTemplate db; private final CurrentUser me; private final PermissionService perm; private final AuditService audit;
  private final LiveLocationStore store; private final TrackingProperties cfg; private final MapsUsageMeter meter; private final TrackingSessionService sessions;
  private final Map<String, Long> audited = new ConcurrentHashMap<>();

  public AdminTrackingController(JdbcTemplate db, CurrentUser me, PermissionService perm, AuditService audit, LiveLocationStore store, TrackingProperties cfg, MapsUsageMeter meter, TrackingSessionService sessions) {
    this.db = db; this.me = me; this.perm = perm; this.audit = audit; this.store = store; this.cfg = cfg; this.meter = meter; this.sessions = sessions;
  }

  @GetMapping("/summary")
  public Map<String, Object> summary(Authentication a, HttpServletRequest req) {
    long uid = guard(a, req, "summary", "Viewed tracking summary");
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("onlinePartners", db.queryForObject("SELECT COUNT(*) FROM providers WHERE status='APPROVED' AND available_now=TRUE AND deleted_at IS NULL", Long.class));
    m.put("availablePartners", db.queryForObject("SELECT COUNT(*) FROM providers p WHERE p.status='APPROVED' AND p.available_now=TRUE AND p.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.provider_id=p.id AND b.status IN ('ON_THE_WAY','IN_PROGRESS'))", Long.class));
    m.put("activeJourneys", db.queryForObject("SELECT COUNT(*) FROM bookings WHERE status='ON_THE_WAY'", Long.class));
    m.put("activeSessions", db.queryForObject("SELECT COUNT(*) FROM tracking_sessions WHERE status='ACTIVE'", Long.class));
    m.put("arrivedLast2h", db.queryForObject("SELECT COUNT(*) FROM tracking_sessions WHERE status='ARRIVED' AND arrived_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 HOUR)", Long.class));
    long stale = 0;
    for (Map<String, Object> s : db.queryForList("SELECT booking_id, TIMESTAMPDIFF(SECOND,started_at,UTC_TIMESTAMP()) AS run_s FROM tracking_sessions WHERE status='ACTIVE' LIMIT 1000")) {
      LocationGuard.Fix f = store.get(((Number) s.get("booking_id")).longValue());
      long age = f == null ? ((Number) s.get("run_s")).longValue() : (System.currentTimeMillis() - f.serverTs()) / 1000;
      if (age > cfg.getStaleWarningSeconds()) stale++;
    }
    m.put("staleConnections", stale);
    m.put("staleAfterSeconds", cfg.getStaleWarningSeconds());
    m.put("mapsApiUsage", meter.usage(7));
    return m;
  }

  @GetMapping("/sessions")
  public Map<String, Object> sessionList(@RequestParam(required = false) String status, @RequestParam(required = false) String city, @RequestParam(required = false) Long categoryId,
                                         @RequestParam(required = false) Long providerId, @RequestParam(defaultValue = "100") int limit, Authentication a, HttpServletRequest req) {
    guard(a, req, "sessions", "Viewed tracking sessions");
    StringBuilder sb = new StringBuilder("SELECT s.id,s.booking_id,b.booking_code,b.status AS booking_status,s.provider_id,p.business_name,c.name AS category,ci.name AS city,s.status,s.started_at,s.arrived_at,s.ended_at,s.end_reason,s.last_location_at " +
      "FROM tracking_sessions s JOIN bookings b ON b.id=s.booking_id JOIN providers p ON p.id=s.provider_id JOIN categories c ON c.id=b.category_id LEFT JOIN cities ci ON ci.id=b.city_id WHERE 1=1");
    List<Object> args = new ArrayList<>();
    if (status != null && status.matches("ACTIVE|ARRIVED|ENDED")) { sb.append(" AND s.status=?"); args.add(status); }
    if (city != null && !city.isBlank()) { sb.append(" AND LOWER(ci.name)=LOWER(?)"); args.add(city.trim()); }
    if (categoryId != null) { sb.append(" AND b.category_id=?"); args.add(categoryId); }
    if (providerId != null) { sb.append(" AND s.provider_id=?"); args.add(providerId); }
    sb.append(" ORDER BY s.id DESC LIMIT ?"); args.add(Math.min(Math.max(limit, 1), 300));
    List<Map<String, Object>> rows = db.queryForList(sb.toString(), args.toArray());
    long now = System.currentTimeMillis();
    for (Map<String, Object> r : rows) {
      if (!"ACTIVE".equals(r.get("status"))) continue;
      LocationGuard.Fix f = store.get(((Number) r.get("booking_id")).longValue());
      if (f == null) { r.put("connection", "WAITING"); continue; }
      long age = Math.max(0, (now - f.serverTs()) / 1000);
      r.put("connection", age > cfg.getUnavailableSeconds() ? "UNAVAILABLE" : age > cfg.getStaleWarningSeconds() ? "STALE" : "LIVE");
      r.put("ageSeconds", age); r.put("lat", round4(f.lat())); r.put("lng", round4(f.lng()));
    }
    return Map.of("items", rows);
  }

  /** Online partners with a derived state: ON_THE_WAY | BUSY | AVAILABLE | LOCATION_UNAVAILABLE (offline partners are not listed). */
  @GetMapping("/partners")
  public Map<String, Object> partners(@RequestParam(required = false) String city, @RequestParam(required = false) Long categoryId, @RequestParam(required = false) String state,
                                      Authentication a, HttpServletRequest req) {
    guard(a, req, "partners", "Viewed online partners");
    StringBuilder sb = new StringBuilder("SELECT p.id,p.public_id,p.business_name,c.name AS category,ci.name AS city,l.latitude AS llat,l.longitude AS llng," +
      "TIMESTAMPDIFF(SECOND,l.updated_at,UTC_TIMESTAMP()) AS live_age_s," +
      "(SELECT s.booking_id FROM tracking_sessions s WHERE s.provider_id=p.id AND s.status='ACTIVE' LIMIT 1) AS active_booking_id," +
      "EXISTS(SELECT 1 FROM bookings b WHERE b.provider_id=p.id AND b.status IN ('ON_THE_WAY','IN_PROGRESS')) AS busy " +
      "FROM providers p JOIN categories c ON c.id=p.category_id LEFT JOIN cities ci ON ci.id=p.city_id LEFT JOIN provider_live_location l ON l.provider_id=p.id " +
      "WHERE p.status='APPROVED' AND p.available_now=TRUE AND p.deleted_at IS NULL");
    List<Object> args = new ArrayList<>();
    if (city != null && !city.isBlank()) { sb.append(" AND LOWER(ci.name)=LOWER(?)"); args.add(city.trim()); }
    if (categoryId != null) { sb.append(" AND p.category_id=?"); args.add(categoryId); }
    sb.append(" ORDER BY p.id LIMIT 500");
    List<Map<String, Object>> out = new ArrayList<>();
    for (Map<String, Object> r : db.queryForList(sb.toString(), args.toArray())) {
      Double lat = null, lng = null; String st;
      Number ab = (Number) r.get("active_booking_id");
      LocationGuard.Fix f = ab == null ? null : store.get(ab.longValue());
      if (f != null) { lat = f.lat(); lng = f.lng(); }
      else if (r.get("llat") != null && r.get("live_age_s") != null && ((Number) r.get("live_age_s")).longValue() <= cfg.getPartnerLocationFreshSeconds()) { lat = ((Number) r.get("llat")).doubleValue(); lng = ((Number) r.get("llng")).doubleValue(); }
      if (ab != null) st = "ON_THE_WAY"; else if (Boolean.TRUE.equals(toBool(r.get("busy")))) st = "BUSY"; else if (lat != null) st = "AVAILABLE"; else st = "LOCATION_UNAVAILABLE";
      if (state != null && !state.isBlank() && !state.equalsIgnoreCase(st)) continue;
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("id", r.get("id")); m.put("publicId", r.get("public_id")); m.put("name", r.get("business_name")); m.put("category", r.get("category")); m.put("city", r.get("city")); m.put("state", st);
      m.put("lat", lat == null ? null : round4(lat)); m.put("lng", lng == null ? null : round4(lng)); m.put("bookingId", ab == null ? null : ab.longValue());
      out.add(m);
    }
    return Map.of("items", out);
  }

  /** Booking-level detail (exact current position, no history). Audited on every new 5-minute window. */
  @GetMapping("/sessions/{bookingId}")
  public Map<String, Object> detail(@PathVariable long bookingId, Authentication a, HttpServletRequest req) {
    long uid = guard(a, req, "booking:" + bookingId, "Viewed live tracking of booking " + bookingId);
    return sessions.snapshot(bookingId, uid, true);
  }

  private long guard(Authentication a, HttpServletRequest req, String scope, String detail) {
    perm.require(a, "BOOKING_VIEW");
    long uid = me.id(a);
    String key = uid + "|" + scope; long now = System.currentTimeMillis();
    Long last = audited.get(key);
    if (last == null || now - last > AUDIT_WINDOW_MS) {
      audited.put(key, now);
      audit.log(uid, "ADMIN_TRACKING_VIEW", "TRACKING", scope, detail, req.getRemoteAddr());
      if (audited.size() > 5000) audited.values().removeIf(t -> now - t > AUDIT_WINDOW_MS);
    }
    return uid;
  }

  private static double round4(double v) { return Math.round(v * 1e4) / 1e4; }
  private static Boolean toBool(Object o) { return o instanceof Boolean b ? b : o instanceof Number n ? n.intValue() != 0 : Boolean.FALSE; }
}
