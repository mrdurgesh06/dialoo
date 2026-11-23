# Dialoo Mobile Apps — Android + iOS (offline + automatic location)

Dono apps `apps/web` ke website code se bante hain; native shell `apps/mobile` me hai (Capacitor 8). Android project: `apps/mobile/android`, iOS project: `apps/mobile/ios`. App ID dono me `com.narayanix.dialoo`.

> **Honest note:** Maine yahan APK/AAB ya iOS build nahi banaya (yahan Android SDK/Xcode nahi hai). Web build, sync, icons, permissions aur Gradle/Xcode files taiyar hain; pehli build aapke PC/Mac par hogi. Koi error aaye to poora error bhej dijiye.

## Naya kya hai (v4.0)
| Feature | Kaise kaam karta hai |
|---|---|
| **App icon** | Blue background + white "D" (Uber/Rapido jaisa), Android adaptive icon + iOS icon + PWA icons, blue splash screen |
| **Automatic location** | App khulte hi GPS permission maangta hai → address padhta hai → sabse paas ka Dialoo city apne aap select karta hai. Header me "📍 Civil Lines, Sahaswan". Provider list **sabse paas wale pehle** (km ke saath). Checkout me "📍 Use current location", provider form me "shop location" |
| **Offline mode** | App ka UI phone me bundled hai (internet ke bina khulta hai). Pichhla dekha hua data (categories, providers, bookings, notifications) saved rehta hai aur offline dikhta hai, upar "📴 You are offline" ka notice |
| **App jaisa feel** | Android Back button (sheet band → peeche → Home par exit), haptic vibration booking par, tap animation, no text-selection/zoom, notch/status-bar safe area, iOS/Android dono par |
| **iOS** | Poora Xcode project (`apps/mobile/ios`), location permission text, privacy flags |

### Offline: kya chalta hai, kya nahi
- ✅ App khulna, home, pehle dekhe hue providers/categories/offers, "My bookings", booking details, notifications, saved addresses, last known location/city.
- ❌ Nayi booking, accept/reject, chat bhejna, OTP login, live updates — inke liye internet chahiye (app saaf message dikhata hai "You are offline…"). Offline booking queue jaan-boojhkar nahi banayi: galat/purani booking server par jana risky hai.
- Data saved rehta hai jab tak logout na karein (logout par user ka cached data hat jata hai).

### Location: kaise kaam karti hai
1. Phone GPS (Capacitor Geolocation) → latitude/longitude. Permission sirf "app use ke waqt".
2. Backend `GET /api/v1/geo/reverse` → address + sabse paas ka **launched city** (60 km ke andar). Agar aap Dialoo ke city se bahar ho to message aata hai.
3. Address ke liye free **OpenStreetMap Nominatim** use hota hai (sirf halke use ke liye). **Production me** apna Nominatim server ya LocationIQ/Google jaisa paid provider lagayein: backend env `GEO_NOMINATIM_URL` aur `GEO_USER_AGENT` (apna email daalein). Internet na ho / geocoder band ho to bhi city GPS se mil jati hai, bas street address nahi aata.
4. Providers apni shop ki location "Become a provider" form me save kar sakte hain; location wale providers distance ke saath dikhte hain.
5. Emulator me location test: Android Studio → emulator ke `⋮` → *Location* → point set karein (Sahaswan ≈ 28.073, 78.753).

## Backend settings (dono apps ke liye)
```powershell
# CORS: website + Android + iOS origins (comma, bina space)
$env:FRONTEND_ORIGIN="http://localhost:5173,http://localhost,https://localhost,capacitor://localhost"
$env:GEO_USER_AGENT="Dialoo/4.0 (aapka-email@example.com)"
```
Production me `https://localhost,capacitor://localhost,https://aapki-website.com`.

---
## A. ANDROID

### Ek baar ka setup
1. **Android Studio** install → SDK Manager me **Android 16 (API 36)** SDK Platform + Build-Tools. JDK 17/21, Node 20+.
2. `ANDROID_HOME` set karein (`C:\Users\<aap>\AppData\Local\Android\Sdk`) ya Android Studio me `apps/mobile/android` ek baar Open kar dein.

