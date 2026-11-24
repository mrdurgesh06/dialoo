# Dialoo — changelog

## MSG91 real OTP login
- Customer OTP login via the **MSG91 OTP Widget** (headless, Dialoo's own 6-digit boxes). New `GET /auth/otp/config` and `POST /auth/otp/widget-verify`; the server re-verifies the widget JWT with the Authkey (`Msg91WidgetVerifier`) and logs in the mobile number MSG91 verified (single-use tokens). Enabled when `MSG91_WIDGET_ID`, `MSG91_TOKEN_AUTH`, `MSG91_AUTH_KEY` are set; otherwise the old local flow is unchanged. In widget mode the local `/otp/request` and `/otp/verify` are disabled.
- Optional `Msg91SmsSender` (`SMS_PROVIDER=msg91`, needs `MSG91_TEMPLATE_ID` from a DLT template) for server-side SMS (admin 2FA, forgot password). `SmsSender` gained `sendOtp(...)`; Twilio/log senders unchanged.

## Repository restructure + Render-ready (latest)
- Monorepo layout: `apps/api`, `apps/web`, `apps/mobile`, `docs`, `scripts`, `.github`. Capacitor (android/ios) moved out of the website into `apps/mobile` (webDir `../web/dist`).
- Web `src` is feature-based: `features/{auth,customer,provider,admin}`, `shared`, `styles`. Admin `pages.jsx`/`pages2.jsx` renamed to `OperationsPages.jsx`/`ManagementPages.jsx`; `customer/parts.jsx` moved to `shared/parts.jsx` (used by admin too).
- **Fix:** Flyway `locations` in `application.yml` was malformed (`classpath:db/none}`) so migrations could not be found. Now `classpath:db/migration` + `FLYWAY_EXTRA_LOCATION` (demo data).
- **Security:** removed the hardcoded database host/user/password and the built-in dev admin phone/password. `DB_PASSWORD`, `ADMIN_PHONE`, `ADMIN_PASSWORD` must now come from environment variables.
- `render.yaml`: repo-root relative Docker paths, `buildFilter`, region, `npm ci`, Node 20, security/cache headers for the static site. New `DB_POOL_SIZE` and `FLYWAY_EXTRA_LOCATION` variables.
- Dockerfile uses a stable jar name (`finalName` = `dialoo-api`). Added GitHub Actions CI, `.gitignore`, `.editorconfig`.
- Removed build output and IDE junk from the source tree (`target/`, `.gradle/`, duplicate logo, committed `.env.androiddev/.env.iosdev`).

## v2.0 — what changed

## 1. Booking → notification → admin (the main bug)
Before: bookings were only saved in the browser (localStorage) when no approved provider existed, so nothing reached the server, the provider or the admin.
Now:
- Real provider onboarding (`Become a provider` form → admin approval) and **8 demo providers** seeded for local testing.
- Every booking event (placed, accepted, rejected, on the way, started, completed, cancelled, expired, paid) notifies **customer + provider + all admin/support users** (bell icon, live toast, unread count, 12-second polling).
- Admin console has a live bookings table with detail view, timeline, cancel-with-reason and a "new booking" alert.
- Unanswered requests auto-expire (default 30 min) and everyone is told.

## 2. Admin security
- Sign-in is **password + OTP (2 steps)**. Customer login can never open admin.
- Lockout after 5 failed passwords (15 min), per-IP throttle, generic error messages, every attempt stored in `login_attempts`.
- Admin token is bound to a server-side session (`admin_sessions`): revocable, 30 min, auto-extended only while active, 20-minute idle sign-out, stored in sessionStorage (dies with the tab).
- Role is read from the database on every request, so disabling a user or changing a role takes effect immediately.
- Fine-grained permissions (`roles`, `permissions`, `role_permissions`): SUPPORT / ADMIN / SUPER_ADMIN see only what they may use.
- Audit log of every admin change; security page with sessions, sign-in attempts and audit trail.
- No built-in admin password outside dev mode; password is no longer overwritten on every restart.
- Security headers, 401 vs 403 handled correctly.

## 3. Zomato / Blinkit / Flipkart-style app
Home with city picker, live search suggestions, offer banners, categories with ETA, "Available right now", Top rated, Book again, offers/coupons, favourites, saved addresses, checkout with price breakup + coupon, live tracking with status steps, **start-code (PIN) check**, in-app chat, call button, reviews and provider replies, provider dashboard (accept/reject, on-the-way, start with code, complete with amount, mark paid, earnings, plans), Hindi/English.

## 4. Admin console
Overview (KPIs, 14-day chart, status breakdown, live bookings, top providers/categories), Bookings, Providers (approve/reject/suspend), Users (enable/disable, roles), Catalog (categories + services), Offers & banners, Emergencies, Broadcast notifications, Security & audit, Settings (feature flags, tax/fees, plans).

## 5. Database migrations (V1–V3 untouched)
| File | Purpose |
|---|---|
| V4 | State/district/city/locality hierarchy, services catalog, provider depth, provider services/hours/documents/verifications |
| V5 | Booking engine: codes, pricing breakdown, start code, timestamps, optimistic lock, quotations, chat, review replies/reports |
| V6 | Notification metadata, preferences, device tokens, domain-event outbox, broadcasts |
| V7 | Banners, coupons + redemptions, addresses, favourites, search log, payment orders/payments, invoices, subscription transactions |
| V8 | RBAC (roles/permissions), login attempts, admin sessions, audit JSON columns, system settings |
| V9 | Emergency, Agri equipment, rentals, project milestones, businesses, labour teams, file assets |
| R__reporting_views | Repeatable: `v_provider_search`, `v_admin_bookings`, `v_daily_booking_stats` |
| db/demo/V9_1 | Demo data (local only) |
| db/rollback/U* | Hand-written undo scripts (never run automatically) |

All migrations were applied on a real MySQL 8.0 database: fresh install and upgrade of a database that already had V1–V3 with data.

## v3.0 — Android app
Capacitor 8 Android project (`frontend/android`, target SDK 36), launcher icon + splash from the Dialoo logo, release signing, build scripts, `ANDROID-APP.md`, Play Store listing draft. Website behaviour unchanged.

## v4.0 — iOS, offline, automatic location, app-style polish
- New brand app icon (blue + white D), blue splash, Android adaptive icon, iOS icon set, PWA icons.
- iOS project (`frontend/ios`, Swift Package Manager, iOS 15+), location privacy strings, export-compliance flag.
- Automatic location: GPS → address → nearest launched city; nearest-first provider sorting with distance; "Use current location" in checkout and provider signup; backend `GET /api/v1/geo/reverse` (public, rate-limited, cached).
- Offline: bundled UI + saved GET data with offline banner; clear messages for actions that need internet.
- Native feel: Android back-button handling, haptics, safe areas, tap feedback, edge-to-edge system bars, Android 12+ splash.
- Provider apply accepts optional shop latitude/longitude. No database migration needed.

## v5.0 — Admin accounts, all Uttar Pradesh, more services, ₹99 fee
Migrations (each in its own file): V10 staff + password-reset support, V11 all 75 UP districts + cities + areas + streets, V12 30 new categories and ~150 services, V13 provider fee ₹99/month, demo V13_1 (12 more demo providers). V1–V9 untouched.
- Admin: Forgot password (mobile or email → OTP to registered mobile), first-login forced password change, create Admin / Super admin / Support from Users (one-time temporary password), reset staff password, Locations page (cities, areas, streets).
- Customer app: searchable city list (all UP), expandable category grid, street/area fallback for "my location".
- Android launcher icon rebuilt as a standard adaptive icon (round / squircle / themed-monochrome); Play Store icon + feature graphic in `play-store/`.

## v5.1 — Render deployment kit
`backend/Dockerfile`, `render.yaml` (Blueprint), `DEPLOY-RENDER.md`. No code changes.
