package com.narayanix.dialoo.controller;

import com.narayanix.dialoo.service.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Admin console API. Every route needs a live 2-step admin session (see SecurityConfig) AND a fine-grained
 * permission from role_permissions. Every mutation is written to audit_logs and, where relevant, notified.
 */
@RestController @RequestMapping("/api/v1/admin")
public class AdminController {
  public record ProviderDecision(@NotBlank String status, @Size(max = 255) String note, String verificationLevel) {}
  public record StaffReq(@NotBlank @Size(max = 120) String fullName, @NotBlank @Pattern(regexp = "[6-9][0-9]{9}") String phone, @Size(max = 190) @Pattern(regexp = "^$|^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$") String email, @NotBlank @Pattern(regexp = "SUPPORT|ADMIN|SUPER_ADMIN") String role) {}
  public record CancelReq(@NotBlank @Size(max = 255) String reason) {}
  public record EnabledReq(@NotNull Boolean enabled) {}
  public record RoleReq(@NotBlank @Pattern(regexp = "CUSTOMER|PROVIDER|SUPPORT|ADMIN|SUPER_ADMIN") String role) {}
  public record CategoryReq(@NotBlank @Size(max = 100) String name, @Size(max = 20) String icon, @Size(max = 255) String description, Integer displayOrder, Boolean featured, Boolean active,
      @Min(5) @Max(1440) Integer etaMinutes, @DecimalMin("0.0") BigDecimal baseVisitFee) {}
  public record ServiceReq(@NotNull Long categoryId, @NotBlank @Size(max = 140) String name, @DecimalMin("0.0") BigDecimal basePrice, @Min(5) Integer durationMinutes, Boolean active) {}
  public record BannerReq(@NotBlank @Size(max = 120) String title, @Size(max = 200) String subtitle, @Size(max = 8) String emoji, @Size(max = 80) String gradient, @Size(max = 40) String ctaLabel,
      @Size(max = 120) String targetCategorySlug, @Size(max = 30) String couponCode, Integer displayOrder, Boolean active) {}
  public record CouponReq(@NotBlank @Pattern(regexp = "[A-Za-z0-9]{3,30}") String code, @Size(max = 200) String description, @Pattern(regexp = "FLAT|PERCENT") String discountType,
      @NotNull @DecimalMin("0.01") BigDecimal discountValue, BigDecimal maxDiscount, BigDecimal minOrder, Boolean firstBookingOnly, Integer usageLimit, Integer perUserLimit, Integer validDays, Boolean active) {}
  public record BroadcastReq(@NotBlank @Size(max = 160) String title, @NotBlank @Size(max = 500) String body, @Pattern(regexp = "ALL|CUSTOMERS|PROVIDERS|ADMINS") String audience) {}
  public record FlagReq(@NotNull Boolean enabled) {}
  public record SettingReq(@NotBlank @Size(max = 255) String value) {}
  public record PlanReq(@NotNull @DecimalMin("0.0") BigDecimal price, @Size(max = 1000) String features, Boolean active) {}

  private final JdbcTemplate db; private final CurrentUser me; private final PermissionService perm; private final AuditService audit;
  private final NotificationService notify; private final BookingService bookings; private final Sql sql; private final TokenService tokens;
  private final org.springframework.security.crypto.password.PasswordEncoder encoder;

  public AdminController(JdbcTemplate db, CurrentUser me, PermissionService perm, AuditService audit, NotificationService notify, BookingService bookings, Sql sql, TokenService tokens, org.springframework.security.crypto.password.PasswordEncoder encoder) {
    this.encoder = encoder; this.db = db; this.me = me; this.perm = perm; this.audit = audit; this.notify = notify; this.bookings = bookings; this.sql = sql; this.tokens = tokens;
  }

  private static String like(String q) { return "%" + q.trim().replace("%", "").replace("_", "") + "%"; }
  private static int size(int s) { return Math.min(Math.max(s, 1), 100); }

