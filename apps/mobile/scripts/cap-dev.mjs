// Emulator testing helper: after `npx cap sync android`, allow plain-HTTP API calls (http://10.0.2.2:8080) and WebView debugging.
// NEVER use this for the release build. The release build uses `npm run android:sync` (HTTPS only).
import fs from 'node:fs';
const f = 'android/app/src/main/assets/capacitor.config.json';
const c = JSON.parse(fs.readFileSync(f, 'utf8'));
c.server = { ...(c.server || {}), androidScheme: 'http', cleartext: true };
c.android = { ...(c.android || {}), allowMixedContent: true, webContentsDebuggingEnabled: true };
fs.writeFileSync(f, JSON.stringify(c, null, 2));
console.log('Dev (cleartext HTTP) config applied to', f);
