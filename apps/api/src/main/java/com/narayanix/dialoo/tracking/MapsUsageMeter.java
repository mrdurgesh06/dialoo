package com.narayanix.dialoo.tracking;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Counts every billable Google Maps Platform request made by the SERVER (Routes, Geocoding), enforces a hard daily cap per API and
 * persists the counters (maps_api_usage) so a restart cannot reset the cap. Browser-side calls (Maps JS loads, Places Autocomplete)
 * are billed to the web key and must be watched in Google Cloud Console (see docs/GOOGLE-MAPS-SETUP.md).
 */
@Component
public class MapsUsageMeter {
  private static final Logger log = LoggerFactory.getLogger(MapsUsageMeter.class);
  private static final class Counter { LocalDate day; long calls, failures, flushedCalls, flushedFailures; }

  private final JdbcTemplate db;
  private final Map<String, Counter> counters = new ConcurrentHashMap<>();
  public MapsUsageMeter(JdbcTemplate db) { this.db = db; }

  /** Reserves one request. Returns false when the configured daily cap for this API is already used up. */
  public boolean tryAcquire(String api, int dailyLimit) {
    Counter c = counter(api);
    synchronized (c) {
      rollover(c, api);
      if (c.calls >= dailyLimit) return false;
      c.calls++;
      return true;
    }
  }

  public void failed(String api) { Counter c = counter(api); synchronized (c) { rollover(c, api); c.failures++; } }

  public long callsToday(String api) { Counter c = counter(api); synchronized (c) { rollover(c, api); return c.calls; } }

  private Counter counter(String api) { return counters.computeIfAbsent(api, a -> { Counter c = new Counter(); c.day = today(); loadBaseline(c, a); return c; }); }
  private void rollover(Counter c, String api) { LocalDate t = today(); if (!t.equals(c.day)) { flushOne(api, c); c.day = t; c.calls = c.failures = c.flushedCalls = c.flushedFailures = 0; loadBaseline(c, api); } }
  private static LocalDate today() { return LocalDate.now(ZoneOffset.UTC); }

  private void loadBaseline(Counter c, String api) {
    try {
      List<Map<String, Object>> r = db.queryForList("SELECT calls, failures FROM maps_api_usage WHERE usage_day=? AND api=?", java.sql.Date.valueOf(c.day), api);
      if (!r.isEmpty()) { c.calls = c.flushedCalls = ((Number) r.get(0).get("calls")).longValue(); c.failures = c.flushedFailures = ((Number) r.get(0).get("failures")).longValue(); }
    } catch (RuntimeException e) { log.warn("Could not load Maps usage baseline: {}", e.getMessage()); }
  }

  private void flushOne(String api, Counter c) {
    long dc = c.calls - c.flushedCalls, df = c.failures - c.flushedFailures;
    if (dc <= 0 && df <= 0) return;
    try {
      db.update("INSERT INTO maps_api_usage(usage_day,api,calls,failures) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE calls=calls+VALUES(calls), failures=failures+VALUES(failures)", java.sql.Date.valueOf(c.day), api, dc, df);
      c.flushedCalls = c.calls; c.flushedFailures = c.failures;
    } catch (RuntimeException e) { log.warn("Could not persist Maps usage: {}", e.getMessage()); }
  }

  @Scheduled(fixedDelay = 60_000, initialDelay = 45_000)
  public void flush() { counters.forEach((api, c) -> { synchronized (c) { flushOne(api, c); } }); }

  /** Last N days (including today) for the admin usage panel. */
  public List<Map<String, Object>> usage(int days) {
    flush();
    return db.queryForList("SELECT usage_day AS day, api, calls, failures FROM maps_api_usage WHERE usage_day >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY) ORDER BY usage_day DESC, api", Math.max(1, Math.min(days, 31)) - 1);
  }
}
