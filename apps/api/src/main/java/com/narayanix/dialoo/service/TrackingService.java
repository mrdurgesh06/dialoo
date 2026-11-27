package com.narayanix.dialoo.service;

import com.narayanix.dialoo.tracking.MapsUsageMeter;
import com.narayanix.dialoo.tracking.RouteMath;
import com.narayanix.dialoo.tracking.TrackingProperties;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Route + ETA between the partner and the consumer's address using the Google Routes API (computeRoutes).
 *
 * Cost control: GPS updates NEVER call Google. A route is (re)computed only
 *   - once when the journey starts (no cached route yet),
 *   - every {@code routes-refresh-seconds} (default 5 min),
 *   - immediately when the partner leaves the route by more than {@code route-deviation-meters}, but never more often than
 *     {@code routes-min-gap-seconds},
 *   - when the destination changes.
 * Between recalculations the remaining distance and ETA are derived locally from the cached polyline (see RouteMath.progress).
 * A hard daily cap ({@code routes-daily-limit}) and a short circuit breaker after failures fall back to a straight-line estimate
 * (source = "estimate"), so tracking keeps working when Google is unavailable, over quota or the key is invalid.
 * Routes stay in memory only and are forgotten when the journey ends (Google Maps Platform caching terms).
 */
@Service
public class TrackingService {
  private static final Logger log = LoggerFactory.getLogger(TrackingService.class);
  private static final String ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
  private static final String FIELD_MASK = "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline";
  public static final String API = "ROUTES_COMPUTE";
  private static final long BREAKER_MS = 60_000;

  public record Route(List<double[]> coordinates, double distanceMeters, double durationSeconds, String source,
                      long computedAt, double fromLat, double fromLng, double toLat, double toLng) {}

  private final String apiKey; private final TrackingProperties cfg; private final MapsUsageMeter meter;
  private final RestClient client;
  private final Map<Long, Route> cache = new ConcurrentHashMap<>();
  private volatile long googleBlockedUntil = 0; private volatile long lastWarn = 0;

  public TrackingService(@Value("${app.maps.server-api-key:}") String apiKey, TrackingProperties cfg, MapsUsageMeter meter) {
    this.apiKey = apiKey == null ? "" : apiKey.trim(); this.cfg = cfg; this.meter = meter;
    SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
    f.setConnectTimeout(2_000); f.setReadTimeout(4_000);
    this.client = RestClient.builder().requestFactory(f).build();
  }

  public Route cached(long bookingId) { return cache.get(bookingId); }
  public void forget(long bookingId) { cache.remove(bookingId); }

  /** True when a new route must be computed now. Cheap: no I/O. */
  public boolean due(long bookingId, double lat, double lng, double toLat, double toLng, long now) {
    Route c = cache.get(bookingId);
    if (c == null || !same(c.toLat(), toLat) || !same(c.toLng(), toLng)) return true;
    long age = now - c.computedAt();
    if (age >= cfg.getRoutesRefreshSeconds() * 1000L) return true;
    if (age < cfg.getRoutesMinGapSeconds() * 1000L) return false;
    if ("estimate".equals(c.source())) return googleAvailable(now);   // try to upgrade an estimate once Google is usable again
    RouteMath.Progress p = RouteMath.progress(c.coordinates(), lat, lng);
    return p != null && p.offRouteMeters() > cfg.getRouteDeviationMeters();
  }

  /** Legacy entry point (kept for compatibility): cached route unless it is due. */
  public Route route(long bookingId, double fromLat, double fromLng, double toLat, double toLng) {
    long now = System.currentTimeMillis();
    return due(bookingId, fromLat, fromLng, toLat, toLng, now) ? compute(bookingId, fromLat, fromLng, toLat, toLng) : cache.get(bookingId);
  }

  /** Always computes a fresh route (Google, else estimate) and caches it. Blocking: call from a worker thread, not the WebSocket thread. */
  public Route compute(long bookingId, double fromLat, double fromLng, double toLat, double toLng) {
    long now = System.currentTimeMillis();
    Route r = fromGoogle(fromLat, fromLng, toLat, toLng, now);
    if (r == null) r = estimate(fromLat, fromLng, toLat, toLng, now);
    cache.put(bookingId, r);
    if (cache.size() > 2000) cache.entrySet().removeIf(e -> now - e.getValue().computedAt() > 3_600_000);
    return r;
  }