  // ---------------- Dashboard ----------------
  @GetMapping("/dashboard") public Map<String, Object> dashboard(Authentication a) {
    perm.require(a, "DASHBOARD_VIEW");
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("users", db.queryForObject("SELECT COUNT(*) FROM users WHERE role IN ('CUSTOMER','PROVIDER','BUSINESS')", Long.class));
    out.put("newUsers7d", db.queryForObject("SELECT COUNT(*) FROM users WHERE role IN ('CUSTOMER','PROVIDER','BUSINESS') AND created_at>DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)", Long.class));
    out.put("providersPending", db.queryForObject("SELECT COUNT(*) FROM providers WHERE status='PENDING'", Long.class));
    out.put("providersApproved", db.queryForObject("SELECT COUNT(*) FROM providers WHERE status='APPROVED'", Long.class));
    out.put("providersOnline", db.queryForObject("SELECT COUNT(*) FROM providers WHERE status='APPROVED' AND available_now=TRUE", Long.class));
    out.put("bookings", db.queryForObject("SELECT COUNT(*) FROM bookings", Long.class));
    out.put("bookingsToday", db.queryForObject("SELECT COUNT(*) FROM bookings WHERE DATE(created_at)=UTC_DATE()", Long.class));
    out.put("bookingsNew", db.queryForObject("SELECT COUNT(*) FROM bookings WHERE status='REQUESTED'", Long.class));
    out.put("bookingsActive", db.queryForObject("SELECT COUNT(*) FROM bookings WHERE status IN ('ACCEPTED','ON_THE_WAY','IN_PROGRESS')", Long.class));
    out.put("gmvTotal", db.queryForObject("SELECT COALESCE(SUM(COALESCE(final_amount,total_amount)),0) FROM bookings WHERE status='COMPLETED'", BigDecimal.class));
    out.put("gmvToday", db.queryForObject("SELECT COALESCE(SUM(COALESCE(final_amount,total_amount)),0) FROM bookings WHERE status='COMPLETED' AND DATE(completed_at)=UTC_DATE()", BigDecimal.class));
    out.put("emergenciesOpen", db.queryForObject("SELECT COUNT(*) FROM emergency_requests WHERE status NOT IN ('CLOSED','CANCELLED','COMPLETED')", Long.class));
    out.put("projectsOpen", db.queryForObject("SELECT COUNT(*) FROM projects WHERE status='OPEN'", Long.class));
    out.put("statusBreakdown", db.queryForList("SELECT status, COUNT(*) AS n FROM bookings GROUP BY status ORDER BY n DESC"));
    out.put("daily", db.queryForList("SELECT day, bookings, completed, gmv FROM v_daily_booking_stats WHERE day>=DATE_SUB(UTC_DATE(), INTERVAL 13 DAY) ORDER BY day"));
    out.put("topProviders", db.queryForList("SELECT p.id,p.business_name,p.average_rating,p.completed_jobs_count, COUNT(b.id) AS bookings FROM providers p LEFT JOIN bookings b ON b.provider_id=p.id AND b.created_at>DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY) WHERE p.status='APPROVED' GROUP BY p.id ORDER BY bookings DESC, p.completed_jobs_count DESC LIMIT 5"));
    out.put("topCategories", db.queryForList("SELECT c.name,c.icon, COUNT(b.id) AS bookings FROM categories c LEFT JOIN bookings b ON b.category_id=c.id GROUP BY c.id ORDER BY bookings DESC LIMIT 5"));
    return out;
  }

  // ---------------- Bookings ----------------
  @GetMapping("/bookings") public Map<String, Object> bookings(@RequestParam(required = false) String status, @RequestParam(required = false) String q,
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size, Authentication a) {
    perm.require(a, "BOOKING_VIEW");
    StringBuilder w = new StringBuilder(" WHERE 1=1"); List<Object> args = new ArrayList<>();
    if (status != null && !status.isBlank()) { w.append(" AND status=?"); args.add(status.toUpperCase()); }
    if (q != null && !q.isBlank()) { w.append(" AND (booking_code LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR business_name LIKE ?)"); String l = like(q); args.add(l); args.add(l); args.add(l); args.add(l); }
    Long total = db.queryForObject("SELECT COUNT(*) FROM v_admin_bookings" + w, Long.class, args.toArray());
    int s = size(size), p = Math.max(page, 0); args.add(s); args.add(p * s);
    return Map.of("items", db.queryForList("SELECT * FROM v_admin_bookings" + w + " ORDER BY id DESC LIMIT ? OFFSET ?", args.toArray()), "total", total == null ? 0 : total, "page", p, "size", s);
  }

  @GetMapping("/bookings/{id}") public Map<String, Object> bookingDetail(@PathVariable long id, Authentication a) {
    perm.require(a, "BOOKING_VIEW");
    Map<String, Object> d = new LinkedHashMap<>(bookings.detailFor(id));
    d.remove("start_code");
    d.put("customer", db.queryForMap("SELECT u.full_name,u.phone,u.email FROM users u JOIN bookings b ON b.customer_id=u.id WHERE b.id=?", id));
    d.put("timeline", bookings.timeline(id));
    return d;
  }

