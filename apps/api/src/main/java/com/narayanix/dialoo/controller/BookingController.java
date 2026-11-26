package com.narayanix.dialoo.controller;

import com.narayanix.dialoo.service.BookingService;
import com.narayanix.dialoo.service.CurrentUser;
import com.narayanix.dialoo.service.NotificationService;
import com.narayanix.dialoo.service.Sql;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Customer + provider booking APIs (SRS 10.8, 10.12, 10.13). */
@RestController @RequestMapping("/api/v1")
public class BookingController {
  public record BookingCreate(@NotNull Long providerId, Long serviceId, @NotBlank @Size(max = 500) String serviceAddress, @Size(max = 1000) String description,
      String scheduledAt, String urgency, @Size(max = 30) String couponCode, @Size(max = 120) String contactName, @Size(max = 20) String contactPhone, Double latitude, Double longitude) {}
  public record StatusUpdate(@NotBlank String status, @Size(max = 255) String reason, @Pattern(regexp = "([0-9]{4})?") String startCode, @DecimalMin("0.0") BigDecimal finalAmount) {}
  public record ReviewCreate(@NotNull Long bookingId, @Min(1) @Max(5) int rating, @Size(max = 1000) String comment) {}
  public record ReplyReq(@NotBlank @Size(max = 1000) String response) {}
  public record MessageReq(@NotBlank @Size(max = 1000) String body) {}

  private final JdbcTemplate db; private final CurrentUser me; private final BookingService bookings; private final NotificationService notify; private final Sql sql;
  public BookingController(JdbcTemplate db, CurrentUser me, BookingService bookings, NotificationService notify, Sql sql) {
    this.db = db; this.me = me; this.bookings = bookings; this.notify = notify; this.sql = sql;
  }

  @PostMapping("/bookings") public Map<String, Object> create(@Valid @RequestBody BookingCreate r, Authentication a) {
    return bookings.create(me.id(a), new BookingService.CreateRequest(r.providerId(), r.serviceId(), r.serviceAddress(), r.description(), r.scheduledAt(),
      r.urgency(), r.couponCode(), r.contactName(), r.contactPhone(), r.latitude(), r.longitude()));
  }

