# Background location for the Partner app (Capacitor)

**Status: adapter implemented and tested only as far as a browser/Node can test it. The native plugin is NOT installed yet and nothing here has been run on a phone.**
Without the plugin the app still works: it uses `@capacitor/geolocation` (already installed) and shares location **while the app is open**.

## Plugin evaluation (written without network access – verify every "check" before choosing)
| Option | Licence / price | What I know | Check before adopting |
|---|---|---|---|
| `@capacitor-community/background-geolocation` | MIT, free | Simple `addWatcher` API (used by `src/shared/locationWatch.js`); Android foreground service with persistent notification; iOS background location; `distanceFilter`. No time-interval option – the app's own pacing handles the 10 s / 30 s rule. | **Does the current release declare support for Capacitor 8** (this project is on 8.6)? Check its `peerDependencies` and open issues. Last-release date / maintenance. |
| `@capgo/background-geolocation` | MIT, free | Actively released by the Capgo team, aimed at recent Capacitor majors. | Same checks; API differs slightly (adapter change needed in `locationWatch.js`). |
| Transistorsoft `capacitor-background-geolocation` | **Commercial** – per-app licence required for **release builds on Android** (iOS free in the open edition at the time of writing). | Most battle-tested: motion-detection, battery-aware, SQLite buffering, headless mode. | **Current price/licence terms on transistorsoft.com.** I am not adding it and nothing is purchased without your approval. |

**Recommendation:** try the free community plugin on a physical Android phone first. It satisfies the requirement *if* it supports Capacitor 8. If your tests show missed updates on aggressive-battery phones (Xiaomi/Oppo/Vivo/Samsung), the Transistorsoft licence is the upgrade path – decide after the test, with the real price in front of you.

## Enable (after you chose the plugin)
```
cd apps/mobile
npm install @capacitor-community/background-geolocation     # read its peer-dependency warnings
npx cap sync
node scripts/enable-background-location.mjs                  # adds Android permissions + iOS UIBackgroundModes (idempotent)
```
Android: the plugin shows the persistent notification with the title/message from `locationWatch.js` ("Dialoo Partner – Live location sharing is active for your current booking.").
iOS: configure the plugin's native setup as in its README; `Info.plist` strings are updated by the script.

## Google Play / App Store compliance (must be done by you)
* Play Console → App content → **Location permissions declaration** for `ACCESS_BACKGROUND_LOCATION`, with a short **video** showing the feature (partner journey) and the **prominent in-app disclosure**. The in-app text already says what/when/why (partner dashboard banner); add a one-time disclosure dialog before the first OS prompt if Play review asks for it.
* Core feature justification: customer-visible live arrival tracking of an assigned booking; location is shared **only** between "I am on the way" and arrival/cancel.
* iOS: App Store review needs the purpose strings (set) and a reason for "Location updates" background mode.

## Limits – do not promise more than this
Tracking is **not guaranteed** after force-stop, OS process kill, revoked permission, GPS off, phone off, or aggressive OEM battery killers. The customer UI shows *"Last known location, updated X ago"* when updates stop (30 s slow / 90 s unavailable) and never presents old data as live. Partners on such phones should disable battery optimisation for Dialoo.

## Device test plan (needs physical Android phones – not done)
1. Start journey, lock the screen 10 min, walk/drive – customer map keeps moving?  2. Switch to Google Maps navigation (Navigate button) – updates continue?  3. Airplane mode 60 s then back – buffered/latest fix arrives, no duplicates.  4. Kill app from recents – expect stale state on customer UI (documented limit).  5. Revoke permission mid-journey – partner banner shows "denied", customer sees unavailable.  6. Battery: 1 h journey, compare drain with/without sharing.  7. Android 13/14/15 permission flows (foreground → background prompt order).
