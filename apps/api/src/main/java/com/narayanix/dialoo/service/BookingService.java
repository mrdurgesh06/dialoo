package com.narayanix.dialoo.service;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Booking state machine + notifications. Every transition is validated on the server (SRS 10.8),
 * applied with an optimistic conditional update, written to booking_status_history, and announced to
 * the customer, the provider and all admins.
 */
@Service
public class BookingService {
  public static final Set<String> TERMINAL = Set.of("COMPLETED", "REJECTED", "CANCELLED", "EXPIRED");
  private static final Map<String, Set<String>> NEXT = Map.of(
    "REQUESTED", Set.of("ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"),
    "ACCEPTED", Set.of("ON_THE_WAY", "CANCELLED"),
    "ON_THE_WAY", Set.of("IN_PROGRESS", "CANCELLED"),
    "IN_PROGRESS", Set.of("COMPLETED"));

  public record CreateRequest(long providerId, Long serviceId, String serviceAddress, String description, String scheduledAt,
                              String urgency, String couponCode, String contactName, String contactPhone, Double latitude, Double longitude) {}

  private final JdbcTemplate db; private final Sql sql; private final NotificationService notify; private final PricingService pricing; private final SettingsService settings; private final TrackingService routes; private final com.narayanix.dialoo.tracking.TrackingSessionService journeys;
  private final SecureRandom random = new SecureRandom();

  public BookingService(JdbcTemplate db, Sql sql, NotificationService notify, PricingService pricing, SettingsService settings, TrackingService routes, com.narayanix.dialoo.tracking.TrackingSessionService journeys) {
    this.routes = routes; this.journeys = journeys; this.db = db; this.sql = sql; this.notify = notify; this.pricing = pricing; this.settings = settings;
  }

  @Transactional
  public Map<String, Object> create(long customerId, CreateRequest r) {
    List<Map<String, Object>> pr = db.queryForList(
      "SELECT p.id, p.user_id, p.category_id, p.city_id, p.business_name, p.available_now, c.eta_minutes FROM providers p JOIN categories c ON c.id=p.category_id WHERE p.id=? AND p.status='APPROVED' AND p.deleted_at IS NULL", r.providerId());
    if (pr.isEmpty()) throw new IllegalArgumentException("Provider not found or not approved");
    Map<String, Object> p = pr.get(0);
    if (((Number) p.get("user_id")).longValue() == customerId) throw new IllegalArgumentException("You cannot book your own service.");
    if (r.serviceAddress() == null || r.serviceAddress().isBlank()) throw new IllegalArgumentException("Service address is required");
    Integer open = db.queryForObject("SELECT COUNT(*) FROM bookings WHERE customer_id=? AND provider_id=? AND status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','IN_PROGRESS')", Integer.class, customerId, r.providerId());
    if (open != null && open >= 2) throw new IllegalArgumentException("You already have active bookings with this provider.");

    PricingService.Quote q = pricing.quote(r.providerId(), r.serviceId(), customerId, r.couponCode());
    Map<String, Object> cu = db.queryForMap("SELECT full_name, phone FROM users WHERE id=?", customerId);
    String urgency = "URGENT".equalsIgnoreCase(r.urgency()) ? "URGENT" : "NORMAL";
    int expiry = settings.getInt("REQUEST_EXPIRY_MINUTES", 30);
    String startCode = String.format("%04d", random.nextInt(10000));
    String tempCode = "T" + Long.toHexString(random.nextLong()).toUpperCase();
    Timestamp scheduled = parseDate(r.scheduledAt());
    long categoryId = ((Number) p.get("category_id")).longValue();
    Long serviceId = r.serviceId();
    String contactName = blank(r.contactName()) ? (String) cu.get("full_name") : r.contactName().trim();
    String contactPhone = blank(r.contactPhone()) ? (String) cu.get("phone") : r.contactPhone().trim();

    long id = sql.insert(
      "INSERT INTO bookings(booking_code,customer_id,provider_id,category_id,service_id,city_id,service_address,description,scheduled_at,urgency,latitude,longitude,contact_name,contact_phone,start_code,eta_minutes,visit_fee,service_amount,tax_amount,discount_amount,total_amount,quoted_amount,coupon_code,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))",
      tempCode, customerId, r.providerId(), categoryId, serviceId, p.get("city_id"), r.serviceAddress().trim(), r.description(), scheduled, urgency,
      r.latitude(), r.longitude(), contactName, contactPhone, startCode, p.get("eta_minutes"), q.visitFee(), q.serviceAmount(), q.taxAmount(), q.discount(), q.total(), q.total(), q.couponCode(), expiry);
    String code = "DLB" + String.format("%07d", id);
    db.update("UPDATE bookings SET booking_code=? WHERE id=?", code, id);
    db.update("INSERT INTO booking_status_history(booking_id,from_status,to_status,changed_by,actor_role,reason) VALUES(?,NULL,'REQUESTED',?,'CUSTOMER','Booking placed')", id, customerId);

    if (q.couponCode() != null) {
      long couponId = db.queryForObject("SELECT id FROM coupons WHERE code=?", Long.class, q.couponCode());
      db.update("INSERT INTO coupon_redemptions(coupon_id,user_id,booking_id,discount_amount) VALUES(?,?,?,?)", couponId, customerId, id, q.discount());
      db.update("UPDATE coupons SET used_count=used_count+1 WHERE id=?", couponId);
    }

    String who = (String) cu.get("full_name"); String biz = (String) p.get("business_name");
    String amt = "₹" + q.total().stripTrailingZeros().toPlainString();
    notify.bookingEvent(id, "BOOKING_REQUESTED", "Your booking " + code + " was sent to " + biz + ". We will tell you as soon as they respond.",
      "New request " + code + " from " + who + " at " + r.serviceAddress().trim() + " (" + amt + "). Please accept or reject quickly.",
      "New booking " + code + ": " + who + " booked " + biz + " (" + amt + ", " + urgency.toLowerCase(Locale.ROOT) + ").",
      "New booking request");
    return detailFor(id);
  }

