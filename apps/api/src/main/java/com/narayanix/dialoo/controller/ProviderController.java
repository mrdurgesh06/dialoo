package com.narayanix.dialoo.controller;

import com.narayanix.dialoo.service.CurrentUser;
import com.narayanix.dialoo.service.NotificationService;
import com.narayanix.dialoo.service.Sql;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Provider application + provider dashboard APIs (SRS 10.4, 10.10, 10.14). */
@RestController @RequestMapping("/api/v1")
public class ProviderController {
  public record Apply(@NotBlank @Size(max = 160) String businessName, @NotNull Long categoryId, @Size(max = 1000) String description,
      @NotBlank @Size(max = 500) String address, @NotBlank @Size(max = 100) String city, @NotNull @DecimalMin("0.0") BigDecimal priceFrom,
      @Min(0) @Max(70) int yearsExperience, List<Long> serviceIds, Boolean emergencyAvailable, @DecimalMin("-90") @DecimalMax("90") Double latitude, @DecimalMin("-180") @DecimalMax("180") Double longitude) {}
  public record ProfileUpdate(@Size(max = 1000) String description, @DecimalMin("0.0") BigDecimal priceFrom, @Size(max = 500) String address, Boolean emergencyAvailable) {}
  public record PlanChoice(@NotNull Long planId) {}

  private final JdbcTemplate db; private final CurrentUser me; private final Sql sql; private final NotificationService notify;
  public ProviderController(JdbcTemplate db, CurrentUser me, Sql sql, NotificationService notify) { this.db = db; this.me = me; this.sql = sql; this.notify = notify; }

  @PostMapping("/providers/apply") public Map<String, Object> apply(@Valid @RequestBody Apply r, Authentication a) {
    long uid = me.id(a);
    if (!db.queryForList("SELECT id FROM providers WHERE user_id=?", Long.class, uid).isEmpty()) throw new IllegalArgumentException("Provider application already exists");
    if (db.queryForList("SELECT id FROM categories WHERE id=? AND active=TRUE", Long.class, r.categoryId()).isEmpty()) throw new IllegalArgumentException("Choose a valid category");
    List<Long> city = db.queryForList("SELECT id FROM cities WHERE LOWER(name)=LOWER(?) LIMIT 1", Long.class, r.city().trim());
    String publicId = "DL-" + java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    long pid = sql.insert("INSERT INTO providers(user_id,business_name,category_id,description,address,city,city_id,price_from,years_experience,status,public_id,emergency_available,verification_level,latitude,longitude) VALUES(?,?,?,?,?,?,?,?,?,'PENDING',?,?,'MOBILE_VERIFIED',?,?)",
      uid, r.businessName().trim(), r.categoryId(), r.description(), r.address().trim(), r.city().trim(), city.isEmpty() ? null : city.get(0), r.priceFrom(), r.yearsExperience(), publicId, Boolean.TRUE.equals(r.emergencyAvailable()), r.latitude(), r.longitude());
    if (r.serviceIds() != null) for (Long sid : r.serviceIds()) {
      db.update("INSERT IGNORE INTO provider_services(provider_id,service_id,price) SELECT ?,s.id,s.base_price FROM services s WHERE s.id=? AND s.category_id=?", pid, sid, r.categoryId());
    }
    db.update("UPDATE users SET role=IF(role='CUSTOMER','PROVIDER',role) WHERE id=?", uid);
    db.update("INSERT INTO provider_verifications(provider_id,verification_type,status) VALUES(?,'IDENTITY','PENDING')", pid);
    Map<String, Object> u = me.row(uid);
    notify.toUser(uid, "PROVIDER_APPLIED", "Application received", "Your provider application is under review. We will notify you after approval.", "PROVIDER", pid, "USER", "NORMAL");
    notify.toStaff("PROVIDER_APPLIED", "New provider application", r.businessName().trim() + " (" + u.get("full_name") + ", " + u.get("phone") + ") applied. Please review.", "PROVIDER", pid, "HIGH");
    return Map.of("message", "Provider application submitted for review", "status", "PENDING", "providerId", pid, "publicId", publicId);
  }

  @GetMapping("/provider/me") public Map<String, Object> mine(Authentication a) {
    var rows = db.queryForList("SELECT p.*,c.name category,c.icon category_icon FROM providers p JOIN categories c ON c.id=p.category_id WHERE p.user_id=?", me.id(a));
    if (rows.isEmpty()) throw new IllegalArgumentException("No provider application exists for this account");
    return rows.get(0);
  }

  @PatchMapping("/provider/me") public Map<String, Object> update(@Valid @RequestBody ProfileUpdate r, Authentication a) {
    int n = db.update("UPDATE providers SET description=COALESCE(?,description), price_from=COALESCE(?,price_from), address=COALESCE(?,address), emergency_available=COALESCE(?,emergency_available), version=version+1 WHERE user_id=?",
      r.description(), r.priceFrom(), r.address(), r.emergencyAvailable(), me.id(a));
    if (n == 0) throw new IllegalArgumentException("Provider profile not found");
    return mine(a);
  }

