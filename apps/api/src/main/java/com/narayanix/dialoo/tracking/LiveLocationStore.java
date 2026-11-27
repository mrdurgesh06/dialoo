package com.narayanix.dialoo.tracking;

import java.util.Set;

/**
 * Where the LATEST fix of every active journey lives. Today: in memory (single API instance). To scale out, add a Redis-backed
 * implementation of this interface (with a TTL and pub/sub fan-out) and select it with a property - no business logic changes.
 */
public interface LiveLocationStore {
  LocationGuard.Fix get(long bookingId);
  void put(long bookingId, LocationGuard.Fix fix);
  void remove(long bookingId);
  Set<Long> activeBookingIds();
}
