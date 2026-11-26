package com.narayanix.dialoo.controller;

import com.narayanix.dialoo.service.CurrentUser;
import com.narayanix.dialoo.service.NotificationService;
import com.narayanix.dialoo.service.SettingsService;
import com.narayanix.dialoo.service.Sql;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Emergency (record + alert admins), rentals and projects. Each is feature-flagged (SRS 77). */
@RestController @RequestMapping("/api/v1")
public class ExtrasController {
  public record EmergencyCreate(@NotBlank String emergencyType, @NotBlank @Size(max = 500) String address, @NotBlank @Pattern(regexp = "[0-9+ -]{10,20}") String contactPhone, @Size(max = 1000) String description) {}
  public record RentalCreate(@NotBlank @Size(max = 180) String title, @NotBlank String category, @Size(max = 1000) String description, @NotBlank String city, @NotNull @DecimalMin("0.01") BigDecimal pricePerDay) {}
  public record ProjectCreate(@NotBlank @Size(max = 180) String title, @NotBlank String category, @NotBlank @Size(max = 2000) String scopeDescription, @NotBlank String city, BigDecimal budgetMin, BigDecimal budgetMax, String timeline) {}
  public record QuoteCreate(@NotNull @DecimalMin("0.01") BigDecimal amount, @Size(max = 1500) String details, @Min(1) @Max(3650) Integer estimatedDays) {}

  private final JdbcTemplate db; private final CurrentUser me; private final Sql sql; private final NotificationService notify; private final SettingsService settings;
  public ExtrasController(JdbcTemplate db, CurrentUser me, Sql sql, NotificationService notify, SettingsService settings) { this.db = db; this.me = me; this.sql = sql; this.notify = notify; this.settings = settings; }

  @PostMapping("/emergencies") public Map<String, Object> emergency(@Valid @RequestBody EmergencyCreate r, Authentication a) {
    if (!settings.flag("EMERGENCY_ENABLED", true)) throw new IllegalArgumentException("Emergency help is not enabled in your city yet.");
    long uid = me.id(a);
    String type = r.emergencyType().toUpperCase(Locale.ROOT);
    if (!Set.of("MEDICAL", "VEHICLE", "HOME", "FIRE", "POLICE", "OTHER").contains(type)) throw new IllegalArgumentException("Unsupported emergency type");
    long id = sql.insert("INSERT INTO emergency_requests(customer_id,emergency_type,description,address,contact_phone) VALUES(?,?,?,?,?)", uid, type, r.description(), r.address(), r.contactPhone());
    String code = "DLE" + String.format("%07d", id);
    db.update("UPDATE emergency_requests SET public_code=? WHERE id=?", code, id);
    notify.toUser(uid, "EMERGENCY_RECEIVED", "Emergency request " + code + " received", "Our team has been alerted. For immediate danger call 112.", "EMERGENCY", id, "USER", "HIGH");
    notify.toStaff("EMERGENCY_RECEIVED", "EMERGENCY " + type + " - " + code, "Contact " + r.contactPhone() + " at " + r.address(), "EMERGENCY", id, "HIGH");
    return Map.of("id", id, "code", code, "status", "RECEIVED", "message", "Request stored and admins alerted. This API does not dispatch emergency services; call 112 for immediate danger.");
  }
  @GetMapping("/emergencies") public List<Map<String, Object>> emergencies(Authentication a) {
    return db.queryForList("SELECT * FROM emergency_requests WHERE customer_id=? ORDER BY created_at DESC LIMIT 50", me.id(a));
  }