  @GetMapping("/provider/bookings") public List<Map<String, Object>> bookings(@RequestParam(required = false) String status, Authentication a) {
    String filter = status == null || status.isBlank() ? "" : " AND b.status=?";
    String q = "SELECT b.id,b.booking_code,b.status,b.created_at,b.service_address,b.description,b.total_amount,b.service_amount,b.payment_status,b.urgency,b.scheduled_at,b.expires_at,b.contact_name,b.contact_phone," +
      "u.full_name AS customer_name,c.name AS category,c.icon AS category_icon,s.name AS service_name " +
      "FROM bookings b JOIN providers p ON p.id=b.provider_id JOIN users u ON u.id=b.customer_id JOIN categories c ON c.id=b.category_id LEFT JOIN services s ON s.id=b.service_id " +
      "WHERE p.user_id=?" + filter + " ORDER BY FIELD(b.status,'REQUESTED','ACCEPTED','ON_THE_WAY','IN_PROGRESS','COMPLETED','CANCELLED','REJECTED','EXPIRED'), b.created_at DESC LIMIT 100";
    return filter.isEmpty() ? db.queryForList(q, me.id(a)) : db.queryForList(q, me.id(a), status.toUpperCase());
  }

  @GetMapping("/provider/summary") public Map<String, Object> summary(Authentication a) {
    long uid = me.id(a);
    return db.queryForMap("SELECT p.status AS profile_status, p.available_now, p.average_rating, p.review_count, p.completed_jobs_count, " +
      "(SELECT COUNT(*) FROM bookings b WHERE b.provider_id=p.id AND b.status='REQUESTED') AS new_requests, " +
      "(SELECT COUNT(*) FROM bookings b WHERE b.provider_id=p.id AND b.status IN ('ACCEPTED','ON_THE_WAY','IN_PROGRESS')) AS active_jobs, " +
      "(SELECT COALESCE(SUM(COALESCE(b.final_amount,b.total_amount)),0) FROM bookings b WHERE b.provider_id=p.id AND b.status='COMPLETED' AND DATE(b.completed_at)=UTC_DATE()) AS earnings_today, " +
      "(SELECT COALESCE(SUM(COALESCE(b.final_amount,b.total_amount)),0) FROM bookings b WHERE b.provider_id=p.id AND b.status='COMPLETED') AS earnings_total, " +
      "(SELECT COALESCE(SUM(COALESCE(b.final_amount,b.total_amount)),0) FROM bookings b WHERE b.provider_id=p.id AND b.status='COMPLETED' AND b.payment_status<>'PAID') AS unpaid_total " +
      "FROM providers p WHERE p.user_id=?", uid);
  }

  @PatchMapping("/provider/availability") public Map<String, Object> availability(@RequestBody Map<String, Boolean> body, Authentication a) {
    Boolean available = body.get("availableNow");
    if (available == null) throw new IllegalArgumentException("availableNow is required");
    int n = db.update("UPDATE providers SET available_now=? WHERE user_id=? AND status='APPROVED'", available, me.id(a));
    if (n == 0) throw new IllegalArgumentException("Only approved providers can change availability");
    return Map.of("availableNow", available);
  }

  @GetMapping("/provider/subscription") public Map<String, Object> subscription(Authentication a) {
    var rows = db.queryForList("SELECT ps.id,ps.status,ps.current_period_end,sp.name AS plan,sp.price,sp.features FROM provider_subscriptions ps JOIN subscription_plans sp ON sp.id=ps.plan_id JOIN providers p ON p.id=ps.provider_id WHERE p.user_id=? ORDER BY ps.id DESC LIMIT 1", me.id(a));
    return rows.isEmpty() ? Map.of("status", "NONE") : rows.get(0);
  }

  /** Free plan activates immediately. Paid plans are only activated by a verified gateway webhook (SRS 30) - not wired yet, so we say so honestly. */
  @PostMapping("/provider/subscription") public Map<String, Object> choosePlan(@Valid @RequestBody PlanChoice r, Authentication a) {
    long uid = me.id(a);
    var plan = db.queryForList("SELECT id,name,price FROM subscription_plans WHERE id=? AND active=TRUE", r.planId());
    var prov = db.queryForList("SELECT id FROM providers WHERE user_id=?", Long.class, uid);
    if (plan.isEmpty() || prov.isEmpty()) throw new IllegalArgumentException("Plan or provider profile not found");
    BigDecimal price = (BigDecimal) plan.get(0).get("price");
    if (price.signum() > 0) {
      String ref = "ORD-" + java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();
      sql.insert("INSERT INTO payment_orders(order_reference,payer_id,context_type,context_id,amount) VALUES(?,?,'SUBSCRIPTION',?,?)", ref, uid, r.planId(), price);
      notify.toStaff("SUBSCRIPTION_INTEREST", "Plan upgrade requested", "Provider user #" + uid + " requested plan " + plan.get(0).get("name") + " (order " + ref + ").", "PROVIDER", prov.get(0), "NORMAL");
      return Map.of("status", "PAYMENT_PENDING", "orderReference", ref, "message", "Payment gateway is not configured yet, so the plan stays unchanged until payment is verified.");
    }
    db.update("UPDATE provider_subscriptions SET status='CANCELLED' WHERE provider_id=? AND status IN ('TRIAL','ACTIVE','PAST_DUE')", prov.get(0));
    sql.insert("INSERT INTO provider_subscriptions(provider_id,plan_id,status,current_period_end) VALUES(?,?,'ACTIVE',DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))", prov.get(0), r.planId());
    return Map.of("status", "ACTIVE", "message", "Free plan activated.");
  }
}
