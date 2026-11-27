package com.narayanix.dialoo.controller;

import com.narayanix.dialoo.tracking.IngestResult;
import com.narayanix.dialoo.tracking.LocationUpdate;
import com.narayanix.dialoo.tracking.TrackingSessionService;
import com.narayanix.dialoo.tracking.WsUser;
import java.security.Principal;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

/** STOMP entry for partner GPS fixes: SEND /app/tracking/location. Acks and errors go back only to the sending session. */
@Controller
public class TrackingSocketController {
  private final TrackingSessionService sessions;
  public TrackingSocketController(TrackingSessionService sessions) { this.sessions = sessions; }

  @MessageMapping("/tracking/location")
  @SendToUser(destinations = "/queue/tracking", broadcast = false)
  public IngestResult location(LocationUpdate update, Principal principal) {
    if (!(principal instanceof WsUser user)) throw new IllegalArgumentException("Not authenticated");
    if (update == null || update.bookingId() == null) throw new IllegalArgumentException("bookingId is required");
    return sessions.ingest(update.bookingId(), user.userId(), update);   // partner identity = JWT principal, never the payload
  }

  @MessageExceptionHandler
  @SendToUser(destinations = "/queue/errors", broadcast = false)
  public Map<String, Object> onError(Exception e) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("error", e instanceof IllegalArgumentException ? e.getMessage() : "Could not process the location update");
    return m;
  }
}