  @Transactional
  public Map<String, Object> transition(long bookingId, long actorUserId, String actorRole, String to, String reason, String startCode, BigDecimal finalAmount) {
    List<Map<String, Object>> rows = db.queryForList(
      "SELECT b.*, p.user_id AS provider_user_id, p.business_name FROM bookings b JOIN providers p ON p.id=b.provider_id WHERE b.id=?", bookingId);
    if (rows.isEmpty()) throw new IllegalArgumentException("Booking not found or access denied");
    Map<String, Object> b = rows.get(0);
    String from = (String) b.get("status");
    long customerId = ((Number) b.get("customer_id")).longValue();
    long providerUserId = ((Number) b.get("provider_user_id")).longValue();
    boolean isStaff = actorRole.equals("ADMIN") || actorRole.equals("SUPER_ADMIN") || actorRole.equals("SUPPORT");
    boolean isCustomer = actorUserId == customerId, isProvider = actorUserId == providerUserId;
    if (!isCustomer && !isProvider && !isStaff) throw new IllegalArgumentException("Booking not found or access denied");
    to = to.toUpperCase(Locale.ROOT);
    if (!NEXT.getOrDefault(from, Set.of()).contains(to)) throw new IllegalArgumentException("Cannot change booking from " + from + " to " + to);
    if (to.equals("EXPIRED")) throw new IllegalArgumentException("Expiry is automatic.");
    if (to.equals("CANCELLED")) { if (!isCustomer && !isStaff && !isProvider) throw new IllegalArgumentException("You are not allowed to make this change"); }
    else if (!isProvider) throw new IllegalArgumentException("Only the provider can make this change");
    if (to.equals("CANCELLED") && isProvider && from.equals("REQUESTED")) throw new IllegalArgumentException("Use Reject for a new request.");
    if (to.equals("IN_PROGRESS")) {
      if (startCode == null || !startCode.equals(b.get("start_code"))) throw new IllegalArgumentException("Wrong start code. Ask the customer for the 4-digit code shown in their app.");
    }
    if ((to.equals("CANCELLED") || to.equals("REJECTED")) && blank(reason) && isStaff) throw new IllegalArgumentException("Please give a reason.");

    String stamp = switch (to) {
      case "ACCEPTED" -> ", accepted_at=UTC_TIMESTAMP()";
      case "IN_PROGRESS" -> ", started_at=UTC_TIMESTAMP()";
      case "COMPLETED" -> ", completed_at=UTC_TIMESTAMP()";
      case "CANCELLED", "REJECTED" -> ", cancelled_at=UTC_TIMESTAMP(), cancelled_by=" + actorUserId + ", cancel_reason=?";
      default -> "";
    };
    List<Object> args = new ArrayList<>(); args.add(to);
    if (to.equals("CANCELLED") || to.equals("REJECTED")) args.add(blank(reason) ? null : reason.trim());
    if (to.equals("COMPLETED") && finalAmount != null) { stamp += ", final_amount=?"; args.add(finalAmount); }
    args.add(bookingId); args.add(from); args.add(b.get("version"));
    int n = db.update("UPDATE bookings SET status=?" + stamp + ", version=version+1 WHERE id=? AND status=? AND version=?", args.toArray());
    if (n == 0) throw new IllegalArgumentException("This booking was just updated by someone else. Please refresh and try again.");
    db.update("INSERT INTO booking_status_history(booking_id,from_status,to_status,changed_by,actor_role,reason) VALUES(?,?,?,?,?,?)", bookingId, from, to, actorUserId, actorRole, blank(reason) ? null : reason.trim());

    // Journey lifecycle follows the booking status. ON_THE_WAY creates (or resumes) the tracking session; any other status ends it,
    // deletes the stored position and tells subscribers (cancelled / started / completed / reassigned ...). Both calls are idempotent.
    if (to.equals("ON_THE_WAY")) journeys.start(bookingId);
    else journeys.end(bookingId, switch (to) { case "IN_PROGRESS" -> "SERVICE_STARTED"; case "COMPLETED" -> "COMPLETED"; case "CANCELLED", "REJECTED" -> "CANCELLED"; default -> "BOOKING_" + to; });
    String code = (String) b.get("booking_code"); String biz = (String) b.get("business_name");
    if (to.equals("COMPLETED")) completeSideEffects(bookingId, ((Number) b.get("provider_id")).longValue(), finalAmount);

    String[] m = messages(to, code, biz, reason);
    notify.bookingEvent(bookingId, "BOOKING_" + to, m[0], m[1], m[2], m[3]);
    return detailFor(bookingId);
  }

