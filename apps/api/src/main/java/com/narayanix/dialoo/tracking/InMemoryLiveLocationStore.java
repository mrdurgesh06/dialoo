package com.narayanix.dialoo.tracking;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/** Thread-safe single-instance implementation. State is rebuilt lazily from booking_tracking after a restart. */
@Component
public class InMemoryLiveLocationStore implements LiveLocationStore {
  private final Map<Long, LocationGuard.Fix> fixes = new ConcurrentHashMap<>();
  @Override public LocationGuard.Fix get(long bookingId) { return fixes.get(bookingId); }
  @Override public void put(long bookingId, LocationGuard.Fix fix) { fixes.put(bookingId, fix); }
  @Override public void remove(long bookingId) { fixes.remove(bookingId); }
  @Override public Set<Long> activeBookingIds() { return Set.copyOf(fixes.keySet()); }
}