  @PostMapping("/rentals") public Map<String, Object> rental(@Valid @RequestBody RentalCreate r, Authentication a) {
    long id = sql.insert("INSERT INTO rental_listings(owner_id,title,category,description,city,price_per_day) VALUES(?,?,?,?,?,?)", me.id(a), r.title(), r.category(), r.description(), r.city(), r.pricePerDay());
    notify.toStaff("RENTAL_LISTED", "New rental listing", r.title() + " in " + r.city(), "RENTAL", id, "LOW");
    return db.queryForMap("SELECT * FROM rental_listings WHERE id=?", id);
  }
  @GetMapping("/rentals") public List<Map<String, Object>> rentals(@RequestParam(required = false) String city, @RequestParam(required = false) String category) {
    StringBuilder q = new StringBuilder("SELECT r.*,u.full_name owner_name FROM rental_listings r JOIN users u ON u.id=r.owner_id WHERE r.active=TRUE AND r.availability_status='AVAILABLE'");
    List<Object> p = new ArrayList<>();
    if (city != null && !city.isBlank()) { q.append(" AND LOWER(r.city)=LOWER(?)"); p.add(city); }
    if (category != null && !category.isBlank()) { q.append(" AND LOWER(r.category)=LOWER(?)"); p.add(category); }
    q.append(" ORDER BY r.created_at DESC LIMIT 100");
    return db.queryForList(q.toString(), p.toArray());
  }

  @PostMapping("/projects") public Map<String, Object> project(@Valid @RequestBody ProjectCreate r, Authentication a) {
    if (r.budgetMin() != null && r.budgetMax() != null && r.budgetMin().compareTo(r.budgetMax()) > 0) throw new IllegalArgumentException("budgetMin cannot exceed budgetMax");
    long id = sql.insert("INSERT INTO projects(customer_id,title,category,scope_description,city,budget_min,budget_max,timeline) VALUES(?,?,?,?,?,?,?,?)", me.id(a), r.title(), r.category(), r.scopeDescription(), r.city(), r.budgetMin(), r.budgetMax(), r.timeline());
    notify.toStaff("PROJECT_POSTED", "New project posted", r.title() + " in " + r.city(), "PROJECT", id, "LOW");
    return db.queryForMap("SELECT * FROM projects WHERE id=?", id);
  }
  @GetMapping("/projects") public List<Map<String, Object>> projects(@RequestParam(required = false) String city) {
    if (city == null || city.isBlank()) return db.queryForList("SELECT p.*,u.full_name customer_name FROM projects p JOIN users u ON u.id=p.customer_id WHERE p.status='OPEN' ORDER BY p.created_at DESC LIMIT 100");
    return db.queryForList("SELECT p.*,u.full_name customer_name FROM projects p JOIN users u ON u.id=p.customer_id WHERE p.status='OPEN' AND LOWER(p.city)=LOWER(?) ORDER BY p.created_at DESC LIMIT 100", city);
  }
  @PostMapping("/projects/{id}/quotes") public Map<String, Object> quote(@PathVariable long id, @Valid @RequestBody QuoteCreate r, Authentication a) {
    long uid = me.id(a);
    var ps = db.queryForList("SELECT id FROM providers WHERE user_id=? AND status='APPROVED'", Long.class, uid);
    if (ps.isEmpty()) throw new IllegalArgumentException("Approved provider profile required to submit quotes");
    var proj = db.queryForList("SELECT customer_id,title FROM projects WHERE id=? AND status='OPEN'", id);
    if (proj.isEmpty()) throw new IllegalArgumentException("Open project not found");
    long qid = sql.insert("INSERT INTO project_quotes(project_id,provider_id,amount,details,estimated_days) VALUES(?,?,?,?,?)", id, ps.get(0), r.amount(), r.details(), r.estimatedDays());
    notify.toUser(((Number) proj.get(0).get("customer_id")).longValue(), "PROJECT_QUOTE", "New quote on your project", proj.get(0).get("title") + ": ₹" + r.amount().stripTrailingZeros().toPlainString(), "PROJECT", id, "USER", "NORMAL");
    return db.queryForMap("SELECT * FROM project_quotes WHERE id=?", qid);
  }
  @GetMapping("/projects/{id}/quotes") public List<Map<String, Object>> quotes(@PathVariable long id) {
    return db.queryForList("SELECT q.*,p.business_name,p.average_rating FROM project_quotes q JOIN providers p ON p.id=q.provider_id WHERE q.project_id=? ORDER BY q.amount ASC", id);
  }
}
