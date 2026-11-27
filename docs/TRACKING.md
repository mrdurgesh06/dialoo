# Live tracking & location – architecture, API, security (Dialoo v6)

## Flow
Partner phone → GPS (`locationWatch.js`) → paced (10 s moving / 30 s still, 15 m filter) → **STOMP `SEND /app/tracking/location`** (or HTTPS fallback, same payload) → `TrackingSessionService.ingest` (JWT principal, ownership, session, validation, duplicate/out-of-order/jump checks) → in-memory latest fix → broadcast `/topic/bookings/{id}/tracking` → customer map (marker glides). Database is written every 60 s + on transitions. Routes API is called only on start / every 5 min / on deviation.

## Journey lifecycle (booking statuses unchanged)
`ACCEPTED → ON_THE_WAY` (creates/resumes the **tracking session**, status `ACTIVE`) → partner taps **Arrived** inside 100 m with accuracy ≤ 75 m → session `ARRIVED`, live tracking stops, customer notified, booking stays `ON_THE_WAY` until the start code moves it to `IN_PROGRESS` (never automatic). Any other status change, cancel, manual stop, 8 h expiry, or reassignment ends the session (`end_reason`). "ARRIVED" is a session state, not a new booking status.

## HTTP API (prefix `/api/v1`)
| Method + path | Who | Notes |
|---|---|---|
| `POST /bookings/{id}/tracking/start` | partner | idempotent; returns state + `journey.sessionId`, `lastSeq`, `config` |
| `POST /bookings/{id}/tracking/location` (alias `/bookings/{id}/location`) | partner | body: `trackingSessionId, latitude, longitude, accuracy, speed, heading, timestamp, sequenceNumber` → `{result: ACCEPTED|DUPLICATE|OUT_OF_ORDER|RATE_LIMITED, distanceMeters, withinArrivalRadius}`; invalid fix → 400 |
| `GET /bookings/{id}/tracking` | customer / partner of that booking | full state; partner coordinates only while journey ACTIVE |
| `POST /bookings/{id}/tracking/arrive` | partner | geofence + accuracy checked server-side; idempotent |
| `POST /bookings/{id}/tracking/stop` | partner | stops sharing, booking untouched; idempotent |
| `GET /tracking/config` | any signed-in | client tunables |
| `POST /provider/location`, `GET /provider/location/status` | partner | presence while online (no journey); status = OFFLINE/AVAILABLE/BUSY/ON_THE_WAY/LOCATION_UNAVAILABLE |
| `GET /partners/nearby?lat&lng&radiusKm&categoryId|categorySlug&limit` | customer | default 5 km, max 20; **no coordinates in the response** |
| `GET/POST /me/addresses`, `PUT /me/addresses/{id}` | customer | structured fields + `latitude/longitude/placeId`; existing bookings keep their own address copy |
| `GET /admin/tracking/summary|sessions|partners`, `GET /admin/tracking/sessions/{bookingId}` | staff with `BOOKING_VIEW` | audited; lists rounded to ~11 m |

## WebSocket
`wss://<api>/ws/tracking` (STOMP 1.2, 10 s heartbeats). CONNECT needs header `Authorization: Bearer <access token>`. Allowed frames: `SUBSCRIBE /topic/bookings/{id}/tracking` (only the booking's customer or partner; staff are audited), `SUBSCRIBE /user/queue/tracking|errors`, `SEND /app/tracking/location` (partner sessions only, ≤12 frames / 10 s, token must be unexpired). Events: `location`, `route`, `started`, `arrived`, `ended`. Everything else is rejected by `StompAuthInterceptor`.
Fallback: if the socket is down the customer screen polls `GET /bookings/{id}/tracking` every 6 s; polling stops by itself when the socket reconnects, and the full state is refetched on every reconnect.

## Configuration
All tunables: `.env.example` (`TRACKING_*`, `NEARBY_*`, `GEOCODE_*`) → `application.yml` `app.tracking.*`.

## Security & privacy
Location is sensitive personal data. HTTPS/WSS only; JWT on every transport; partner identity = JWT principal (client `partnerId` is never read); customers see a partner only for their own booking while the journey is ACTIVE; unassigned partners' coordinates are never returned; `booking_tracking` row deleted when the journey ends; sampled history (`booking_location_history`) deleted after `TRACKING_HISTORY_RETENTION_DAYS` (7) by a nightly job; live positions are excluded from the app's offline cache; admin views audited (5-minute de-dup); coordinates are not written to application logs. GPS checks are plausibility filters, **not** proof against spoofing.

## Scaling
Single API instance today: `InMemoryLiveLocationStore`. For several instances implement `LiveLocationStore` with Redis (TTL + pub/sub) and replace the simple broker with a relay; no business-logic change is needed. **Not load-tested** – see the status report for what was and was not measured.

## Deploy
1. Set `GOOGLE_MAPS_SERVER_API_KEY` (API) and `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAP_ID` (web build). 2. Deploy API: Flyway applies `V16` (additive only). 3. Make sure `FRONTEND_ORIGIN` lists every web/app origin – it is also the WebSocket origin allow-list. 4. Render supports WebSockets on web services; the API must not sleep during journeys (free-tier spin-down drops sockets – use a paid instance for production).