### Test (emulator/phone)
Emulator ke liye API address apne aap `http://10.0.2.2:8080/api/v1` set hota hai (emulator me `10.0.2.2` = aapka PC). Real phone: PC ka Wi-Fi IP daalein aur firewall me 8080 allow karein: `$env:VITE_API_BASE_URL="http://192.168.1.10:8080/api/v1"` set karke build chalayein.
```powershell
cd apps\mobile
.\build-android.ps1 -Target emulator
```
APK: `apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk` (emulator par drag-drop, ya `adb install`). Ya Android Studio se: `npm run android:sync:dev` → `npm run android:open` → ▶.

### Play Store release
1. Backend ko **HTTPS domain** par host karein (release app http block karti hai).
2. `apps/web/.env.production.example` → `apps/web/.env.production`: `VITE_API_BASE_URL=https://api.yourdomain.com/api/v1` (HTTPS zaroori; localhost/placeholder par build rok di jati hai)
3. Keystore (ek baar, **backup rakhein**):
   ```powershell
   cd apps\mobile\android
   keytool -genkeypair -v -keystore dialoo-release.jks -alias dialoo -keyalg RSA -keysize 2048 -validity 10000
   ```
   `apps/mobile/android/keystore.properties`:
   ```
   storeFile=dialoo-release.jks
   storePassword=...
   keyAlias=dialoo
   keyPassword=...
   ```
4. `cd apps\mobile; .\build-android.ps1 -Target release-aab` → `app-release.aab` Play Console me upload. Har upload par `android/gradle.properties` me `DIALOO_VERSION_CODE` +1.
5. Play Console: Privacy Policy URL (location + phone collect hota hai), Data safety form (**Approximate/Precise location**, phone number, name, messages), account deletion info, screenshots. Listing draft: `apps/mobile/play-store/listing.md`. Target SDK 36 (Aug-2026 rule) pehle se set hai.

---
## B. iOS (sirf Mac par build hota hai)

**Zaroori:** Mac + **Xcode 16+**, aur App Store ke liye **Apple Developer account (~$99/saal)**. Windows PC par iOS app nahi ban sakti. Mac na ho to: Mac kiraye par (MacinCloud), ya cloud build service (Codemagic / GitHub Actions macOS) — wo bhi Apple account maangti hain.

### Mac par steps
```bash
cd apps/mobile
./build-ios.sh simulator        # npm install + web build + sync + Xcode khulta hai
```
Xcode me: upar device me **iPhone Simulator** chunein → ▶ Run. (Simulator ke liye API address apne aap `http://localhost:8080/api/v1` set hota hai.)
Simulator me location: *Features → Location → Custom Location*.

### App Store release
1. Backend HTTPS par; `apps/web/.env.production` me https URL.
2. `./build-ios.sh release` → Xcode: target **App** → *Signing & Capabilities* → apni **Team** chunein (Bundle ID `com.narayanix.dialoo` ya apna).
3. Version/Build: Xcode General tab (Version 1.0, Build 1; har upload par Build +1).
4. *Product → Archive* → *Distribute App → App Store Connect*.
5. App Store Connect: privacy policy URL, App Privacy (Location, Contact info), screenshots, review notes me **demo login** (OTP login hai, reviewer ke liye test number+OTP ka tareeqa batana hoga).
- Apple aksar "sirf website ka wrapper" apps ko reject karta hai (Guideline 4.2). Aapka app offline data, location, haptics, native back/splash use karta hai — review notes me ye native features likhein.

---
## Troubleshooting
- **`SDK location not found`**: `ANDROID_HOME` ya `android/local.properties` me `sdk.dir=C\:\\Users\\<aap>\\AppData\\Local\\Android\\Sdk`.
- **App me "No internet / Network problem"**: dev API URL (`10.0.2.2:8080`), backend chal raha hai?, `FRONTEND_ORIGIN` me `http://localhost` hai?
- **Release me login nahi**: API https hona chahiye aur `FRONTEND_ORIGIN` me `https://localhost` (Android) / `capacitor://localhost` (iOS).
- **Location nahi mil rahi**: phone me Location ON, app ko permission; emulator me location point set karein. Header ka 📍 dabakar "Use my current location" dobara try karein.
- **Address nahi aata par city aati hai**: geocoder (Nominatim) ne rate-limit ya internet issue; production me apna geocoder lagayein.
- **iOS `Package.swift` plugin path error**: pehle `npm install` chalayein (iOS plugins `node_modules` se aate hain).
- **Web code badla**: dobara `apps/mobile` se `.\build-android.ps1 ...` / `npm run ios:sync` chalayein (web build + copy automatic).
- Admin console app me nahi hai (sirf website `/admin`), jaan-boojhkar.
