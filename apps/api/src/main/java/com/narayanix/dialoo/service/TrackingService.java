package com.narayanix.dialoo.service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Route + ETA between the provider and the customer's address using OpenRouteService (free API key).
 * Routes are cached per booking and recomputed only every ~45 s (or when the provider moved >150 m), and a daily
 * request cap keeps the free quota safe. When ORS is not configured, fails or the cap is reached, a straight-line
 * estimate (distance x 1.3 / average speed) is returned instead, flagged with source "estimate".
 */
@Service
public class TrackingService {
  private static final Logger log = LoggerFactory.getLogger(TrackingService.class);
  private static final String ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-car";
  private static final long REFRESH_MS = 45_000, ESTIMATE_REFRESH_MS = 20_000;
  private static final double MOVE_REFRESH_M = 150;

  public record Route(List<double[]> coordinates, double distanceMeters, double durationSeconds, String source,
                      long computedAt, double fromLat, double fromLng, double toLat, double toLng) {}

  private final String apiKey; private final int dailyLimit; private final double fallbackKmh;
  private final RestClient client = RestClient.builder().build();
  private final Map<Long, Route> cache = new ConcurrentHashMap<>();
  private final AtomicInteger usedToday = new AtomicInteger(); private volatile LocalDate usedDay = LocalDate.now(ZoneOffset.UTC);

  public TrackingService(@Value("${app.tracking.ors-api-key:}") String apiKey,
      @Value("${app.tracking.ors-daily-limit:1800}") int dailyLimit,
      @Value("${app.tracking.fallback-speed-kmh:25}") double fallbackKmh) {
    this.apiKey = apiKey.trim(); this.dailyLimit = dailyLimit; this.fallbackKmh = Math.max(5, fallbackKmh);
  }

  public Route route(long bookingId, double fromLat, double fromLng, double toLat, double toLng) {
    long now = System.currentTimeMillis();
    Route c = cache.get(bookingId);
    if (c != null && same(c.toLat, toLat) && same(c.toLng, toLng)) {
      long age = now - c.computedAt;
      boolean moved = haversine(c.fromLat, c.fromLng, fromLat, fromLng) > MOVE_REFRESH_M;
      long ttl = "ors".equals(c.source) ? REFRESH_MS : ESTIMATE_REFRESH_MS;
      if (age < ttl && !moved) return c;
      if (age < 8_000) return c; // never recompute more than once per 8 s, even when moving fast
    }
    Route r = fromOrs(fromLat, fromLng, toLat, toLng, now);
    if (r == null) r = estimate(fromLat, fromLng, toLat, toLng, now);
    cache.put(bookingId, r);
    if (cache.size() > 2000) cache.entrySet().removeIf(e -> now - e.getValue().computedAt > 3_600_000);
    return r;
  }

  public void forget(long bookingId) { cache.remove(bookingId); }

  private Route fromOrs(double fromLat, double fromLng, double toLat, double toLng, long now) {
    if (apiKey.isBlank() || !takeQuota()) return null;
    try {
      var uri = UriComponentsBuilder.fromUriString(ORS_URL).queryParam("start", fromLng + "," + fromLat).queryParam("end", toLng + "," + toLat).build().toUri();
      @SuppressWarnings("unchecked")
      Map<String, Object> res = client.get().uri(uri).header("Authorization", apiKey).accept(MediaType.APPLICATION_JSON, MediaType.valueOf("application/geo+json")).retrieve().body(Map.class);
      @SuppressWarnings("unchecked") Map<String, Object> f = (Map<String, Object>) ((List<?>) res.get("features")).get(0);
      @SuppressWarnings("unchecked") Map<String, Object> summary = (Map<String, Object>) ((Map<String, Object>) f.get("properties")).get("summary");
      @SuppressWarnings("unchecked") List<List<Number>> pts = (List<List<Number>>) ((Map<String, Object>) f.get("geometry")).get("coordinates");
      int step = Math.max(1, pts.size() / 400);
      List<double[]> coords = new ArrayList<>();
      for (int i = 0; i < pts.size(); i += step) coords.add(new double[]{round5(pts.get(i).get(1).doubleValue()), round5(pts.get(i).get(0).doubleValue())});
      List<Number> last = pts.get(pts.size() - 1); coords.add(new double[]{round5(last.get(1).doubleValue()), round5(last.get(0).doubleValue())});
      return new Route(coords, ((Number) summary.get("distance")).doubleValue(), ((Number) summary.get("duration")).doubleValue(), "ors", now, fromLat, fromLng, toLat, toLng);
    } catch (Exception e) {
      log.warn("OpenRouteService route failed, using estimate: {}", e.toString());
      return null;
    }
  }

  private Route estimate(double fromLat, double fromLng, double toLat, double toLng, long now) {
    double straight = haversine(fromLat, fromLng, toLat, toLng), road = straight * 1.3;
    double secs = road / (fallbackKmh / 3.6);
    return new Route(List.of(new double[]{fromLat, fromLng}, new double[]{toLat, toLng}), road, secs, "estimate", now, fromLat, fromLng, toLat, toLng);
  }

  private boolean takeQuota() {
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    if (!today.equals(usedDay)) { synchronized (this) { if (!today.equals(usedDay)) { usedDay = today; usedToday.set(0); } } }
    return usedToday.incrementAndGet() <= dailyLimit;
  }

  private static boolean same(double a, double b) { return Math.abs(a - b) < 1e-6; }
  private static double round5(double v) { return Math.round(v * 1e5) / 1e5; }
  static double haversine(double lat1, double lon1, double lat2, double lon2) {
    double r = 6371000, p1 = Math.toRadians(lat1), p2 = Math.toRadians(lat2), dp = Math.toRadians(lat2 - lat1), dl = Math.toRadians(lon2 - lon1);
    double a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
  }
}
