package com.narayanix.dialoo.controller;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Public discovery APIs: categories, services, cities, banners, offers, search (SRS 10.3, 10.6, 10.7). */
@RestController @RequestMapping("/api/v1")
public class CatalogController {
  private final JdbcTemplate db;
  public CatalogController(JdbcTemplate db) { this.db = db; }

  @GetMapping("/health") public Map<String, Object> health() {
    return Map.of("status", "UP", "service", "Dialoo API", "apiVersion", "v2", "time", java.time.Instant.now().toString());
  }

  @GetMapping("/categories") public List<Map<String, Object>> categories() {
    return db.queryForList("SELECT c.id,c.name,c.slug,c.icon,c.description,c.is_featured,c.eta_minutes,c.base_visit_fee," +
      "(SELECT COUNT(*) FROM providers p WHERE p.category_id=c.id AND p.status='APPROVED') AS provider_count " +
      "FROM categories c WHERE c.active=TRUE ORDER BY c.display_order,c.name");
  }

  @GetMapping("/categories/{slug}/services") public List<Map<String, Object>> services(@PathVariable String slug) {
    return db.queryForList("SELECT s.id,s.name,s.slug,s.description,s.base_price,s.duration_minutes FROM services s JOIN categories c ON c.id=s.category_id WHERE c.slug=? AND s.is_active=TRUE ORDER BY s.base_price", slug);
  }

  @GetMapping("/cities") public List<Map<String, Object>> cities() {
    return db.queryForList("SELECT c.id,c.name,d.name AS district,s.name AS state FROM cities c JOIN districts d ON d.id=c.district_id JOIN states s ON s.id=d.state_id WHERE c.is_active=TRUE ORDER BY c.name");
  }

  @GetMapping("/banners") public List<Map<String, Object>> banners() {
    return db.queryForList("SELECT id,title,subtitle,emoji,gradient,cta_label,target_category_slug,coupon_code FROM banners WHERE is_active=TRUE AND (starts_at IS NULL OR starts_at<=UTC_TIMESTAMP()) AND (ends_at IS NULL OR ends_at>UTC_TIMESTAMP()) ORDER BY display_order");
  }

  @GetMapping("/coupons/available") public List<Map<String, Object>> coupons() {
    return db.queryForList("SELECT code,description,discount_type,discount_value,max_discount,min_order,first_booking_only FROM coupons WHERE is_active=TRUE AND valid_from<=UTC_TIMESTAMP() AND (valid_until IS NULL OR valid_until>UTC_TIMESTAMP()) AND (usage_limit IS NULL OR used_count<usage_limit) ORDER BY discount_value DESC");
  }

  /** Typeahead: services, categories and providers matching the text. */
  @GetMapping("/search/suggest") public Map<String, Object> suggest(@RequestParam String q) {
    String term = q == null ? "" : q.trim();
    if (term.length() < 2) return Map.of("categories", List.of(), "services", List.of(), "providers", List.of());
    String like = "%" + term.replace("%", "").replace("_", "") + "%";
    return Map.of(
      "categories", db.queryForList("SELECT name,slug,icon FROM categories WHERE active=TRUE AND (name LIKE ? OR description LIKE ?) ORDER BY display_order LIMIT 4", like, like),
      "services", db.queryForList("SELECT s.name,s.base_price,c.slug AS category_slug,c.icon FROM services s JOIN categories c ON c.id=s.category_id WHERE s.is_active=TRUE AND s.name LIKE ? ORDER BY s.name LIMIT 5", like),
      "providers", db.queryForList("SELECT id,business_name,category,avatar_emoji FROM v_provider_search WHERE business_name LIKE ? ORDER BY average_rating DESC LIMIT 4", like));
  }

