# Dialoo — Local Development Guide

Java 21 + Spring Boot 3.4 + MySQL 8 (Flyway) API (`apps/api`), React 18 + Vite website (`apps/web`), Capacitor mobile shell (`apps/mobile`).
Customer app: `http://localhost:5173` · Admin console: `http://localhost:5173/admin` · API: `http://localhost:8080`

Kya naya hai: `CHANGELOG.md`. Admin ke kaam (forgot password, naya admin banana, locations, ₹99 fee): **`ADMIN-GUIDE.md`**.

## Zaroori software
Java 21, Maven 3.9+, MySQL 8.x, Node.js 20+ (npm).

## Step 1 — Project kholein
Repo ko chhote path me rakhein, jaise `C:\dialoo`. Andar `apps\api`, `apps\web`, `apps\mobile` folder hone chahiye.

## Step 2 — MySQL database banayein (sirf pehli baar)
MySQL Workbench me ye SQL chalayein. Agar user pehle se hai to uska password niche `DB_PASSWORD` me wahi rakhein.
```sql
CREATE DATABASE IF NOT EXISTS dialoo CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'dialoo'@'localhost' IDENTIFIED BY '<apna-local-db-password>';
GRANT ALL PRIVILEGES ON dialoo.* TO 'dialoo'@'localhost';
FLUSH PRIVILEGES;
```
**Purana database delete na karein.** Naye migrations (V4–V9) purane data ke upar apne aap lag jayenge (purani bookings/providers safe rehti hain).

## Step 3 — Backend chalayein (PowerShell terminal 1)
```powershell
cd C:\dialoo\apps\api
$env:DB_URL="jdbc:mysql://localhost:3306/dialoo?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=UTF-8"
$env:DB_USERNAME="dialoo"
$env:DB_PASSWORD="<apna-local-db-password>"   # zaroori hai, koi default nahi
$env:JWT_SECRET="local-dev-secret-change-this-to-a-long-random-secret-123456789"
$env:FRONTEND_ORIGIN="http://localhost:5173,http://localhost,https://localhost,capacitor://localhost"
$env:OTP_DEV_MODE="true"
$env:SMS_PROVIDER="log"
$env:ADMIN_PHONE="<apna-10-digit-mobile>"        # zaroori hai, koi default nahi
$env:ADMIN_PASSWORD="<kam se kam 12 characters ka password>"
$env:ADMIN_NAME="Dialoo Admin"
$env:GEO_USER_AGENT="Dialoo/4.0 (aapka-email@example.com)"
mvn spring-boot:run
```
Pehli baar start par Flyway apne aap V4 se V9, views aur demo data lagata hai. Terminal me "Started DialooApplication" aur `http://localhost:8080/api/v1/health` me `"status":"UP"` dikhna chahiye. Is terminal ko chalta rehne dein.

## Step 4 — Frontend chalayein (PowerShell terminal 2)
```powershell
cd C:\dialoo\apps\web
npm install
npm run dev
```
Browser me `http://localhost:5173` kholein.

## Step 5 — Poora flow test karein (booking → notification → admin)
Teen alag browser window/profile use karein (ya ek normal + ek incognito + ek aur).

1. **Customer:** `localhost:5173` → mobile number daalein → OTP screen par dikhne wala dev OTP daalein → Home par koi provider (jaise *Ramesh Electrical Works*) → **Book** → address daalein → **Place booking**. Booking tracking screen khul jayegi.
2. **Provider (demo):** doosri window me `localhost:5173` → mobile `9000000001` → dev OTP → neeche **Provider** tab → *New requests* me booking dikhegi, bell par notification aayegi → **Accept** → **I am on the way**. Customer ki screen 8 second me khud update hogi.
3. **Start code:** customer ki tracking screen par 4-digit *Start code* dikhta hai. Provider **Start work** dabakar wahi code daale → **Complete job** → amount → **Mark paid**.
4. **Admin:** teesri window me `localhost:5173/admin` → aapka `ADMIN_PHONE` + `ADMIN_PASSWORD` → **Continue** → OTP screen par dev OTP dikhega → **Sign in**. *Bookings* me ye booking live dikhegi, aur upar bell me har step ka notification.
5. **Customer** booking complete hone ke baad rating de sakta hai.

Demo provider mobiles: `9000000001` … `9000000020` (OTP login, koi password nahi).
Admin ke bell/notifications me booking placed, accepted, completed, cancelled, expired sab aate hain.

