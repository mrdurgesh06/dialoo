// Run ONCE after:  npm install @capacitor-community/background-geolocation && npx cap sync
// Adds the native declarations needed for partner background location. Idempotent. Usage: node scripts/enable-background-location.mjs [androidManifest] [infoPlist]
// Google Play: declaring ACCESS_BACKGROUND_LOCATION requires the Play Console "Location permissions" declaration and a prominent in-app disclosure
// (see docs/BACKGROUND-LOCATION.md). Do not run this before you are ready to submit that declaration.
import { readFileSync, writeFileSync } from 'node:fs';
const manifest = process.argv[2] || 'android/app/src/main/AndroidManifest.xml';
const plist = process.argv[3] || 'ios/App/App/Info.plist';

let m = readFileSync(manifest, 'utf8');
const perms = ['android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_LOCATION', 'android.permission.POST_NOTIFICATIONS'];
let added = [];
for (const p of perms) if (!m.includes(`"${p}"`)) { m = m.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`); added.push(p); }
writeFileSync(manifest, m);

let x = readFileSync(plist, 'utf8');
if (!x.includes('<key>UIBackgroundModes</key>')) {
  x = x.replace('</dict>\n</plist>', '\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>location</string>\n\t</array>\n</dict>\n</plist>');
  added.push('UIBackgroundModes=location');
}
x = x.replace(/(<key>NSLocationAlwaysAndWhenInUseUsageDescription<\/key>\s*<string>)[^<]*(<\/string>)/, '$1Dialoo Partner shares your live location with the customer only while you are travelling to a booking, even when the app is in the background or the screen is locked. It stops when you arrive.$2');
writeFileSync(plist, x);
console.log(added.length ? `Added: ${added.join(', ')}` : 'Nothing to add (already configured).');