  private String[] messages(String to, String code, String biz, String reason) {
    String why = blank(reason) ? "" : " Reason: " + reason.trim();
    return switch (to) {
      case "ACCEPTED" -> new String[]{biz + " accepted your booking " + code + ". Keep your start code ready.", "You accepted booking " + code + ".", biz + " accepted booking " + code + ".", "Booking accepted"};
      case "REJECTED" -> new String[]{biz + " could not take booking " + code + "." + why + " Please try another provider.", "You rejected booking " + code + ".", biz + " rejected booking " + code + "." + why, "Booking rejected"};
      case "CANCELLED" -> new String[]{"Booking " + code + " was cancelled." + why, "Booking " + code + " was cancelled." + why, "Booking " + code + " (" + biz + ") was cancelled." + why, "Booking cancelled"};
      case "ON_THE_WAY" -> new String[]{biz + " is on the way for booking " + code + ".", "You are marked on the way for " + code + ".", biz + " is on the way for " + code + ".", "Provider on the way"};
      case "IN_PROGRESS" -> new String[]{"Work started for booking " + code + ".", "Work started for " + code + ".", "Work started for " + code + " (" + biz + ").", "Work started"};
      case "COMPLETED" -> new String[]{"Booking " + code + " is complete. Please rate " + biz + ".", "Booking " + code + " completed. Collect payment if due.", "Booking " + code + " completed by " + biz + ".", "Service completed"};
      default -> new String[]{"Booking " + code + " updated.", "Booking " + code + " updated.", "Booking " + code + " updated.", "Booking update"};
    };
  }

  private void completeSideEffects(long bookingId, long providerId, BigDecimal finalAmount) {
    db.update("UPDATE providers SET completed_jobs_count=completed_jobs_count+1 WHERE id=?", providerId);
    db.update("UPDATE bookings SET final_amount=COALESCE(final_amount,total_amount) WHERE id=?", bookingId);
    db.update("INSERT IGNORE INTO invoices(booking_id,invoice_number,labour_amount,travel_amount,tax_amount,discount_amount,total_amount) " +
      "SELECT id, CONCAT('INV-', booking_code), service_amount, visit_fee, tax_amount, discount_amount, COALESCE(final_amount,total_amount) FROM bookings WHERE id=?", bookingId);
  }

