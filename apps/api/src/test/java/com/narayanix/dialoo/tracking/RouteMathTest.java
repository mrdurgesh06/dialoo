package com.narayanix.dialoo.tracking;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class RouteMathTest {
  /** Google's documented sample: _p~iF~ps|U_ulLnnqC_mqNvxq`@ -> (38.5,-120.2) (40.7,-120.95) (43.252,-126.453). */
  @Test void decodesGoogleSamplePolyline() {
    List<double[]> p = RouteMath.decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    assertEquals(3, p.size());
    assertEquals(38.5, p.get(0)[0], 1e-6); assertEquals(-120.2, p.get(0)[1], 1e-6);
    assertEquals(40.7, p.get(1)[0], 1e-6); assertEquals(-120.95, p.get(1)[1], 1e-6);
    assertEquals(43.252, p.get(2)[0], 1e-6); assertEquals(-126.453, p.get(2)[1], 1e-6);
  }

  @Test void malformedPolylineIsRejected() { assertThrows(IllegalArgumentException.class, () -> RouteMath.decodePolyline("_p~iF~ps|U_")); }

  @Test void haversineOneDegreeLatitudeIsAbout111Km() { assertEquals(111_195, RouteMath.haversine(0, 0, 1, 0), 300); }

  @Test void boundingBoxContainsPointsInsideRadius() {
    double[] bb = RouteMath.boundingBox(26.85, 80.95, 5);
    assertTrue(bb[0] < 26.85 && bb[1] > 26.85 && bb[2] < 80.95 && bb[3] > 80.95);
    double dNorth = RouteMath.haversine(26.85, 80.95, bb[1], 80.95);
    assertEquals(5000, dNorth, 60);
  }

  @Test void progressAlongStraightRoute() {
    List<double[]> route = List.of(new double[]{0, 0}, new double[]{0, 0.01}, new double[]{0, 0.02});   // ~2.2 km east
    RouteMath.Progress start = RouteMath.progress(route, 0, 0);
    assertEquals(2224, start.remainingMeters(), 15); assertEquals(0, start.offRouteMeters(), 1);
    RouteMath.Progress mid = RouteMath.progress(route, 0, 0.01);
    assertEquals(1112, mid.remainingMeters(), 15);
    RouteMath.Progress off = RouteMath.progress(route, 0.002, 0.01);   // ~222 m north of the line
    assertEquals(222, off.offRouteMeters(), 5);
  }

  @Test void progressNeedsTwoPoints() { assertNull(RouteMath.progress(List.of(new double[]{0, 0}), 0, 0)); }

  @Test void thinKeepsEndpoints() {
    List<double[]> pts = new java.util.ArrayList<>();
    for (int i = 0; i < 1000; i++) pts.add(new double[]{i, i});
    List<double[]> t = RouteMath.thin(pts, 100);
    assertEquals(100, t.size()); assertEquals(0, t.get(0)[0]); assertEquals(999, t.get(99)[0]);
  }
}
