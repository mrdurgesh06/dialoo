package com.narayanix.dialoo.controller;

import com.narayanix.dialoo.service.AuditService;
import com.narayanix.dialoo.service.CurrentUser;
import com.narayanix.dialoo.service.PermissionService;
import com.narayanix.dialoo.service.Sql;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Admin > Locations: switch cities on/off, add cities, localities (areas) and streets. Needs LOCATION_MANAGE. */
@RestController @RequestMapping("/api/v1/admin/locations")
public class AdminLocationController {
  public record CityReq(@NotNull Long districtId, @NotBlank @Size(max = 100) String name, @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude, @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude) {}
  public record LocalityReq(@NotNull Long cityId, @NotBlank @Size(max = 120) String name, @Pattern(regexp = "^$|[0-9]{6}") String pincode, @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude, @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude) {}
  public record StreetReq(@NotNull Long cityId, Long localityId, @NotBlank @Size(max = 160) String name, @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude, @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude) {}
  public record ActiveReq(@NotNull Boolean enabled) {}

  private final JdbcTemplate db; private final PermissionService perm; private final AuditService audit; private final CurrentUser me; private final Sql sql;
  public AdminLocationController(JdbcTemplate db, PermissionService perm, AuditService audit, CurrentUser me, Sql sql) { this.db = db; this.perm = perm; this.audit = audit; this.me = me; this.sql = sql; }

  @GetMapping("/districts") public List<Map<String, Object>> districts(Authentication a) {
    perm.require(a, "LOCATION_MANAGE");
    return db.queryForList("SELECT d.id,d.name,s.name AS state FROM districts d JOIN states s ON s.id=d.state_id ORDER BY s.name,d.name");
  }

  @GetMapping("/cities") public Map<String, Object> cities(@RequestParam(required = false) String q, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size, Authentication a) {
    perm.require(a, "LOCATION_MANAGE");
    int s = Math.min(Math.max(size, 1), 100), p = Math.max(page, 0);
    List<Object> args = new ArrayList<>(); String w = "";
    if (q != null && !q.isBlank()) { w = " WHERE c.name LIKE ? OR d.name LIKE ?"; String l = "%" + q.trim().replace("%", "").replace("_", "") + "%"; args.add(l); args.add(l); }
    Long total = db.queryForObject("SELECT COUNT(*) FROM cities c JOIN districts d ON d.id=c.district_id" + w, Long.class, args.toArray());
    args.add(s); args.add(p * s);
    return Map.of("items", db.queryForList("SELECT c.id,c.name,c.latitude,c.longitude,c.is_active,d.name AS district,st.name AS state," +
      "(SELECT COUNT(*) FROM providers pr WHERE pr.city_id=c.id AND pr.status='APPROVED') AS providers," +
      "(SELECT COUNT(*) FROM localities l WHERE l.city_id=c.id) AS localities,(SELECT COUNT(*) FROM streets t WHERE t.city_id=c.id) AS streets " +
      "FROM cities c JOIN districts d ON d.id=c.district_id JOIN states st ON st.id=d.state_id" + w + " ORDER BY st.name,d.name,c.name LIMIT ? OFFSET ?", args.toArray()),
      "total", total == null ? 0 : total, "page", p, "size", s);
  }

  @PatchMapping("/cities/{id}/active") public Map<String, Object> cityActive(@PathVariable long id, @Valid @RequestBody ActiveReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "LOCATION_MANAGE");
    int n = db.update("UPDATE cities SET is_active=?, launched_at=IF(?, COALESCE(launched_at,UTC_TIMESTAMP()), launched_at) WHERE id=?", r.enabled(), r.enabled(), id);
    if (n == 0) throw new IllegalArgumentException("City not found");
    audit.log(me.id(a), r.enabled() ? "CITY_ENABLED" : "CITY_DISABLED", "CITY", String.valueOf(id), null, req.getRemoteAddr());
    return Map.of("id", id, "active", r.enabled());
  }

  @PostMapping("/cities") public Map<String, Object> addCity(@Valid @RequestBody CityReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "LOCATION_MANAGE");
    if (db.queryForList("SELECT id FROM districts WHERE id=?", Long.class, r.districtId()).isEmpty()) throw new IllegalArgumentException("District not found");
    long id = sql.insert("INSERT INTO cities(district_id,name,latitude,longitude,is_active,launched_at) VALUES(?,?,?,?,TRUE,UTC_TIMESTAMP())", r.districtId(), r.name().trim(), r.latitude(), r.longitude());
    audit.log(me.id(a), "CITY_CREATED", "CITY", String.valueOf(id), r.name(), req.getRemoteAddr());
    return Map.of("id", id);
  }

  @GetMapping("/localities") public List<Map<String, Object>> localities(@RequestParam long cityId, Authentication a) {
    perm.require(a, "LOCATION_MANAGE");
    return db.queryForList("SELECT id,name,pincode,latitude,longitude,is_active FROM localities WHERE city_id=? ORDER BY name", cityId);
  }
  @PostMapping("/localities") public Map<String, Object> addLocality(@Valid @RequestBody LocalityReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "LOCATION_MANAGE");
    long id = sql.insert("INSERT INTO localities(city_id,name,pincode,latitude,longitude) VALUES(?,?,?,?,?)", r.cityId(), r.name().trim(), r.pincode() == null || r.pincode().isBlank() ? null : r.pincode(), r.latitude(), r.longitude());
    audit.log(me.id(a), "LOCALITY_CREATED", "LOCALITY", String.valueOf(id), r.name(), req.getRemoteAddr());
    return Map.of("id", id);
  }
  @PatchMapping("/localities/{id}/active") public Map<String, Object> localityActive(@PathVariable long id, @Valid @RequestBody ActiveReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "LOCATION_MANAGE");
    db.update("UPDATE localities SET is_active=? WHERE id=?", r.enabled(), id);
    audit.log(me.id(a), "LOCALITY_TOGGLED", "LOCALITY", String.valueOf(id), String.valueOf(r.enabled()), req.getRemoteAddr());
    return Map.of("id", id, "active", r.enabled());
  }

  @GetMapping("/streets") public List<Map<String, Object>> streets(@RequestParam long cityId, Authentication a) {
    perm.require(a, "LOCATION_MANAGE");
    return db.queryForList("SELECT t.id,t.name,t.latitude,t.longitude,t.source,t.is_active,l.name AS locality FROM streets t LEFT JOIN localities l ON l.id=t.locality_id WHERE t.city_id=? ORDER BY t.name", cityId);
  }
  @PostMapping("/streets") public Map<String, Object> addStreet(@Valid @RequestBody StreetReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "LOCATION_MANAGE");
    long id = sql.insert("INSERT INTO streets(city_id,locality_id,name,latitude,longitude,source) VALUES(?,?,?,?,?,'ADMIN')", r.cityId(), r.localityId(), r.name().trim(), r.latitude(), r.longitude());
    audit.log(me.id(a), "STREET_CREATED", "STREET", String.valueOf(id), r.name(), req.getRemoteAddr());
    return Map.of("id", id);
  }
  @PatchMapping("/streets/{id}/active") public Map<String, Object> streetActive(@PathVariable long id, @Valid @RequestBody ActiveReq r, Authentication a, HttpServletRequest req) {
    perm.require(a, "LOCATION_MANAGE");
    db.update("UPDATE streets SET is_active=? WHERE id=?", r.enabled(), id);
    audit.log(me.id(a), "STREET_TOGGLED", "STREET", String.valueOf(id), String.valueOf(r.enabled()), req.getRemoteAddr());
    return Map.of("id", id, "active", r.enabled());
  }
}
