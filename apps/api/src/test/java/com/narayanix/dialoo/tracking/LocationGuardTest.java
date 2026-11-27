package com.narayanix.dialoo.tracking;

import static org.junit.jupiter.api.Assertions.*;

import com.narayanix.dialoo.tracking.LocationGuard.Fix;
import com.narayanix.dialoo.tracking.LocationGuard.Verdict;
import org.junit.jupiter.api.Test;

class LocationGuardTest {
  private final TrackingProperties cfg = new TrackingProperties();
  private static final long NOW = 1_800_000_000_000L;

  private Fix fix(double lat, double lng, Double acc, long ts, long seq) { return new Fix(lat, lng, acc, 5.0, 90.0, ts, ts, seq); }

  @Test void firstValidFixIsAccepted() { assertEquals(Verdict.ACCEPT, LocationGuard.check(null, fix(26.85, 80.95, 10.0, NOW, 1), NOW, cfg).verdict()); }

  @Test void invalidCoordinatesRejected() {
    assertEquals(Verdict.REJECT, LocationGuard.check(null, fix(91, 80, 10.0, NOW, 1), NOW, cfg).verdict());
    assertEquals(Verdict.REJECT, LocationGuard.check(null, fix(10, 181, 10.0, NOW, 1), NOW, cfg).verdict());
    assertEquals(Verdict.REJECT, LocationGuard.check(null, fix(0, 0, 10.0, NOW, 1), NOW, cfg).verdict());
    assertEquals(Verdict.REJECT, LocationGuard.check(null, fix(Double.NaN, 80, 10.0, NOW, 1), NOW, cfg).verdict());
  }

  @Test void poorAccuracyRejected() { assertEquals(Verdict.REJECT, LocationGuard.check(null, fix(26.85, 80.95, 500.0, NOW, 1), NOW, cfg).verdict()); }

  @Test void staleAndFutureTimestampsRejected() {
    assertEquals(Verdict.REJECT, LocationGuard.check(null, fix(26.85, 80.95, 10.0, NOW - 10 * 60_000, 1), NOW, cfg).verdict());
    assertEquals(Verdict.REJECT, LocationGuard.check(null, fix(26.85, 80.95, 10.0, NOW + 5 * 60_000, 1), NOW, cfg).verdict());
  }

  @Test void duplicateAndOutOfOrderDetected() {
    Fix a = fix(26.85, 80.95, 10.0, NOW, 5);
    assertEquals(Verdict.DUPLICATE, LocationGuard.check(a, fix(26.8501, 80.9501, 10.0, NOW + 1000, 5), NOW + 1000, cfg).verdict());
    assertEquals(Verdict.OUT_OF_ORDER, LocationGuard.check(a, fix(26.8501, 80.9501, 10.0, NOW + 1000, 4), NOW + 1000, cfg).verdict());
    assertEquals(Verdict.OUT_OF_ORDER, LocationGuard.check(a, fix(26.8501, 80.9501, 10.0, NOW - 1000, 6), NOW + 1000, cfg).verdict());
    assertEquals(Verdict.DUPLICATE, LocationGuard.check(a, fix(26.85, 80.95, 10.0, NOW, 6), NOW, cfg).verdict());
  }

  @Test void unrealisticJumpRejectedButNormalDrivingAccepted() {
    Fix a = fix(26.85, 80.95, 10.0, NOW, 1);
    assertEquals(Verdict.REJECT, LocationGuard.check(a, fix(27.85, 80.95, 10.0, NOW + 10_000, 2), NOW + 10_000, cfg).verdict());   // ~111 km in 10 s
    assertEquals(Verdict.ACCEPT, LocationGuard.check(a, fix(26.8509, 80.95, 10.0, NOW + 10_000, 2), NOW + 10_000, cfg).verdict()); // ~100 m in 10 s
  }

  @Test void gpsNoiseInsideAccuracyCircleIsNotAJump() {
    Fix a = fix(26.85, 80.95, 90.0, NOW, 1);
    assertEquals(Verdict.ACCEPT, LocationGuard.check(a, fix(26.8525, 80.95, 90.0, NOW + 1000, 2), NOW + 1000, cfg).verdict());   // ~278 m but both fixes are +-90 m
  }

  @Test void smoothingHoldsPositionWhenStandingStill() {
    Fix prev = fix(26.85, 80.95, 20.0, NOW, 1);
    Fix jitter = new Fix(26.85003, 80.95002, 20.0, 0.2, null, NOW + 5000, NOW + 5000, 2);
    Fix s = LocationGuard.smooth(prev, jitter);
    assertEquals(prev.lat(), s.lat()); assertEquals(prev.lng(), s.lng()); assertEquals(2, s.seq());
    Fix moving = new Fix(26.8509, 80.95, 20.0, 8.0, 0.0, NOW + 5000, NOW + 5000, 3);
    assertSame(moving, LocationGuard.smooth(prev, moving));
  }
}
