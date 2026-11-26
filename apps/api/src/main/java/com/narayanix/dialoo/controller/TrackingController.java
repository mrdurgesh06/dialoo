package com.narayanix.dialoo.controller;

import com.narayanix.dialoo.service.CurrentUser;
import com.narayanix.dialoo.service.TrackingService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Live tracking. The provider app posts its position while a booking is ON_THE_WAY; the customer (and the provider)
 * read it back together with route + ETA. Location exists only while ON_THE_WAY and is deleted afterwards.
 */
@RestController @RequestMapping("/api/v1")
public class TrackingController {
  public record Ping(@NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude, @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
                     @DecimalMin("0") @DecimalMax("100000") Double accuracy, @DecimalMin("0") @DecimalMax("200") Double speed,
                     @DecimalMin("0") @DecimalMax("360") Double heading) {}

  private static final int STALE_SECONDS = 90;
  private final JdbcTemplate db; private final CurrentUser me; private final TrackingService routes;
  public TrackingController(JdbcTemplate db, CurrentUser me, TrackingService routes) { this.db = db; this.me = me; this.routes = routes; }

  @PostMapping("/bookings/{id}/location")
  public Map<String, Object> ping(@PathVariable long id, @Valid @RequestBody Ping p, Authentication a) {
    var rows = db.queryForList("SELECT b.status,b.provider_id FROM bookings b JOIN providers p ON p.id=b.provider_id WHERE b.id=? AND p.user_id=?", id, me.id(a));
    if (rows.isEmpty()) throw new IllegalArgumentException("Booking not found or access denied");
    if (!"ON_THE_WAY".equals(rows.get(0).get("status"))) throw new IllegalArgumentException("Location is shared only while you are on the way.");
    db.update("INSERT INTO booking_tracking(booking_id,provider_id,latitude,longitude,accuracy_m,speed_mps,heading_deg,updated_at) VALUES(?,?,?,?,?,?,?,UTC_TIMESTAMP()) " +
      "ON DUPLICATE KEY UPDATE latitude=VALUES(latitude),longitude=VALUES(longitude),accuracy_m=VALUES(accuracy_m),speed_mps=VALUES(speed_mps),heading_deg=VALUES(heading_deg),updated_at=UTC_TIMESTAMP()",
      id, rows.get(0).get("provider_id"), p.latitude(), p.longitude(), p.accuracy(), p.speed(), p.heading());
    return Map.of("ok", true);
  }

  @GetMapping("/bookings/{id}/tracking")
  public Map<String, Object> tracking(@PathVariable long id, Authentication a) {
    long uid = me.id(a);
    var rows = db.queryForList("SELECT b.status,b.latitude AS dlat,b.longitude AS dlng,b.service_address,b.eta_minutes,p.business_name," +
      "t.latitude AS plat,t.longitude AS plng,t.speed_mps,t.heading_deg,TIMESTAMPDIFF(SECOND,t.updated_at,UTC_TIMESTAMP()) AS age_s " +
      "FROM bookings b JOIN providers p ON p.id=b.provider_id LEFT JOIN booking_tracking t ON t.booking_id=b.id " +
      "WHERE b.id=? AND (b.customer_id=? OR p.user_id=?)", id, uid, uid);
    if (rows.isEmpty()) throw new IllegalArgumentException("Booking not found or access denied");
    Map<String, Object> r = rows.get(0);
    Map<String, Object> out = new LinkedHashMap<>();
    String status = (String) r.get("status");
    out.put("status", status);
    boolean live = "ON_THE_WAY".equals(status);
    out.put("live", live);
    if (!live) return out;
    Double dlat = num(r.get("dlat")), dlng = num(r.get("dlng")), plat = num(r.get("plat")), plng = num(r.get("plng"));
    out.put("fallbackEtaMinutes", r.get("eta_minutes"));
    out.put("destination", dlat == null || dlng == null ? null : Map.of("lat", dlat, "lng", dlng, "address", String.valueOf(r.get("service_address"))));
    if (plat == null || plng == null) { out.put("provider", null); out.put("route", null); out.put("etaMinutes", null); return out; }
    long age = r.get("age_s") == null ? 0 : ((Number) r.get("age_s")).longValue();
    Map<String, Object> prov = new LinkedHashMap<>();
    prov.put("lat", plat); prov.put("lng", plng); prov.put("ageSeconds", age); prov.put("stale", age > STALE_SECONDS);
    prov.put("heading", num(r.get("heading_deg")));
    out.put("provider", prov);
    if (dlat == null || dlng == null) { out.put("route", null); out.put("etaMinutes", null); return out; }
    TrackingService.Route route = routes.route(id, plat, plng, dlat, dlng);
    Map<String, Object> ro = new LinkedHashMap<>();
    ro.put("coordinates", route.coordinates()); ro.put("distanceMeters", Math.round(route.distanceMeters()));
    ro.put("durationSeconds", Math.round(route.durationSeconds())); ro.put("source", route.source());
    out.put("route", ro);
    out.put("etaMinutes", Math.max(1, (int) Math.ceil(route.durationSeconds() / 60.0)));
    return out;
  }

  private static Double num(Object o) { return o == null ? null : ((Number) o).doubleValue(); }
}
