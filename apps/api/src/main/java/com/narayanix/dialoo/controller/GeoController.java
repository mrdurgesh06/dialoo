package com.narayanix.dialoo.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * "Use my current location": GPS coordinates -> readable address + nearest launched city (Uber / Rapido style).
 * Public (guests can use it), rate-limited per IP, results cached. If the geocoder is unreachable we still return the
 * nearest city from our own database, so the app keeps working.
 * Production note: the free OpenStreetMap Nominatim server is for light use only. Point GEO_NOMINATIM_URL at your own
 * Nominatim / LocationIQ / similar provider before you have real traffic.
 */
@RestController @RequestMapping("/api/v1/geo")
public class GeoController {
  private static final Logger log = LoggerFactory.getLogger(GeoController.class);
  private static final int MAX_PER_MINUTE = 30;
  private static final int SERVICEABLE_KM = 60;

  private final JdbcTemplate db; private final ObjectMapper json;
  private final String baseUrl; private final String userAgent;
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
  private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();
  private final Map<String, Map<String, Object>> cache = java.util.Collections.synchronizedMap(new LinkedHashMap<>(256, 0.75f, true) {
    @Override protected boolean removeEldestEntry(Map.Entry<String, Map<String, Object>> e) { return size() > 2000; }
  });

  public GeoController(JdbcTemplate db, ObjectMapper json,
                       @Value("${app.geo.nominatim-url:https://nominatim.openstreetmap.org}") String baseUrl,
                       @Value("${app.geo.user-agent:Dialoo/4.0 (set GEO_USER_AGENT with your contact email)}") String userAgent) {
    this.db = db; this.json = json; this.baseUrl = baseUrl.replaceAll("/+$", ""); this.userAgent = userAgent;
  }

