package com.narayanix.dialoo.controller;

import com.narayanix.dialoo.tracking.RouteMath;
import com.narayanix.dialoo.tracking.TrackingProperties;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Nearby partner discovery for the consumer's selected service location.
 * Cheap path first: an index-friendly bounding box in SQL, then exact Haversine in memory, then the partner's own service radius.
 * No Google Routes call is made here (road distance is only computed for the assigned partner's journey).
 * Privacy: only distance and profile data are returned - never the partner's coordinates.
 */
@RestController @RequestMapping("/api/v1")
public class NearbyController {
  private final JdbcTemplate db; private final TrackingProperties cfg;
  public NearbyController(JdbcTemplate db, TrackingProperties cfg) { this.db = db; this.cfg = cfg; }

  @GetMapping("/partners/nearby")
  public Map<String, Object> nearby(@RequestParam double lat, @RequestParam double lng, @RequestParam(required = false) Double radiusKm,
                                    @RequestParam(required = false) Long categoryId, @RequestParam(required = false) String categorySlug,
                                    @RequestParam(defaultValue = "20") int limit) {
    if (!Double.isFinite(lat) || !Double.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new IllegalArgumentException("Invalid coordinates");
    double radius = radiusKm == null ? cfg.getNearbyDefaultRadiusKm() : radiusKm;
    if (!(radius > 0) || radius > cfg.getNearbyMaxRadiusKm()) throw new IllegalArgumentException("radiusKm must be between 0 and " + (int) cfg.getNearbyMaxRadiusKm());
    int max = Math.min(Math.max(limit, 1), 50), fresh = cfg.getPartnerLocationFreshSeconds();
    double[] bb = RouteMath.boundingBox(lat, lng, radius);

    StringBuilder sb = new StringBuilder(
      "SELECT p.id,p.public_id,p.business_name,c.name AS category,c.slug AS category_slug,p.average_rating,p.review_count,p.verified,p.verification_level,p.avg_response_minutes,p.service_radius_km,p.avatar_emoji," +
      "p.latitude AS plat,p.longitude AS plng,l.latitude AS llat,l.longitude AS llng,TIMESTAMPDIFF(SECOND,l.updated_at,UTC_TIMESTAMP()) AS live_age_s " +
      "FROM providers p JOIN categories c ON c.id=p.category_id LEFT JOIN provider_live_location l ON l.provider_id=p.id " +
      "WHERE p.status='APPROVED' AND p.deleted_at IS NULL AND p.available_now=TRUE " +
      "AND ((p.latitude BETWEEN ? AND ? AND p.longitude BETWEEN ? AND ?) OR (l.updated_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? SECOND) AND l.latitude BETWEEN ? AND ? AND l.longitude BETWEEN ? AND ?)) " +
      "AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.provider_id=p.id AND b.status IN ('ON_THE_WAY','IN_PROGRESS'))");
    List<Object> args = new ArrayList<>(List.of(bb[0], bb[1], bb[2], bb[3], fresh, bb[0], bb[1], bb[2], bb[3]));
    if (categoryId != null) { sb.append(" AND p.category_id=?"); args.add(categoryId); }
    if (categorySlug != null && !categorySlug.isBlank()) { sb.append(" AND c.slug=?"); args.add(categorySlug.trim()); }
    sb.append(" LIMIT 500");

    List<Map<String, Object>> out = new ArrayList<>();
    for (Map<String, Object> r : db.queryForList(sb.toString(), args.toArray())) {
      boolean useLive = r.get("llat") != null && r.get("live_age_s") != null && ((Number) r.get("live_age_s")).longValue() <= fresh;
      Object la = useLive ? r.get("llat") : r.get("plat"), lo = useLive ? r.get("llng") : r.get("plng");
      if (la == null || lo == null) continue;
      double km = RouteMath.haversine(lat, lng, ((Number) la).doubleValue(), ((Number) lo).doubleValue()) / 1000.0;
      double coverage = r.get("service_radius_km") == null ? 10 : ((Number) r.get("service_radius_km")).doubleValue();
      if (km > radius || km > coverage) continue;
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("id", r.get("id")); m.put("publicId", r.get("public_id")); m.put("name", r.get("business_name")); m.put("category", r.get("category")); m.put("categorySlug", r.get("category_slug"));
      m.put("rating", r.get("average_rating")); m.put("reviewCount", r.get("review_count")); m.put("verified", Boolean.TRUE.equals(r.get("verified")));
      m.put("verificationLevel", r.get("verification_level")); m.put("avatarEmoji", r.get("avatar_emoji")); m.put("avgResponseMinutes", r.get("avg_response_minutes"));
      m.put("distanceKm", Math.round(km * 10) / 10.0);
      m.put("approxTravelMinutes", Math.max(1, (int) Math.ceil(km * 1.3 / Math.max(5, cfg.getFallbackSpeedKmh()) * 60)));   // straight-line estimate, not a Google call
      out.add(m);
    }
    out.sort(Comparator.comparingDouble(m -> ((Number) m.get("distanceKm")).doubleValue()));
    List<Map<String, Object>> page = out.size() > max ? out.subList(0, max) : out;
    return Map.of("radiusKm", radius, "count", page.size(), "partners", page);
  }
}
