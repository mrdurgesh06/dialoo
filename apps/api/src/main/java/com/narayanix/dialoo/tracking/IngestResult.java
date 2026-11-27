package com.narayanix.dialoo.tracking;

/** Outcome of one location update. result: ACCEPTED | DUPLICATE | OUT_OF_ORDER | RATE_LIMITED (invalid fixes throw IllegalArgumentException instead). */
public record IngestResult(String result, Long sessionId, Long lastSeq, Double distanceMeters, boolean withinArrivalRadius) {}
