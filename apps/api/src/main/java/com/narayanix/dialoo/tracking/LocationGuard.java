package com.narayanix.dialoo.tracking;

/**
 * Server-side validation of one GPS fix against the previous accepted fix. Pure and stateless so it is unit-testable.
 * It is a plausibility filter, not fraud proof: GPS can be spoofed, so the result is a quality signal, never proof of presence.
 */
public final class LocationGuard {
  private LocationGuard() {}

  public record Fix(double lat, double lng, Double accuracy, Double speed, Double heading, long deviceTs, long serverTs, long seq) {}
  public enum Verdict { ACCEPT, DUPLICATE, OUT_OF_ORDER, REJECT }
  public record Result(Verdict verdict, String reason) {
    static Result ok() { return new Result(Verdict.ACCEPT, null); }
    static Result of(Verdict v, String why) { return new Result(v, why); }
  }

  public static Result check(Fix prev, Fix next, long nowMs, TrackingProperties cfg) {
    if (!Double.isFinite(next.lat()) || !Double.isFinite(next.lng()) || next.lat() < -90 || next.lat() > 90 || next.lng() < -180 || next.lng() > 180
        || (next.lat() == 0 && next.lng() == 0)) return Result.of(Verdict.REJECT, "Invalid coordinates");
    if (next.accuracy() != null && (!(next.accuracy() >= 0) || next.accuracy() > cfg.getMaxAccuracyMeters())) return Result.of(Verdict.REJECT, "Location accuracy is too low");
    if (next.speed() != null && !(next.speed() >= 0 && next.speed() <= 200)) return Result.of(Verdict.REJECT, "Invalid speed");
    if (next.heading() != null && !(next.heading() >= 0 && next.heading() <= 360)) return Result.of(Verdict.REJECT, "Invalid heading");
    if (next.seq() <= 0) return Result.of(Verdict.REJECT, "Missing sequence number");
    if (next.deviceTs() > nowMs + cfg.getMaxFutureSkewSeconds() * 1000L) return Result.of(Verdict.REJECT, "Timestamp is in the future");
    if (next.deviceTs() < nowMs - cfg.getMaxFixAgeSeconds() * 1000L) return Result.of(Verdict.REJECT, "Location is too old");
    if (prev == null) return Result.ok();
    if (next.seq() == prev.seq()) return Result.of(Verdict.DUPLICATE, "Duplicate update");
    if (next.seq() < prev.seq() || next.deviceTs() < prev.deviceTs()) return Result.of(Verdict.OUT_OF_ORDER, "Out-of-order update");
    if (next.lat() == prev.lat() && next.lng() == prev.lng() && next.deviceTs() == prev.deviceTs()) return Result.of(Verdict.DUPLICATE, "Duplicate update");
    double dt = Math.max(1.0, (next.deviceTs() - prev.deviceTs()) / 1000.0);
    double d = RouteMath.haversine(prev.lat(), prev.lng(), next.lat(), next.lng());
    double slack = (prev.accuracy() == null ? 0 : prev.accuracy()) + (next.accuracy() == null ? 0 : next.accuracy());
    double effective = Math.max(0, d - slack);
    if (effective > 200 && effective / dt > cfg.getMaxSpeedMps()) return Result.of(Verdict.REJECT, "Unrealistic location jump");
    return Result.ok();
  }

  /** Holds the previous position while the device is practically standing still, so the marker does not jitter inside the GPS error circle. */
  public static Fix smooth(Fix prev, Fix next) {
    if (prev == null) return next;
    double d = RouteMath.haversine(prev.lat(), prev.lng(), next.lat(), next.lng());
    double radius = Math.max(5, next.accuracy() == null ? 5 : next.accuracy() * 0.5);
    boolean still = next.speed() == null || next.speed() < 0.8;
    if (still && d < radius) return new Fix(prev.lat(), prev.lng(), next.accuracy(), next.speed(), next.heading() != null ? next.heading() : prev.heading(), next.deviceTs(), next.serverTs(), next.seq());
    return next;
  }
}