  private boolean googleAvailable(long now) { return !apiKey.isBlank() && now >= googleBlockedUntil; }

  @SuppressWarnings("unchecked")
  private Route fromGoogle(double fromLat, double fromLng, double toLat, double toLng, long now) {
    if (!googleAvailable(now)) return null;
    if (!meter.tryAcquire(API, cfg.getRoutesDailyLimit())) { warnOnce("Google Routes daily cap reached - using straight-line estimates until 00:00 UTC"); return null; }
    try {
      Map<String, Object> body = new LinkedHashMap<>();
      body.put("origin", Map.of("location", Map.of("latLng", Map.of("latitude", fromLat, "longitude", fromLng))));
      body.put("destination", Map.of("location", Map.of("latLng", Map.of("latitude", toLat, "longitude", toLng))));
      String mode = "TWO_WHEELER".equalsIgnoreCase(cfg.getRoutesTravelMode()) ? "TWO_WHEELER" : "DRIVE";
      body.put("travelMode", mode);
      // routingPreference is only sent for DRIVE. TRAFFIC_UNAWARE is the lowest-cost tier; TRAFFIC_AWARE is billed at a higher tier.
      if (mode.equals("DRIVE")) body.put("routingPreference", "TRAFFIC_AWARE".equalsIgnoreCase(cfg.getRoutesPreference()) ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE");
      body.put("units", "METRIC");
      Map<String, Object> res = client.post().uri(ROUTES_URL).contentType(MediaType.APPLICATION_JSON)
        .header("X-Goog-Api-Key", apiKey).header("X-Goog-FieldMask", FIELD_MASK).body(body).retrieve().body(Map.class);
      List<Map<String, Object>> routes = res == null ? null : (List<Map<String, Object>>) res.get("routes");
      if (routes == null || routes.isEmpty()) { meter.failed(API); return null; }   // e.g. no drivable route: estimate instead
      Map<String, Object> r0 = routes.get(0);
      double dist = ((Number) r0.get("distanceMeters")).doubleValue();
      double secs = Double.parseDouble(String.valueOf(r0.get("duration")).replace("s", ""));
      String enc = (String) ((Map<String, Object>) r0.get("polyline")).get("encodedPolyline");
      List<double[]> pts = RouteMath.thin(RouteMath.decodePolyline(enc), 500);
      List<double[]> rounded = new ArrayList<>(pts.size());
      for (double[] p : pts) rounded.add(new double[]{Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5});
      return new Route(rounded, dist, secs, "google", now, fromLat, fromLng, toLat, toLng);
    } catch (Exception e) {
      meter.failed(API);
      googleBlockedUntil = now + BREAKER_MS;   // invalid key, quota exceeded, timeout, outage: back off for a minute
      warnOnce("Google Routes request failed, using estimate for the next minute: " + e.getClass().getSimpleName() + " " + clip(e.getMessage()));
      return null;
    }
  }

  private Route estimate(double fromLat, double fromLng, double toLat, double toLng, long now) {
    double straight = RouteMath.haversine(fromLat, fromLng, toLat, toLng), road = straight * 1.3;
    double secs = road / (Math.max(5, cfg.getFallbackSpeedKmh()) / 3.6);
    return new Route(List.of(new double[]{fromLat, fromLng}, new double[]{toLat, toLng}), road, secs, "estimate", now, fromLat, fromLng, toLat, toLng);
  }

  private void warnOnce(String msg) { long n = System.currentTimeMillis(); if (n - lastWarn > 60_000) { lastWarn = n; log.warn(msg); } }
  private static String clip(String s) { return s == null ? "" : s.substring(0, Math.min(160, s.length())).replaceAll("key=[^&\\s]+", "key=***"); }
  private static boolean same(double a, double b) { return Math.abs(a - b) < 1e-6; }
}