## Admin security — kya dhyan rakhein
- Admin login hamesha **password + OTP** se hota hai. `OTP_DEV_MODE=true` me OTP screen par dikhta hai; **production me `OTP_DEV_MODE=false` aur real SMS provider zaroori hai.**
- 5 galat password par account 15 minute ke liye lock. 20 minute inactivity par auto sign-out.
- `ADMIN_PASSWORD` ab har restart par overwrite nahi hota. Password badalna ho to ek baar `$env:ADMIN_RESET_PASSWORD="true"` ke saath backend chalayein.
- `ADMIN_PHONE` aur `ADMIN_PASSWORD` (12+ characters) **har environment me zaroori** hain (local me bhi); koi built-in admin login nahi hai. Set na ho to admin bootstrap skip ho jata hai.
- Roles: `SUPPORT` (bookings dekhna/cancel), `ADMIN` (providers, users, catalog, offers, broadcast, audit), `SUPER_ADMIN` (sab kuch, settings, staff roles, sessions). Naya staff banane ke liye user ko `/admin → Users` me role badlein.
- Pehli baar admin user bina SMS ke test karne ke liye local me dev OTP ka istemal hota hai; asli phone par SMS ke liye `SMS_PROVIDER=msg91` + `MSG91_AUTH_KEY` + `MSG91_TEMPLATE_ID` set karein (Twilio ke liye `SMS_PROVIDER=twilio`).

## Migrations (database)
Files: `apps/api/src/main/resources/db/migration/` (V1–V13 + `R__reporting_views.sql`), demo data `db/demo/`, undo scripts `db/rollback/`.
Check karne ke liye MySQL me:
```sql
USE dialoo;
SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;
```
Expected: 1 se 13, "reporting views", 9.1 aur 13.1 (demo) — sab `success = 1`.

Migration chain ko alag se test karne ke liye (mysql client chahiye): `./scripts/verify_migrations.sh -u root -p` — ye ek temporary database me sab files lagakar drop kar deta hai.
**Kabhi bhi V1–V13 files edit na karein.** Naya badlav hamesha naya `V14__...sql` file me likhein.

Production par demo data band karein: `FLYWAY_EXTRA_LOCATION=classpath:db/none`.

## Troubleshooting
- **`Migration checksum mismatch`**: kisi purani V1–V3 file ko edit kiya gaya hai. Original file wapas rakhein (is zip ki). Database ko manually na badlein.
- **`Could not resolve placeholder 'DB_PASSWORD'`**: `DB_PASSWORD` environment variable set nahi hai (ab koi default password nahi hai).
- **`Access denied for user 'dialoo'`**: `DB_PASSWORD` MySQL user ke password se match karein.
- **Port 8080/5173 busy**: purana process band karein ya `$env:PORT="8081"` set karein (website ke liye `apps/web/.env.local` me `VITE_API_BASE_URL=http://localhost:8081/api/v1`).
- **CORS error**: `FRONTEND_ORIGIN` wahi hona chahiye jis URL se frontend khul raha hai.
- **Providers list khali**: demo data na laga ho (`FLYWAY_EXTRA_LOCATION` set hai) — admin console me provider apply/approve karke test karein.
- **Admin "Invalid credentials"**: phone/password check karein; 5 galat attempts ke baad 15 minute rukna padta hai.
- Frontend build: `npm run build` · Backend tests: `mvn test`.

## Abhi jo kaam baaki hai (honest note)
- Online payment gateway (Razorpay) ka webhook abhi jodna baaki hai — booking payment abhi "service ke baad seedha provider ko" hai, paid subscription plan ka order bante hain par activate gateway verification ke baad hi hona chahiye.
- Push notifications (FCM), real SMS delivery, photo upload, map/GPS-based live location — schema (`device_tokens`, `file_assets`, `domain_events`) taiyar hai, integration baad me.
- Phase 2/3 modules (Agri equipment booking, rentals booking, projects milestones) ke tables ban gaye hain; unke APIs/screens agla step hain.

## Android app
Android + iOS app projects `apps/mobile/android` aur `apps/mobile/ios` me hain (Capacitor). Offline mode, automatic location, build, test aur Play Store / App Store ke poore steps: **`MOBILE-APP.md`** (is folder me).

## Internet par test link (Render)
Free test link banane ke steps: **`DEPLOY-RENDER.md`** (`render.yaml` repo ke root me aur `apps/api/Dockerfile` hai).