  @GetMapping("/reverse")
  public Map<String, Object> reverse(@RequestParam double lat, @RequestParam double lng, HttpServletRequest req) {
    if (Double.isNaN(lat) || Double.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new IllegalArgumentException("Invalid coordinates");
    throttle(req.getRemoteAddr());

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("latitude", lat); out.put("longitude", lng);
    addNearestCity(out, lat, lng);

    String key = String.format(Locale.ROOT, "%.3f,%.3f", lat, lng);          // ~110 m grid
    Map<String, Object> place = cache.get(key);
    if (place == null) { place = lookup(lat, lng); if (place != null) cache.put(key, place); }
    if (place != null) { out.putAll(place); out.put("source", "MAP"); }
    else {
      Map<String, Object> local = nearestKnownPlace(lat, lng);   // our own street / area table
      if (local != null) { out.putAll(local); out.put("source", "DATABASE"); }
      else { out.put("address", null); out.put("locality", null); out.put("pincode", null); out.put("source", null); }
    }
    return out;
  }

  private void addNearestCity(Map<String, Object> out, double lat, double lng) {
    List<Map<String, Object>> rows = db.queryForList(
      "SELECT id,name, ROUND(6371*2*ASIN(SQRT(POWER(SIN(RADIANS(latitude-?)/2),2)+COS(RADIANS(?))*COS(RADIANS(latitude))*POWER(SIN(RADIANS(longitude-?)/2),2))),1) AS km " +
      "FROM cities WHERE is_active=TRUE AND latitude IS NOT NULL ORDER BY km ASC LIMIT 1", lat, lat, lng);
    if (rows.isEmpty()) { out.put("serviceable", false); out.put("cityId", null); out.put("cityName", null); out.put("distanceToCityKm", null); return; }
    Map<String, Object> c = rows.get(0); double km = ((Number) c.get("km")).doubleValue();
    out.put("cityId", c.get("id")); out.put("cityName", c.get("name")); out.put("distanceToCityKm", km); out.put("serviceable", km <= SERVICEABLE_KM);
  }

  /** Offline-safe fallback: nearest street (within 0.6 km) or locality (within 4 km) stored in our database. */
  private Map<String, Object> nearestKnownPlace(double lat, double lng) {
    String hav = "6371*2*ASIN(SQRT(POWER(SIN(RADIANS(%1$s.latitude-?)/2),2)+COS(RADIANS(?))*COS(RADIANS(%1$s.latitude))*POWER(SIN(RADIANS(%1$s.longitude-?)/2),2)))";
    List<Map<String, Object>> st = db.queryForList("SELECT t.name AS street, l.name AS locality, l.pincode AS pincode, c.name AS city, " + String.format(hav, "t") +
      " AS km FROM streets t JOIN cities c ON c.id=t.city_id LEFT JOIN localities l ON l.id=t.locality_id WHERE t.is_active=TRUE ORDER BY km ASC LIMIT 1", lat, lat, lng);
    if (!st.isEmpty() && ((Number) st.get(0).get("km")).doubleValue() <= 0.6) {
      Map<String, Object> r = st.get(0); String loc = (String) r.get("locality"); String pin = (String) r.get("pincode");
      Map<String, Object> p = new LinkedHashMap<>();
      p.put("address", "Near " + r.get("street") + (loc == null ? "" : ", " + loc) + ", " + r.get("city") + (pin == null ? "" : " - " + pin));
      p.put("locality", loc == null ? r.get("street") : loc); p.put("pincode", pin);
      return p;
    }
    List<Map<String, Object>> lo = db.queryForList("SELECT l.name AS locality, l.pincode AS pincode, c.name AS city, " + String.format(hav, "l") +
      " AS km FROM localities l JOIN cities c ON c.id=l.city_id WHERE l.is_active=TRUE AND l.latitude IS NOT NULL ORDER BY km ASC LIMIT 1", lat, lat, lng);
    if (!lo.isEmpty() && ((Number) lo.get(0).get("km")).doubleValue() <= 4.0) {
      Map<String, Object> r = lo.get(0); String pin = (String) r.get("pincode");
      Map<String, Object> p = new LinkedHashMap<>();
      p.put("address", "Near " + r.get("locality") + ", " + r.get("city") + (pin == null ? "" : " - " + pin));
      p.put("locality", r.get("locality")); p.put("pincode", pin);
      return p;
    }
    return null;
  }

  private Map<String, Object> lookup(double lat, double lng) {
    try {
      String url = baseUrl + "/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=en&lat=" + lat + "&lon=" + lng;
      HttpRequest r = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(5)).header("User-Agent", userAgent).header("Accept", "application/json").GET().build();
      HttpResponse<String> resp = http.send(r, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
      if (resp.statusCode() != 200) { log.warn("Geocoder returned HTTP {}", resp.statusCode()); return null; }
      JsonNode root = json.readTree(resp.body()); JsonNode a = root.path("address");
      String road = join(a.path("house_number").asText(""), first(a, "road", "pedestrian", "footway", "path"));
      String area = first(a, "suburb", "neighbourhood", "quarter", "residential", "hamlet");
      String town = first(a, "city", "town", "village", "municipality", "county");
      StringBuilder addr = new StringBuilder();
      for (String part : new String[]{road, area, town, first(a, "state_district"), first(a, "state")}) {
        if (part == null || part.isBlank() || addr.toString().contains(part)) continue;
        if (addr.length() > 0) addr.append(", ");
        addr.append(part);
      }
      String pin = a.path("postcode").asText("");
      if (!pin.isBlank()) addr.append(" - ").append(pin);
      Map<String, Object> p = new LinkedHashMap<>();
      p.put("address", addr.length() == 0 ? root.path("display_name").asText(null) : addr.toString());
      p.put("locality", area.isBlank() ? town : area);
      p.put("pincode", pin.isBlank() ? null : pin);
      return p;
    } catch (Exception e) {
      log.warn("Reverse geocoding failed: {}", e.getMessage());
      if (e instanceof InterruptedException) Thread.currentThread().interrupt();
      return null;
    }
  }

  private static String first(JsonNode a, String... keys) { for (String k : keys) { String v = a.path(k).asText(""); if (!v.isBlank()) return v; } return ""; }
  private static String join(String a, String b) { return (a.isBlank() ? "" : a + " ") + b; }

  private void throttle(String ip) {
    long now = System.currentTimeMillis();
    Deque<Long> q = hits.computeIfAbsent(ip == null ? "?" : ip, k -> new ArrayDeque<>());
    synchronized (q) {
      while (!q.isEmpty() && now - q.peekFirst() > 60_000) q.pollFirst();
      if (q.size() >= MAX_PER_MINUTE) throw new com.narayanix.dialoo.service.TooManyRequestsException("Too many location requests. Please wait a minute.", 60);
      q.addLast(now);
    }
    if (hits.size() > 5000) hits.entrySet().removeIf(e -> e.getValue().isEmpty());
  }
}
