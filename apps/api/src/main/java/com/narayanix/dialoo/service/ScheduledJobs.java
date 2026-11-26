package com.narayanix.dialoo.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ScheduledJobs {
  private static final Logger log = LoggerFactory.getLogger(ScheduledJobs.class);
  private final BookingService bookings; private final JdbcTemplate db;
  public ScheduledJobs(BookingService bookings, JdbcTemplate db) { this.bookings = bookings; this.db = db; }

  @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
  public void expireBookings() {
    try { int n = bookings.expireStale(); if (n > 0) log.info("Expired {} unanswered booking request(s)", n); }
    catch (RuntimeException e) { log.warn("Booking expiry job failed: {}", e.getMessage()); }
  }

  /** Subscription renewal scan (SRS 31): lapsed periods move to PAST_DUE. Grace-period handling is admin-configurable later. */
  @Scheduled(cron = "0 15 2 * * *")
  public void subscriptions() {
    try {
      int n = db.update("UPDATE provider_subscriptions SET status='PAST_DUE', updated_at=UTC_TIMESTAMP() WHERE status IN ('TRIAL','ACTIVE') AND current_period_end<UTC_TIMESTAMP()");
      if (n > 0) log.info("{} subscription(s) moved to PAST_DUE", n);
    } catch (RuntimeException e) { log.warn("Subscription job failed: {}", e.getMessage()); }
  }

  @Scheduled(cron = "0 30 3 * * *")
  public void cleanup() {
    try {
      db.update("DELETE FROM otp_verifications WHERE created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 DAY)");
      db.update("DELETE FROM login_attempts WHERE created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)");
      db.update("DELETE FROM admin_sessions WHERE expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)");
    } catch (RuntimeException e) { log.warn("Cleanup job failed: {}", e.getMessage()); }
  }
}