  @GetMapping("/providers") public List<Map<String, Object>> providers(
      @RequestParam(required = false) Long categoryId, @RequestParam(required = false) String categorySlug,
      @RequestParam(required = false) String city, @RequestParam(required = false) Long cityId,
      @RequestParam(required = false) String q, @RequestParam(required = false) Boolean available,
      @RequestParam(required = false) Boolean verified, @RequestParam(required = false) BigDecimal minRating,
      @RequestParam(required = false) BigDecimal maxPrice, @RequestParam(required = false) Boolean emergency,
      @RequestParam(required = false) Double lat, @RequestParam(required = false) Double lng,
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
      @RequestParam(defaultValue = "best") String sort) {
    boolean geo = lat != null && lng != null;
    String distance = geo ? "ROUND(6371*2*ASIN(SQRT(POWER(SIN(RADIANS(latitude-?)/2),2)+COS(RADIANS(?))*COS(RADIANS(latitude))*POWER(SIN(RADIANS(longitude-?)/2),2))),1)" : "NULL";
    StringBuilder sb = new StringBuilder("SELECT v.*, " + distance + " AS distance_km FROM v_provider_search v WHERE 1=1");
    List<Object> args = new ArrayList<>();
    if (geo) { args.add(lat); args.add(lat); args.add(lng); }
    if (categoryId != null) { sb.append(" AND v.category_id=?"); args.add(categoryId); }
    if (categorySlug != null && !categorySlug.isBlank()) { sb.append(" AND v.category_slug=?"); args.add(categorySlug); }
    if (cityId != null) { sb.append(" AND v.city_id=?"); args.add(cityId); }
    if (city != null && !city.isBlank()) { sb.append(" AND LOWER(v.city)=LOWER(?)"); args.add(city.trim()); }
    if (q != null && !q.isBlank()) {
      String like = "%" + q.trim().replace("%", "").replace("_", "") + "%";
      sb.append(" AND (v.business_name LIKE ? OR v.description LIKE ? OR v.category LIKE ? OR EXISTS (SELECT 1 FROM provider_services ps JOIN services s ON s.id=ps.service_id WHERE ps.provider_id=v.id AND s.name LIKE ?))");
      args.add(like); args.add(like); args.add(like); args.add(like);
    }
    if (available != null && available) sb.append(" AND v.available_now=TRUE");
    if (verified != null && verified) sb.append(" AND v.verified=TRUE");
    if (emergency != null && emergency) sb.append(" AND v.emergency_available=TRUE");
    if (minRating != null) { sb.append(" AND v.average_rating>=?"); args.add(minRating); }
    if (maxPrice != null) { sb.append(" AND v.price_from<=?"); args.add(maxPrice); }
    String order = switch (sort.toLowerCase(Locale.ROOT)) {
      case "rating" -> " ORDER BY v.average_rating DESC, v.review_count DESC, v.id DESC";
      case "price" -> " ORDER BY v.price_from ASC, v.id DESC";
      case "experience" -> " ORDER BY v.years_experience DESC, v.id DESC";
      case "fastest" -> " ORDER BY v.available_now DESC, v.avg_response_minutes ASC, v.id DESC";
      case "nearest" -> geo ? " ORDER BY (distance_km IS NULL), distance_km ASC, v.available_now DESC, v.id DESC" : " ORDER BY v.id DESC";
      default -> " ORDER BY v.available_now DESC, v.verified DESC, v.average_rating DESC, v.completed_jobs_count DESC, v.id DESC";
    };
    int safeSize = Math.min(Math.max(size, 1), 50), safePage = Math.max(page, 0);
    sb.append(order).append(" LIMIT ? OFFSET ?"); args.add(safeSize); args.add(safePage * safeSize);
    List<Map<String, Object>> rows = db.queryForList(sb.toString(), args.toArray());
    rows.forEach(r -> r.remove("user_id"));
    return rows;
  }

  @GetMapping("/providers/{id}") public Map<String, Object> provider(@PathVariable long id) {
    List<Map<String, Object>> rows = db.queryForList("SELECT * FROM v_provider_search WHERE id=?", id);
    if (rows.isEmpty()) throw new IllegalArgumentException("Provider not found");
    Map<String, Object> out = new java.util.LinkedHashMap<>(rows.get(0));
    out.remove("user_id");
    out.put("services", db.queryForList("SELECT s.id,s.name,ps.price,s.duration_minutes FROM provider_services ps JOIN services s ON s.id=ps.service_id WHERE ps.provider_id=? ORDER BY ps.price", id));
    out.put("reviews", db.queryForList("SELECT r.rating,r.comment,r.provider_response,r.created_at,u.full_name AS customer_name FROM reviews r JOIN users u ON u.id=r.customer_id WHERE r.provider_id=? AND r.status='PUBLISHED' ORDER BY r.created_at DESC LIMIT 10", id));
    return out;
  }
}