  @GetMapping("/bookings") public List<Map<String, Object>> mine(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "30") int size, Authentication a) {
    int s = Math.min(Math.max(size, 1), 50), p = Math.max(page, 0);
    return db.queryForList("SELECT b.id,b.booking_code,b.status,b.created_at,b.service_address,b.description,b.total_amount,b.payment_status,b.eta_minutes,b.scheduled_at,b.provider_id," +
      "p.business_name,p.avatar_emoji,c.name AS category,c.icon AS category_icon,s.name AS service_name,(SELECT COUNT(*) FROM reviews r WHERE r.booking_id=b.id) AS reviewed " +
      "FROM bookings b JOIN providers p ON p.id=b.provider_id JOIN categories c ON c.id=b.category_id LEFT JOIN services s ON s.id=b.service_id WHERE b.customer_id=? ORDER BY b.created_at DESC LIMIT ? OFFSET ?", me.id(a), s, p * s);
  }

  /** Tracking screen: details + timeline. The start code is shown only to the customer; the provider phone only after acceptance. */
  @GetMapping("/bookings/{id}") public Map<String, Object> detail(@PathVariable long id, Authentication a) {
    long uid = me.id(a); access(id, uid);
    Map<String, Object> d = new LinkedHashMap<>(bookings.detailFor(id));
    boolean isCustomer = ((Number) d.get("customer_id")).longValue() == uid;
    String status = (String) d.get("status");
    if (!isCustomer) d.remove("start_code");
    else if (BookingService.TERMINAL.contains(status)) d.remove("start_code");
    if (isCustomer && (status.equals("REQUESTED") || BookingService.TERMINAL.contains(status) && !status.equals("COMPLETED"))) d.remove("provider_phone");
    d.put("timeline", bookings.timeline(id));
    d.put("viewerIsCustomer", isCustomer);
    return d;
  }

  @GetMapping("/bookings/{id}/history") public List<Map<String, Object>> history(@PathVariable long id, Authentication a) {
    access(id, me.id(a)); return bookings.timeline(id);
  }

  @PatchMapping("/bookings/{id}/status") public Map<String, Object> status(@PathVariable long id, @Valid @RequestBody StatusUpdate r, Authentication a) {
    long uid = me.id(a);
    return bookings.transition(id, uid, me.actor(a), r.status(), r.reason(), r.startCode(), r.finalAmount());
  }

  @PostMapping("/bookings/{id}/payment-received") public Map<String, Object> paid(@PathVariable long id, Authentication a) {
    return bookings.markPaid(id, me.id(a));
  }

  @GetMapping("/bookings/{id}/messages") public List<Map<String, Object>> messages(@PathVariable long id, Authentication a) {
    long uid = me.id(a); access(id, uid);
    return db.queryForList("SELECT m.id,m.body,m.created_at,m.sender_id,(m.sender_id=?) AS mine,u.full_name AS sender_name FROM booking_messages m JOIN users u ON u.id=m.sender_id WHERE m.booking_id=? ORDER BY m.id DESC LIMIT 100", uid, id);
  }

  @PostMapping("/bookings/{id}/messages") public Map<String, Object> send(@PathVariable long id, @Valid @RequestBody MessageReq r, Authentication a) {
    long uid = me.id(a); access(id, uid);
    Map<String, Object> b = db.queryForMap("SELECT b.booking_code,b.status,b.customer_id,p.user_id AS provider_user_id FROM bookings b JOIN providers p ON p.id=b.provider_id WHERE b.id=?", id);
    if (BookingService.TERMINAL.contains((String) b.get("status")) && !"COMPLETED".equals(b.get("status"))) throw new IllegalArgumentException("Chat is closed for this booking.");
    long mid = sql.insert("INSERT INTO booking_messages(booking_id,sender_id,body) VALUES(?,?,?)", id, uid, r.body().trim());
    boolean senderIsCustomer = ((Number) b.get("customer_id")).longValue() == uid;
    long other = senderIsCustomer ? ((Number) b.get("provider_user_id")).longValue() : ((Number) b.get("customer_id")).longValue();
    notify.toUser(other, "CHAT_MESSAGE", "New message on " + b.get("booking_code"), r.body().trim(), "BOOKING", id, senderIsCustomer ? "PROVIDER" : "USER", "NORMAL");
    return Map.of("id", mid);
  }

  @PostMapping("/reviews") public Map<String, Object> review(@Valid @RequestBody ReviewCreate r, Authentication a) {
    long uid = me.id(a);
    var rows = db.queryForList("SELECT b.provider_id,b.booking_code,p.business_name,p.user_id FROM bookings b JOIN providers p ON p.id=b.provider_id WHERE b.id=? AND b.customer_id=? AND b.status='COMPLETED'", r.bookingId(), uid);
    if (rows.isEmpty()) throw new IllegalArgumentException("Only completed bookings can be reviewed");
    long pid = ((Number) rows.get(0).get("provider_id")).longValue();
    long rid = sql.insert("INSERT INTO reviews(booking_id,customer_id,provider_id,rating,comment) VALUES(?,?,?,?,?)", r.bookingId(), uid, pid, r.rating(), r.comment());
    db.update("UPDATE providers SET average_rating=(SELECT ROUND(AVG(rating),2) FROM reviews WHERE provider_id=? AND status='PUBLISHED'),review_count=(SELECT COUNT(*) FROM reviews WHERE provider_id=? AND status='PUBLISHED') WHERE id=?", pid, pid, pid);
    notify.toUser(((Number) rows.get(0).get("user_id")).longValue(), "REVIEW_RECEIVED", "New " + r.rating() + "-star review", "Booking " + rows.get(0).get("booking_code") + ": " + (r.comment() == null ? "" : r.comment()), "BOOKING", r.bookingId(), "PROVIDER", "NORMAL");
    notify.toStaff("REVIEW_RECEIVED", "New review (" + r.rating() + "★)", rows.get(0).get("business_name") + " received a " + r.rating() + "-star review.", "BOOKING", r.bookingId(), "LOW");
    return Map.of("message", "Review saved", "id", rid);
  }

  @PostMapping("/reviews/{id}/reply") public Map<String, Object> reply(@PathVariable long id, @Valid @RequestBody ReplyReq r, Authentication a) {
    int n = db.update("UPDATE reviews r JOIN providers p ON p.id=r.provider_id SET r.provider_response=?, r.responded_at=UTC_TIMESTAMP() WHERE r.id=? AND p.user_id=?", r.response().trim(), id, me.id(a));
    if (n == 0) throw new IllegalArgumentException("Review not found");
    return Map.of("message", "Reply posted");
  }

  private void access(long bookingId, long uid) {
    Integer n = db.queryForObject("SELECT COUNT(*) FROM bookings b JOIN providers p ON p.id=b.provider_id WHERE b.id=? AND (b.customer_id=? OR p.user_id=?)", Integer.class, bookingId, uid, uid);
    if (n == null || n == 0) throw new IllegalArgumentException("Booking not found or access denied");
  }
}
