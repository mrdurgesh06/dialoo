package com.narayanix.dialoo.controller;

import com.narayanix.dialoo.service.CurrentUser;
import com.narayanix.dialoo.tracking.IngestResult;
import com.narayanix.dialoo.tracking.LocationUpdate;
import com.narayanix.dialoo.tracking.TrackingSessionService;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Live tracking over HTTPS. WebSocket/STOMP is the primary transport (see TrackingSocketController); these endpoints are the
 * fallback for the partner app and the polling fallback for customers. Both transports share ONE pipeline (TrackingSessionService),
 * so a fix delivered twice (socket + HTTP) is processed once.
 *
 *   POST /bookings/{id}/location            legacy path used by the previous app version (kept)
 *   POST /bookings/{id}/tracking/location   partner GPS fix (HTTPS fallback)
 *   POST /bookings/{id}/tracking/start      create or resume the tracking session (idempotent)
 *   GET  /bookings/{id}/tracking            full state for the customer / partner screen (restores state after a reconnect)
 *   POST /bookings/{id}/tracking/arrive     partner confirms arrival (geofence checked on the server; ?manual=true skips the geofence and is recorded as ARRIVED_MANUAL; idempotent)
 *   POST /bookings/{id}/tracking/stop       partner stops sharing; the booking itself is untouched (idempotent)
 *   GET  /tracking/config                   client-side tunables (intervals, radii, debounce)
 */
@RestController @RequestMapping("/api/v1")
public class TrackingController {
  private final JdbcTemplate db; private final CurrentUser me; private final TrackingSessionService sessions;
  public TrackingController(JdbcTemplate db, CurrentUser me, TrackingSessionService sessions) { this.db = db; this.me = me; this.sessions = sessions; }

  @PostMapping({"/bookings/{id}/location", "/bookings/{id}/tracking/location"})
  public IngestResult ping(@PathVariable long id, @RequestBody LocationUpdate body, Authentication a) {
    requirePartner(a);
    long now = System.currentTimeMillis();
    // Older app versions send no sequence number: use arrival time so ordering and duplicate protection still work.
    LocationUpdate u = new LocationUpdate(id, body.trackingSessionId(), body.latitude(), body.longitude(), body.accuracy(), body.speed(), body.heading(),
      body.timestamp(), body.sequenceNumber() == null ? now : body.sequenceNumber());
    return sessions.ingest(id, me.id(a), u);
  }

  @PostMapping("/bookings/{id}/tracking/start")
  public Map<String, Object> start(@PathVariable long id, Authentication a) {
    requirePartner(a);
    long uid = me.id(a);
    List<Map<String, Object>> r = db.queryForList("SELECT b.status FROM bookings b JOIN providers p ON p.id=b.provider_id WHERE b.id=? AND p.user_id=?", id, uid);
    if (r.isEmpty()) throw new IllegalArgumentException("Booking not found or access denied");
    if (!"ON_THE_WAY".equals(r.get(0).get("status"))) throw new IllegalArgumentException("Tap “I am on the way” first; live location starts with the journey.");
    sessions.start(id);
    return sessions.snapshot(id, uid, false);
  }

  @GetMapping("/bookings/{id}/tracking")
  public Map<String, Object> tracking(@PathVariable long id, Authentication a) {
    // Staff do not use this endpoint: admin access goes through /admin/tracking, which is permission-checked and audited.
    return sessions.snapshot(id, me.id(a), false);
  }

  @PostMapping("/bookings/{id}/tracking/arrive")
  public Map<String, Object> arrive(@PathVariable long id, @RequestParam(defaultValue = "false") boolean manual, Authentication a) { requirePartner(a); return sessions.arrive(id, me.id(a), manual); }

  @PostMapping("/bookings/{id}/tracking/stop")
  public Map<String, Object> stop(@PathVariable long id, Authentication a) { requirePartner(a); sessions.stop(id, me.id(a), false); return Map.of("stopped", true); }

  @GetMapping("/tracking/config")
  public Map<String, Object> config() { return sessions.clientConfig(); }

  private void requirePartner(Authentication a) {
    if (!"PROVIDER".equals(me.actor(a))) throw new IllegalArgumentException("Only a Dialoo Partner session can do this.");
  }
}
