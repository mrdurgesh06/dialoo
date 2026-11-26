// Builds ../web for the native shell.  Usage: node scripts/build-web.mjs production|androiddev|iosdev
//  - production : needs apps/web/.env.production with a real public HTTPS API URL (blocks localhost / placeholder values)
//  - androiddev : API defaults to http://10.0.2.2:8080/api/v1  (Android emulator -> PC)
//  - iosdev     : API defaults to http://localhost:8080/api/v1 (iOS simulator -> Mac)
// For dev modes you can override the API address:  VITE_API_BASE_URL=http://192.168.1.10:8080/api/v1 npm run android:sync:dev
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web');
const env = { ...process.env };

if (mode === 'production') {
  const f = path.join(web, '.env.production');
  if (!fs.existsSync(f)) {
    console.error(`\n[Dialoo] ${f} not found.\nCopy apps/web/.env.production.example to apps/web/.env.production and put your public HTTPS API URL in it.\n`);
    process.exit(1);
  }
  const m = fs.readFileSync(f, 'utf8').match(/^\s*VITE_API_BASE_URL\s*=\s*(\S+)/m);
  const url = m ? m[1] : '';
  if (!/^https:\/\//i.test(url) || /your-domain|localhost|10\.0\.2\.2|127\.0\.0\.1/i.test(url)) {
    console.error(`\n[Dialoo] VITE_API_BASE_URL in apps/web/.env.production is "${url}".\nA store release must use your real public HTTPS backend, e.g. https://dialoo-api.onrender.com/api/v1\n`);
    process.exit(1);
  }
  console.log('[Dialoo] Release API URL OK:', url);
} else if (mode === 'androiddev') {
  env.VITE_API_BASE_URL ||= 'http://10.0.2.2:8080/api/v1';
} else if (mode === 'iosdev') {
  env.VITE_API_BASE_URL ||= 'http://localhost:8080/api/v1';
} else {
  console.error('Usage: node scripts/build-web.mjs production|androiddev|iosdev');
  process.exit(1);
}

const r = spawnSync('npm', ['run', 'build', '--', '--mode', mode], { cwd: web, env, stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