  @PostMapping("/bookings/{id}/cancel") public Map<String, Object> cancel(@PathVariable long id, @Valid @RequestBody CancelReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "BOOKING_MANAGE");
    long uid = me.id(a);
    Map<String, Object> out = bookings.transition(id, uid, me.role(a), "CANCELLED", "Cancelled by Dialoo support: " + r.reason().trim(), null, null);
    audit.log(uid, "BOOKING_ADMIN_CANCEL", "BOOKING", String.valueOf(id), r.reason(), req.getRemoteAddr());
    return out;
  }

  // ---------------- Providers ----------------
  @GetMapping("/providers") public Map<String, Object> providers(@RequestParam(required = false) String status, @RequestParam(required = false) String q,
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size, Authentication a) {
    perm.require(a, "PROVIDER_VIEW");
    StringBuilder w = new StringBuilder(" WHERE p.deleted_at IS NULL"); List<Object> args = new ArrayList<>();
    if (status != null && !status.isBlank()) { w.append(" AND p.status=?"); args.add(status.toUpperCase()); }
    if (q != null && !q.isBlank()) { w.append(" AND (p.business_name LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ? OR p.public_id LIKE ?)"); String l = like(q); args.add(l); args.add(l); args.add(l); args.add(l); }
    String from = " FROM providers p JOIN users u ON u.id=p.user_id JOIN categories c ON c.id=p.category_id" + w;
    Long total = db.queryForObject("SELECT COUNT(*)" + from, Long.class, args.toArray());
    int s = size(size), pg = Math.max(page, 0); args.add(s); args.add(pg * s);
    return Map.of("items", db.queryForList("SELECT p.id,p.public_id,p.business_name,p.description,p.address,p.city,p.status,p.verified,p.verification_level,p.available_now,p.average_rating,p.review_count,p.completed_jobs_count,p.years_experience,p.price_from,p.created_at,u.full_name,u.phone,c.name AS category" + from + " ORDER BY FIELD(p.status,'PENDING','APPROVED','SUSPENDED','REJECTED'), p.created_at DESC LIMIT ? OFFSET ?", args.toArray()),
      "total", total == null ? 0 : total, "page", pg, "size", s);
  }

  @PatchMapping("/providers/{id}/status") public Map<String, Object> providerStatus(@PathVariable long id, @Valid @RequestBody ProviderDecision r, Authentication a, HttpServletRequest req) {
    perm.require(a, "PROVIDER_APPROVE");
    String s = r.status().toUpperCase(Locale.ROOT);
    if (!Set.of("APPROVED", "REJECTED", "SUSPENDED").contains(s)) throw new IllegalArgumentException("status must be APPROVED, REJECTED or SUSPENDED");
    String level = r.verificationLevel() == null ? (s.equals("APPROVED") ? "DIALOO_VERIFIED" : null) : r.verificationLevel();
    if (level != null && !Set.of("NONE", "MOBILE_VERIFIED", "IDENTITY_VERIFIED", "PROFESSION_VERIFIED", "DIALOO_VERIFIED").contains(level)) throw new IllegalArgumentException("Invalid verification level");
    var rows = db.queryForList("SELECT user_id,business_name,status FROM providers WHERE id=?", id);
    if (rows.isEmpty()) throw new IllegalArgumentException("Provider not found");
    int n = db.update("UPDATE providers SET status=?, verified=?, verification_level=COALESCE(?,verification_level), available_now=IF(?='APPROVED',available_now,FALSE), version=version+1 WHERE id=?", s, s.equals("APPROVED"), level, s, id);
    if (n == 0) throw new IllegalArgumentException("Provider not found");
    long uid = me.id(a);
    db.update("UPDATE provider_verifications SET status=?, reviewed_by=?, reviewed_at=UTC_TIMESTAMP(), notes=? WHERE provider_id=? AND status='PENDING'", s.equals("APPROVED") ? "APPROVED" : "REJECTED", uid, r.note(), id);
    audit.log(uid, "PROVIDER_" + s, "PROVIDER", String.valueOf(id), r.note(), req.getRemoteAddr());
    String msg = switch (s) {
      case "APPROVED" -> "Congratulations! " + rows.get(0).get("business_name") + " is approved. You can now receive bookings.";
      case "REJECTED" -> "Your provider application was not approved." + (r.note() == null ? "" : " Reason: " + r.note());
      default -> "Your provider profile has been suspended." + (r.note() == null ? "" : " Reason: " + r.note());
    };
    notify.toUser(((Number) rows.get(0).get("user_id")).longValue(), "PROVIDER_" + s, "Provider profile " + s.toLowerCase(Locale.ROOT), msg, "PROVIDER", id, "PROVIDER", "HIGH");
    return Map.of("id", id, "status", s);
  }

  // ---------------- Users ----------------
  @GetMapping("/users") public Map<String, Object> users(@RequestParam(required = false) String role, @RequestParam(required = false) String q,
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size, Authentication a) {
    perm.require(a, "USER_VIEW");
    StringBuilder w = new StringBuilder(" WHERE 1=1"); List<Object> args = new ArrayList<>();
    if (role != null && !role.isBlank()) { w.append(" AND role=?"); args.add(role.toUpperCase()); }
    if (q != null && !q.isBlank()) { w.append(" AND (full_name LIKE ? OR phone LIKE ? OR email LIKE ?)"); String l = like(q); args.add(l); args.add(l); args.add(l); }
    Long total = db.queryForObject("SELECT COUNT(*) FROM users" + w, Long.class, args.toArray());
    int s = size(size), p = Math.max(page, 0); args.add(s); args.add(p * s);
    return Map.of("items", db.queryForList("SELECT id,full_name,phone,email,role,enabled,created_at,last_login_at,locked_until IS NOT NULL AND locked_until>UTC_TIMESTAMP() AS locked," +
      "(SELECT COUNT(*) FROM bookings b WHERE b.customer_id=users.id) AS bookings FROM users" + w + " ORDER BY id DESC LIMIT ? OFFSET ?", args.toArray()), "total", total == null ? 0 : total, "page", p, "size", s);
  }

  @PatchMapping("/users/{id}/enabled") public Map<String, Object> userEnabled(@PathVariable long id, @Valid @RequestBody EnabledReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "USER_MANAGE");
    long actor = me.id(a);
    if (actor == id) throw new IllegalArgumentException("You cannot change your own account.");
    var rows = db.queryForList("SELECT role FROM users WHERE id=?", id);
    if (rows.isEmpty()) throw new IllegalArgumentException("User not found");
    String target = (String) rows.get(0).get("role");
    if (Set.of("ADMIN", "SUPER_ADMIN", "SUPPORT").contains(target)) perm.require(a, "STAFF_MANAGE");
    db.update("UPDATE users SET enabled=?, failed_login_count=0, locked_until=NULL WHERE id=?", r.enabled(), id);
    if (!r.enabled()) { tokens.revokeAll(id); db.update("UPDATE admin_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL", id); }
    audit.log(actor, r.enabled() ? "USER_ENABLED" : "USER_DISABLED", "USER", String.valueOf(id), null, req.getRemoteAddr());
    return Map.of("id", id, "enabled", r.enabled());
  }

  @PatchMapping("/users/{id}/role") public Map<String, Object> userRole(@PathVariable long id, @Valid @RequestBody RoleReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "STAFF_MANAGE");
    long actor = me.id(a);
    if (actor == id) throw new IllegalArgumentException("You cannot change your own role.");
    var rows = db.queryForList("SELECT role,password_hash FROM users WHERE id=?", id);
    if (rows.isEmpty()) throw new IllegalArgumentException("User not found");
    if (Set.of("SUPPORT", "ADMIN", "SUPER_ADMIN").contains(r.role()) && rows.get(0).get("password_hash") == null)
      throw new IllegalArgumentException("This user has no admin password yet. Use \"Add staff\" to create their login.");
    db.update("UPDATE users SET role=? WHERE id=?", r.role(), id);
    db.update("UPDATE admin_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL", id);
    audit.log(actor, "USER_ROLE_CHANGED", "USER", String.valueOf(id), rows.get(0).get("role") + " -> " + r.role(), req.getRemoteAddr());
    return Map.of("id", id, "role", r.role());
  }

  // ---------------- Staff (admins) ----------------
  /** SUPER_ADMIN only: create a SUPPORT / ADMIN / SUPER_ADMIN login. The temporary password is shown ONCE and must be changed at first sign-in. */
  @PostMapping("/staff") public Map<String, Object> addStaff(@Valid @RequestBody StaffReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "STAFF_MANAGE");
    long actor = me.id(a);
    String email = r.email() == null || r.email().isBlank() ? null : r.email().trim().toLowerCase(Locale.ROOT);
    if (email != null && !db.queryForList("SELECT id FROM users WHERE LOWER(email)=? AND phone<>?", Long.class, email, r.phone()).isEmpty()) throw new IllegalArgumentException("This email is already used by another account.");
    String temp = PasswordPolicy.generateTemp();
    var existing = db.queryForList("SELECT id,role FROM users WHERE phone=?", r.phone());
    long id;
    if (existing.isEmpty()) {
      id = sql.insert("INSERT INTO users(full_name,phone,email,password_hash,role,enabled,public_id,must_change_password,password_changed_at) VALUES(?,?,?,?,?,TRUE,UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,26)),TRUE,NULL)",
        r.fullName().trim(), r.phone(), email, encoder.encode(temp), r.role());
    } else {
      id = ((Number) existing.get(0).get("id")).longValue();
      if (Set.of("SUPPORT", "ADMIN", "SUPER_ADMIN").contains((String) existing.get(0).get("role"))) throw new IllegalArgumentException("This person is already staff. Change the role from the Users list instead.");
      db.update("UPDATE users SET role=?, password_hash=?, must_change_password=TRUE, enabled=TRUE, email=COALESCE(email,?), failed_login_count=0, locked_until=NULL WHERE id=?", r.role(), encoder.encode(temp), email, id);
    }
    audit.log(actor, "STAFF_CREATED", "USER", String.valueOf(id), r.role() + " ******" + r.phone().substring(6), req.getRemoteAddr());
    notify.toStaff("STAFF_CREATED", "New " + r.role().replace('_', ' ').toLowerCase(Locale.ROOT) + " added", r.fullName().trim() + " was given " + r.role() + " access.", "USER", id, "NORMAL");
    return Map.of("id", id, "phone", r.phone(), "role", r.role(), "tempPassword", temp,
      "message", "Share the temporary password privately. They must change it at first sign-in. It will not be shown again.");
  }

  /** SUPER_ADMIN only: generate a fresh temporary password for a staff member (e.g. they lost phone access to the reset OTP). */
  @PostMapping("/users/{id}/reset-password") public Map<String, Object> resetStaffPassword(@PathVariable long id, Authentication a, HttpServletRequest req) {
    perm.require(a, "STAFF_MANAGE");
    long actor = me.id(a);
    if (actor == id) throw new IllegalArgumentException("Use Forgot password for your own account.");
    var rows = db.queryForList("SELECT role FROM users WHERE id=?", id);
    if (rows.isEmpty() || !Set.of("SUPPORT", "ADMIN", "SUPER_ADMIN").contains((String) rows.get(0).get("role"))) throw new IllegalArgumentException("Only staff accounts can be reset here.");
    String temp = PasswordPolicy.generateTemp();
    db.update("UPDATE users SET password_hash=?, must_change_password=TRUE, failed_login_count=0, locked_until=NULL, enabled=TRUE WHERE id=?", encoder.encode(temp), id);
    db.update("UPDATE admin_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL", id);
    audit.log(actor, "STAFF_PASSWORD_RESET", "USER", String.valueOf(id), null, req.getRemoteAddr());
    return Map.of("id", id, "tempPassword", temp, "message", "Share the temporary password privately. They must change it at next sign-in. It will not be shown again.");
  }

  // ---------------- Catalog ----------------
  @GetMapping("/categories") public List<Map<String, Object>> categories(Authentication a) {
    perm.require(a, "CATALOG_MANAGE");
    return db.queryForList("SELECT c.*,(SELECT COUNT(*) FROM providers p WHERE p.category_id=c.id) AS providers,(SELECT COUNT(*) FROM services s WHERE s.category_id=c.id) AS services FROM categories c ORDER BY c.display_order,c.name");
  }
  @PostMapping("/categories") public Map<String, Object> addCategory(@Valid @RequestBody CategoryReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "CATALOG_MANAGE");
    String slug = r.name().trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    long id = sql.insert("INSERT INTO categories(name,slug,icon,description,display_order,is_featured,active,eta_minutes,base_visit_fee) VALUES(?,?,?,?,?,?,?,?,?)",
      r.name().trim(), slug, r.icon(), r.description(), r.displayOrder() == null ? 100 : r.displayOrder(), Boolean.TRUE.equals(r.featured()), r.active() == null || r.active(),
      r.etaMinutes() == null ? 45 : r.etaMinutes(), r.baseVisitFee() == null ? new BigDecimal("49") : r.baseVisitFee());
    audit.log(me.id(a), "CATEGORY_CREATED", "CATEGORY", String.valueOf(id), r.name(), req.getRemoteAddr());
    return Map.of("id", id, "slug", slug);
  }
  @PutMapping("/categories/{id}") public Map<String, Object> updateCategory(@PathVariable long id, @Valid @RequestBody CategoryReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "CATALOG_MANAGE");
    int n = db.update("UPDATE categories SET name=?,icon=?,description=?,display_order=COALESCE(?,display_order),is_featured=COALESCE(?,is_featured),active=COALESCE(?,active),eta_minutes=COALESCE(?,eta_minutes),base_visit_fee=COALESCE(?,base_visit_fee),updated_at=UTC_TIMESTAMP() WHERE id=?",
      r.name().trim(), r.icon(), r.description(), r.displayOrder(), r.featured(), r.active(), r.etaMinutes(), r.baseVisitFee(), id);
    if (n == 0) throw new IllegalArgumentException("Category not found");
    audit.log(me.id(a), "CATEGORY_UPDATED", "CATEGORY", String.valueOf(id), r.name(), req.getRemoteAddr());
    return Map.of("id", id);
  }

  @GetMapping("/services") public List<Map<String, Object>> services(Authentication a) {
    perm.require(a, "CATALOG_MANAGE");
    return db.queryForList("SELECT s.*,c.name AS category FROM services s JOIN categories c ON c.id=s.category_id ORDER BY c.display_order,s.name");
  }
  @PostMapping("/services") public Map<String, Object> addService(@Valid @RequestBody ServiceReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "CATALOG_MANAGE");
    String slug = r.name().trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    long id = sql.insert("INSERT INTO services(category_id,name,slug,base_price,duration_minutes,is_active) VALUES(?,?,?,?,?,?)", r.categoryId(), r.name().trim(), slug,
      r.basePrice() == null ? BigDecimal.ZERO : r.basePrice(), r.durationMinutes() == null ? 60 : r.durationMinutes(), r.active() == null || r.active());
    audit.log(me.id(a), "SERVICE_CREATED", "SERVICE", String.valueOf(id), r.name(), req.getRemoteAddr());
    return Map.of("id", id);
  }
  @PutMapping("/services/{id}") public Map<String, Object> updateService(@PathVariable long id, @Valid @RequestBody ServiceReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "CATALOG_MANAGE");
    int n = db.update("UPDATE services SET name=?,base_price=COALESCE(?,base_price),duration_minutes=COALESCE(?,duration_minutes),is_active=COALESCE(?,is_active) WHERE id=?", r.name().trim(), r.basePrice(), r.durationMinutes(), r.active(), id);
    if (n == 0) throw new IllegalArgumentException("Service not found");
    audit.log(me.id(a), "SERVICE_UPDATED", "SERVICE", String.valueOf(id), r.name(), req.getRemoteAddr());
    return Map.of("id", id);
  }

  @GetMapping("/banners") public List<Map<String, Object>> banners(Authentication a) {
    perm.require(a, "CATALOG_MANAGE"); return db.queryForList("SELECT * FROM banners ORDER BY display_order,id");
  }
  @PostMapping("/banners") public Map<String, Object> addBanner(@Valid @RequestBody BannerReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "CATALOG_MANAGE");
    long id = sql.insert("INSERT INTO banners(title,subtitle,emoji,gradient,cta_label,target_category_slug,coupon_code,display_order,is_active) VALUES(?,?,?,?,?,?,?,?,?)",
      r.title(), r.subtitle(), r.emoji(), r.gradient() == null ? "#164ecb,#1f68ed" : r.gradient(), r.ctaLabel(), r.targetCategorySlug(), r.couponCode(), r.displayOrder() == null ? 100 : r.displayOrder(), r.active() == null || r.active());
    audit.log(me.id(a), "BANNER_CREATED", "BANNER", String.valueOf(id), r.title(), req.getRemoteAddr());
    return Map.of("id", id);
  }
  @PutMapping("/banners/{id}") public Map<String, Object> updateBanner(@PathVariable long id, @Valid @RequestBody BannerReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "CATALOG_MANAGE");
    int n = db.update("UPDATE banners SET title=?,subtitle=?,emoji=?,gradient=COALESCE(?,gradient),cta_label=?,target_category_slug=?,coupon_code=?,display_order=COALESCE(?,display_order),is_active=COALESCE(?,is_active) WHERE id=?",
      r.title(), r.subtitle(), r.emoji(), r.gradient(), r.ctaLabel(), r.targetCategorySlug(), r.couponCode(), r.displayOrder(), r.active(), id);
    if (n == 0) throw new IllegalArgumentException("Banner not found");
    audit.log(me.id(a), "BANNER_UPDATED", "BANNER", String.valueOf(id), r.title(), req.getRemoteAddr());
    return Map.of("id", id);
  }
  @DeleteMapping("/banners/{id}") public Map<String, Object> deleteBanner(@PathVariable long id, Authentication a, HttpServletRequest req) {
    perm.require(a, "CATALOG_MANAGE");
    db.update("DELETE FROM banners WHERE id=?", id);
    audit.log(me.id(a), "BANNER_DELETED", "BANNER", String.valueOf(id), null, req.getRemoteAddr());
    return Map.of("deleted", true);
  }

  // ---------------- Coupons ----------------
  @GetMapping("/coupons") public List<Map<String, Object>> coupons(Authentication a) {
    perm.require(a, "COUPON_MANAGE"); return db.queryForList("SELECT * FROM coupons ORDER BY id DESC");
  }
  @PostMapping("/coupons") public Map<String, Object> addCoupon(@Valid @RequestBody CouponReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "COUPON_MANAGE");
    if ("PERCENT".equals(r.discountType()) && r.discountValue().compareTo(new BigDecimal("100")) > 0) throw new IllegalArgumentException("Percent discount cannot exceed 100.");
    long id = sql.insert("INSERT INTO coupons(code,description,discount_type,discount_value,max_discount,min_order,first_booking_only,usage_limit,per_user_limit,valid_until,is_active) VALUES(?,?,?,?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY),?)",
      r.code().toUpperCase(), r.description(), r.discountType() == null ? "FLAT" : r.discountType(), r.discountValue(), r.maxDiscount(), r.minOrder() == null ? BigDecimal.ZERO : r.minOrder(),
      Boolean.TRUE.equals(r.firstBookingOnly()), r.usageLimit(), r.perUserLimit() == null ? 1 : r.perUserLimit(), r.validDays() == null ? 90 : r.validDays(), r.active() == null || r.active());
    audit.log(me.id(a), "COUPON_CREATED", "COUPON", String.valueOf(id), r.code(), req.getRemoteAddr());
    return Map.of("id", id);
  }
  @PatchMapping("/coupons/{id}/active") public Map<String, Object> couponActive(@PathVariable long id, @Valid @RequestBody EnabledReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "COUPON_MANAGE");
    db.update("UPDATE coupons SET is_active=? WHERE id=?", r.enabled(), id);
    audit.log(me.id(a), r.enabled() ? "COUPON_ENABLED" : "COUPON_DISABLED", "COUPON", String.valueOf(id), null, req.getRemoteAddr());
    return Map.of("id", id, "active", r.enabled());
  }

  // ---------------- Notifications ----------------
  @PostMapping("/notifications/broadcast") public Map<String, Object> broadcast(@Valid @RequestBody BroadcastReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "NOTIFY_BROADCAST");
    long uid = me.id(a);
    int n = notify.broadcast(r.audience() == null ? "ALL" : r.audience(), r.title().trim(), r.body().trim(), uid);
    audit.log(uid, "BROADCAST_SENT", "NOTIFICATION", null, r.title() + " -> " + r.audience() + " (" + n + ")", req.getRemoteAddr());
    return Map.of("recipients", n);
  }
  @GetMapping("/notifications/broadcasts") public List<Map<String, Object>> broadcasts(Authentication a) {
    perm.require(a, "NOTIFY_BROADCAST");
    return db.queryForList("SELECT b.*,u.full_name AS sender FROM notification_broadcasts b LEFT JOIN users u ON u.id=b.created_by ORDER BY b.id DESC LIMIT 50");
  }

  // ---------------- Audit / security / settings ----------------
  @GetMapping("/audit") public Map<String, Object> audit(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size, @RequestParam(required = false) String action, Authentication a) {
    perm.require(a, "AUDIT_VIEW");
    int s = size(size), p = Math.max(page, 0);
    boolean f = action != null && !action.isBlank();
    List<Object> args = new ArrayList<>(); if (f) args.add(like(action)); args.add(s); args.add(p * s);
    return Map.of("items", db.queryForList("SELECT l.id,l.action,l.entity_type,l.entity_id,l.detail,l.ip_address,l.created_at,u.full_name AS actor,u.phone AS actor_phone FROM audit_logs l LEFT JOIN users u ON u.id=l.actor_user_id" + (f ? " WHERE l.action LIKE ?" : "") + " ORDER BY l.id DESC LIMIT ? OFFSET ?", args.toArray()), "page", p, "size", s);
  }

  @GetMapping("/security/logins") public List<Map<String, Object>> logins(Authentication a) {
    perm.require(a, "AUDIT_VIEW");
    return db.queryForList("SELECT identifier,ip_address,success,reason,created_at FROM login_attempts WHERE scope='ADMIN' ORDER BY id DESC LIMIT 50");
  }
  @GetMapping("/sessions") public List<Map<String, Object>> sessions(Authentication a) {
    perm.require(a, "STAFF_MANAGE");
    return db.queryForList("SELECT s.id,s.ip_address,s.user_agent,s.created_at,s.last_seen_at,s.expires_at,u.full_name,u.phone,u.role FROM admin_sessions s JOIN users u ON u.id=s.user_id WHERE s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP() ORDER BY s.last_seen_at DESC");
  }
  @PostMapping("/sessions/{sid}/revoke") public Map<String, Object> revokeSession(@PathVariable String sid, Authentication a, HttpServletRequest req) {
    perm.require(a, "STAFF_MANAGE");
    db.update("UPDATE admin_sessions SET revoked_at=UTC_TIMESTAMP() WHERE id=? AND revoked_at IS NULL", sid);
    audit.log(me.id(a), "ADMIN_SESSION_REVOKED", "SESSION", sid.substring(0, Math.min(6, sid.length())), null, req.getRemoteAddr());
    return Map.of("revoked", true);
  }

  @GetMapping("/settings") public Map<String, Object> settings(Authentication a) {
    perm.require(a, "SETTINGS_MANAGE");
    return Map.of("flags", db.queryForList("SELECT flag_key,is_enabled,description FROM feature_flags ORDER BY flag_key"),
      "settings", db.queryForList("SELECT setting_key,setting_value,value_type,description FROM system_settings ORDER BY setting_key"));
  }
  @PatchMapping("/flags/{key}") public Map<String, Object> flag(@PathVariable String key, @Valid @RequestBody FlagReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "SETTINGS_MANAGE");
    int n = db.update("UPDATE feature_flags SET is_enabled=?, updated_at=UTC_TIMESTAMP() WHERE flag_key=?", r.enabled(), key);
    if (n == 0) throw new IllegalArgumentException("Unknown flag");
    audit.log(me.id(a), "FLAG_CHANGED", "FLAG", key, String.valueOf(r.enabled()), req.getRemoteAddr());
    return Map.of("key", key, "enabled", r.enabled());
  }
  @PatchMapping("/settings/{key}") public Map<String, Object> setting(@PathVariable String key, @Valid @RequestBody SettingReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "SETTINGS_MANAGE");
    var cur = db.queryForList("SELECT value_type FROM system_settings WHERE setting_key=?", String.class, key);
    if (cur.isEmpty()) throw new IllegalArgumentException("Unknown setting");
    if ("NUMBER".equals(cur.get(0))) { try { new BigDecimal(r.value().trim()); } catch (NumberFormatException e) { throw new IllegalArgumentException("This setting must be a number."); } }
    db.update("UPDATE system_settings SET setting_value=?, updated_at=UTC_TIMESTAMP() WHERE setting_key=?", r.value().trim(), key);
    audit.log(me.id(a), "SETTING_CHANGED", "SETTING", key, r.value(), req.getRemoteAddr());
    return Map.of("key", key, "value", r.value().trim());
  }

  // ---------------- Subscriptions & emergencies ----------------
  @GetMapping("/plans") public List<Map<String, Object>> plans(Authentication a) {
    perm.require(a, "CATALOG_MANAGE");
    return db.queryForList("SELECT sp.*,(SELECT COUNT(*) FROM provider_subscriptions ps WHERE ps.plan_id=sp.id AND ps.status IN ('TRIAL','ACTIVE')) AS subscribers FROM subscription_plans sp ORDER BY sp.price");
  }
  @PutMapping("/plans/{id}") public Map<String, Object> updatePlan(@PathVariable long id, @Valid @RequestBody PlanReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "CATALOG_MANAGE");
    int n = db.update("UPDATE subscription_plans SET price=?,features=COALESCE(?,features),active=COALESCE(?,active) WHERE id=?", r.price(), r.features(), r.active(), id);
    if (n == 0) throw new IllegalArgumentException("Plan not found");
    audit.log(me.id(a), "PLAN_UPDATED", "PLAN", String.valueOf(id), "price " + r.price(), req.getRemoteAddr());
    return Map.of("id", id);
  }

  @GetMapping("/emergencies") public List<Map<String, Object>> emergencies(Authentication a) {
    perm.require(a, "BOOKING_VIEW");
    return db.queryForList("SELECT e.id,e.public_code,e.emergency_type,e.description,e.address,e.contact_phone,e.status,e.created_at,u.full_name AS customer_name FROM emergency_requests e JOIN users u ON u.id=e.customer_id ORDER BY e.id DESC LIMIT 100");
  }
  @PatchMapping("/emergencies/{id}/status") public Map<String, Object> emergencyStatus(@PathVariable long id, @RequestBody Map<String, String> body, Authentication a, HttpServletRequest req) {
    perm.require(a, "BOOKING_MANAGE");
    String s = String.valueOf(body.getOrDefault("status", "")).toUpperCase(Locale.ROOT);
    if (!Set.of("RECEIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "CLOSED").contains(s)) throw new IllegalArgumentException("Invalid status");
    var rows = db.queryForList("SELECT customer_id,public_code FROM emergency_requests WHERE id=?", id);
    if (rows.isEmpty()) throw new IllegalArgumentException("Emergency not found");
    db.update("UPDATE emergency_requests SET status=? WHERE id=?", s, id);
    notify.toUser(((Number) rows.get(0).get("customer_id")).longValue(), "EMERGENCY_" + s, "Emergency " + rows.get(0).get("public_code") + " update", "Status: " + s.replace('_', ' '), "EMERGENCY", id, "USER", "HIGH");
    audit.log(me.id(a), "EMERGENCY_STATUS", "EMERGENCY", String.valueOf(id), s, req.getRemoteAddr());
    return Map.of("id", id, "status", s);
  }
}
