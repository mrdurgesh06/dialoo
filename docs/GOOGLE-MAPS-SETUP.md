# Google Maps Platform – setup, keys, costs

## 1. What Dialoo uses, and which key
| Feature | API | Called from | Key |
|---|---|---|---|
| Maps (tracking, picker, admin) | Maps JavaScript API | browser / Capacitor WebView | **Browser key** |
| Address search | Places API (New) – Autocomplete + Place Details (`location` field only) | browser | **Browser key** |
| Reverse geocoding | Geocoding API | **our server** (`GET /geo/reverse`) | **Server key** |
| Route, distance, ETA | Routes API – `computeRoutes` | **our server** | **Server key** |

The Android/iOS apps are a Capacitor WebView, so the **map runs in the web layer**: no Maps SDK for Android / iOS and no native keys are needed.
Enable only the four APIs above.

## 2. Create the keys (Google Cloud Console → APIs & Services → Credentials)
1. Create a project, **enable billing**, enable: Maps JavaScript API, Places API (New), Geocoding API, Routes API.
2. **Browser key** → Application restriction *Websites*: your site origins (`https://dialoo.example/*`) **and `https://localhost/*`** (Capacitor Android) and `capacitor://localhost/*` (iOS). API restriction: Maps JavaScript API + Places API (New). Put it in `VITE_GOOGLE_MAPS_API_KEY` (build time).
3. **Server key** → API restriction: Routes API + Geocoding API. If your host has fixed egress IPs, add an IP restriction (Render free instances do not have a fixed IP – then rely on the API restriction and quotas). Put it in `GOOGLE_MAPS_SERVER_API_KEY` on the API service only.
4. **Map ID**: Google Maps Platform → Map Management → create a *JavaScript / Vector* map ID → `VITE_GOOGLE_MAP_ID` (advanced markers need it; `DEMO_MAP_ID` is for development only).
5. **Budget + alerts**: Billing → Budgets & alerts (e.g. 50 / 90 / 100 %). **Quotas**: APIs & Services → each API → Quotas → set a per-day cap lower than your budget; this is the hard stop for the *browser* calls, which our server cannot count.

## 3. Cost controls built into the code
* **Routes API is never called per GPS fix.** First route when the journey starts, then every `TRACKING_ROUTES_REFRESH_SECONDS` (300 s), or earlier only when the partner leaves the route by `TRACKING_ROUTE_DEVIATION_METERS` (150 m), never more often than `TRACKING_ROUTES_MIN_GAP_SECONDS` (30 s). Between calls, distance and ETA are computed locally from the cached polyline.
* `TRACKING_ROUTES_PREFERENCE=TRAFFIC_UNAWARE` is the lowest-cost tier; `TRAFFIC_AWARE` is billed at a higher tier – it is never enabled silently.
* Field mask on every Routes call asks only for duration, distance and polyline.
* Hard daily caps in the server: `TRACKING_ROUTES_DAILY_LIMIT`, `GEOCODE_DAILY_LIMIT` (persisted in `maps_api_usage`, survive restarts). Over the cap, or on any Google error/quota/invalid key, a 60-second circuit breaker switches to straight-line estimates, so tracking never breaks.
* One map instance per screen (markers move, map is not rebuilt) → one *Map load* per screen visit. Camera does not follow constantly.
* Autocomplete: ≥3 characters, 400 ms debounce, one **session token** per search, Place Details asks for `location` only. Reverse geocoding only when the map goes idle after the user moved it, results cached in memory for one hour.
* Nearby partners use SQL bounding box + Haversine – no Google calls.

## 4. Estimating cost (do this with Google's current calculator)
Prices and free usage caps change; **verify on https://mapsplatform.google.com/pricing/ before launch** (this repo does not hard-code prices).
Per journey of ~25 min: Routes ≈ 1 initial + 5 refreshes + a few deviations ≈ **6–10 Routes calls**; Maps JS ≈ 1 map load per customer screen visit + 1 for the partner; Geocoding ≈ 1 per address pick. Monthly cost ≈ (journeys × 8 × Routes price) + (map loads × Dynamic Maps price) + (autocomplete sessions × session price). The admin page shows server-side call counts for the last 7 days (`maps_api_usage`); the browser-side counts are in Cloud Console → APIs & Services → Metrics.

## 5. Licensing notes
Google imagery/attribution is displayed by the SDK – do not hide it. Routes/polylines are kept **in memory only** and dropped when the journey ends; only `place_id` and the customer's own chosen coordinates are stored (allowed). Do not store geocoder results beyond that.
