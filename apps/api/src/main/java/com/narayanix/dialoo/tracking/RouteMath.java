package com.narayanix.dialoo.tracking;

import java.util.ArrayList;
import java.util.List;

/** Pure geometry helpers (no Spring, no I/O): distances, Google encoded-polyline decoding, progress along a route, route deviation. */
public final class RouteMath {
  private RouteMath() {}

  public static final double EARTH_M = 6_371_000;

  public static double haversine(double lat1, double lon1, double lat2, double lon2) {
    double p1 = Math.toRadians(lat1), p2 = Math.toRadians(lat2), dp = Math.toRadians(lat2 - lat1), dl = Math.toRadians(lon2 - lon1);
    double a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  /** Bounding box [minLat, maxLat, minLng, maxLng] around a point for an index-friendly pre-filter before the exact distance maths. */
  public static double[] boundingBox(double lat, double lng, double radiusKm) {
    double dLat = Math.toDegrees(radiusKm * 1000 / EARTH_M);
    double dLng = Math.toDegrees(radiusKm * 1000 / (EARTH_M * Math.max(0.01, Math.cos(Math.toRadians(lat)))));
    return new double[]{lat - dLat, lat + dLat, lng - dLng, lng + dLng};
  }

  /** Decodes a Google encoded polyline (precision 1e5) into [lat, lng] pairs. Throws IllegalArgumentException on malformed input. */
  public static List<double[]> decodePolyline(String encoded) {
    List<double[]> out = new ArrayList<>();
    if (encoded == null) return out;
    int index = 0, lat = 0, lng = 0, n = encoded.length();
    while (index < n) {
      int[] r = new int[2];
      for (int k = 0; k < 2; k++) {
        int shift = 0, result = 0, b;
        do {
          if (index >= n) throw new IllegalArgumentException("Malformed polyline");
          b = encoded.charAt(index++) - 63;
          result |= (b & 0x1f) << shift; shift += 5;
        } while (b >= 0x20);
        r[k] = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
      }
      lat += r[0]; lng += r[1];
      out.add(new double[]{lat / 1e5, lng / 1e5});
    }
    return out;
  }

  /** Keeps at most {@code max} points (always the first and the last) so payloads stay small. */
  public static List<double[]> thin(List<double[]> pts, int max) {
    if (pts.size() <= max || max < 2) return pts;
    List<double[]> out = new ArrayList<>(max);
    double step = (pts.size() - 1) / (double) (max - 1);
    for (int i = 0; i < max - 1; i++) out.add(pts.get((int) Math.round(i * step)));
    out.add(pts.get(pts.size() - 1));
    return out;
  }

  /** Progress of a position along a route: metres still to travel along the line, and how far the position is from the line. */
  public record Progress(double remainingMeters, double offRouteMeters) {}

  public static Progress progress(List<double[]> route, double lat, double lng) {
    if (route == null || route.size() < 2) return null;
    double cosLat = Math.cos(Math.toRadians(lat)), mPerDegLat = Math.toRadians(1) * EARTH_M, mPerDegLng = mPerDegLat * cosLat;
    double px = lng * mPerDegLng, py = lat * mPerDegLat;
    int n = route.size();
    double[] seg = new double[n - 1];
    double total = 0;
    for (int i = 0; i < n - 1; i++) { seg[i] = haversine(route.get(i)[0], route.get(i)[1], route.get(i + 1)[0], route.get(i + 1)[1]); total += seg[i]; }
    double best = Double.MAX_VALUE, bestAlong = 0, cum = 0;
    for (int i = 0; i < n - 1; i++) {
      double ax = route.get(i)[1] * mPerDegLng, ay = route.get(i)[0] * mPerDegLat, bx = route.get(i + 1)[1] * mPerDegLng, by = route.get(i + 1)[0] * mPerDegLat;
      double dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      double t = len2 == 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      double cx = ax + t * dx, cy = ay + t * dy, d = Math.hypot(px - cx, py - cy);
      if (d < best) { best = d; bestAlong = cum + t * seg[i]; }
      cum += seg[i];
    }
    return new Progress(Math.max(0, total - bestAlong), best);
  }
}
