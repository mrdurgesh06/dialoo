package com.narayanix.dialoo.tracking;

/**
 * One GPS fix as sent by the partner app (WebSocket frame or HTTPS fallback - identical payload).
 * The partner identity is NEVER taken from this payload; it always comes from the authenticated JWT principal.
 * sequenceNumber must grow strictly within a tracking session; the app uses a monotonic millisecond counter so it survives app restarts.
 */
public record LocationUpdate(Long bookingId, Long trackingSessionId, Double latitude, Double longitude, Double accuracy, Double speed,
                             Double heading, Long timestamp, Long sequenceNumber) {}