  @Transactional
  public Map<String, Object> markPaid(long bookingId, long providerUserId) {
    int n = db.update("UPDATE bookings b JOIN providers p ON p.id=b.provider_id SET b.payment_status='PAID' WHERE b.id=? AND p.user_id=? AND b.status='COMPLETED' AND b.payment_status<>'PAID'", bookingId, providerUserId);
    if (n == 0) throw new IllegalArgumentException("Only completed, unpaid bookings can be marked paid.");
    db.update("UPDATE invoices SET payment_status='PAID' WHERE booking_id=?", bookingId);
    String code = db.queryForObject("SELECT booking_code FROM bookings WHERE id=?", String.class, bookingId);
    notify.bookingEvent(bookingId, "BOOKING_PAID", "Payment for " + code + " recorded. Thank you!", "Payment recorded for " + code + ".", "Payment received for " + code + ".", "Payment received");
    return detailFor(bookingId);
  }

  /** Called by the scheduler: unanswered requests expire so customers are never left waiting. */
  @Transactional
  public int expireStale() {
    List<Map<String, Object>> stale = db.queryForList("SELECT id, version FROM bookings WHERE status='REQUESTED' AND expires_at IS NOT NULL AND expires_at<UTC_TIMESTAMP() LIMIT 100");
    int count = 0;
    for (Map<String, Object> s : stale) {
      long id = ((Number) s.get("id")).longValue();
      int n = db.update("UPDATE bookings SET status='EXPIRED', cancelled_at=UTC_TIMESTAMP(), cancel_reason='No response from provider', version=version+1 WHERE id=? AND status='REQUESTED' AND version=?", id, s.get("version"));
      if (n == 0) continue;
      count++;
      Long sys = db.queryForList("SELECT customer_id FROM bookings WHERE id=?", Long.class, id).get(0);
      db.update("INSERT INTO booking_status_history(booking_id,from_status,to_status,changed_by,actor_role,reason) VALUES(?,'REQUESTED','EXPIRED',?,'SYSTEM','No response from provider')", id, sys);
      String code = db.queryForObject("SELECT booking_code FROM bookings WHERE id=?", String.class, id);
      notify.bookingEvent(id, "BOOKING_EXPIRED", "Booking " + code + " expired because the provider did not respond. Please try another provider.", "Request " + code + " expired - you did not respond in time.", "Booking " + code + " expired with no provider response.", "Booking expired");
    }
    return count;
  }

  public Map<String, Object> detailFor(long bookingId) {
    Map<String, Object> b = db.queryForMap(
      "SELECT b.*, p.business_name, p.public_id AS provider_public_id, p.avatar_emoji, p.average_rating, pu.phone AS provider_phone, pu.full_name AS provider_name, c.name AS category, c.icon AS category_icon, s.name AS service_name, " +
      "(SELECT COUNT(*) FROM reviews r WHERE r.booking_id=b.id) AS reviewed " +
      "FROM bookings b JOIN providers p ON p.id=b.provider_id JOIN users pu ON pu.id=p.user_id JOIN categories c ON c.id=b.category_id LEFT JOIN services s ON s.id=b.service_id WHERE b.id=?", bookingId);
    return new java.util.LinkedHashMap<>(b);
  }

  public List<Map<String, Object>> timeline(long bookingId) {
    return db.queryForList("SELECT h.from_status, h.to_status, h.actor_role, h.reason, h.created_at FROM booking_status_history h WHERE h.booking_id=? ORDER BY h.id", bookingId);
  }

  private static Timestamp parseDate(String s) {
    if (s == null || s.isBlank()) return null;
    try { return Timestamp.valueOf(LocalDateTime.parse(s)); }
    catch (Exception e) { throw new IllegalArgumentException("scheduledAt must use ISO local date-time, e.g. 2026-11-01T10:00:00"); }
  }
  private static boolean blank(String s) { return s == null || s.isBlank(); }
}
