# Dialoo ko Render par deploy karna (API + website, database = Azure MySQL)

> Ye guide **testing / demo** ke liye hai (Render free plan). Real users ke liye neeche "Production checklist" dekhein.
> Apna password/ID kisi ko (mujhe/Claude ko bhi) mat dein. Sab kuch aap apne browser me apne account se karenge.

## Kya deploy hota hai
| Service | Kya hai | Kahan se banta hai |
|---|---|---|
| `dialoo-api` | Spring Boot API (Docker) | `apps/api` |
| `dialoo-web` | React website + `/admin` (static site) | `apps/web` |
| Database | **Azure MySQL 8** (Render par MySQL nahi milta) | aapka Azure server |

Dono Render services ek hi file se banti hain: repo ke root ki `render.yaml`.

## Free plan ke limits
- Free web service **15 minute idle par so jati hai**; agla pehla request ~1 minute leta hai. RAM 512 MB.
- Free instance sirf testing ke liye hai. Plans/terms badalte rehte hain, signup se pehle Render ka current pricing page dekh lein.

## Step 0 — Pehle Azure DB ka password badlein (zaroori)
Purane zip ke `application.yml` me DB ka asli password likha tha. Wo ab code se hata diya gaya hai, lekin jisne bhi wo zip dekha ho uske paas password hai. Azure Portal → aapka MySQL server → **Reset password** se naya password banayein aur sirf Render ke Environment me daalein, code/chat me kahin nahi.

## Step 1 — Code GitHub par daalein
```powershell
cd C:\dialoo
git init
git add .
git commit -m "Dialoo: monorepo structure + Render deploy"
git branch -M main
git remote add origin https://github.com/<aapka-username>/dialoo.git
git push -u origin main
```
Repo **Private** rakhein. `.gitignore` me `.env*`, `node_modules`, `dist`, `*.jks` pehle se hain. Push se pehle `git status` me koi `.env` / password wali file na dikhe.

## Step 2 — Azure MySQL tayyar karein
1. Database bana lein (agar nahi hai): `CREATE DATABASE dialoodb CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`
2. **Firewall**: Azure Portal → MySQL server → *Networking* → Render ke **outbound IP addresses** allow karein (Render dashboard me `dialoo-api` service ke *Connect → Outbound* section me dikhte hain). Sirf testing ke liye temporarily poori range khol sakte hain, par test ke baad band karein.
3. SSL on rehta hai (`sslMode=REQUIRED`). `DB_URL` aisa hoga:
```
jdbc:mysql://<server>.mysql.database.azure.com:3306/dialoodb?sslMode=REQUIRED&serverTimezone=UTC&characterEncoding=UTF-8
```
`DB_USERNAME` / `DB_PASSWORD` Azure me jo user banaya hai wahi.

### Demo data (`FLYWAY_EXTRA_LOCATION`) — DB ke hisaab se chunein
| Aapka Azure DB | Value |
|---|---|
| **Naya / khali** database (demo providers chahiye) | `classpath:db/demo` (render.yaml me default) |
| **Purana, pehle se migrate** hua, aur usme demo data **laga hua hai** | `classpath:db/demo` ya `classpath:db/none` dono chalenge |
| **Purana, migrate hua par demo data nahi laga** / real data hai | `classpath:db/none` (warna Flyway "migration ignored / not applied" error de sakta hai aur demo providers real data me mil jayenge) |

## Step 3 — Render par Blueprint se deploy
1. render.com → GitHub se login → **New → Blueprint** → apni `dialoo` repo chunein. Render `render.yaml` padh kar `dialoo-api` aur `dialoo-web` banayega.
2. Form me ye bharein:
   - `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` — Step 2 se.
   - `ADMIN_PHONE` — aapka 10-digit mobile. `ADMIN_PASSWORD` — **naya, 12+ characters**, kahin aur use na hua ho.
   - `GEO_USER_AGENT` — `Dialoo/5.0 (aapka-email@example.com)`.
   - `FRONTEND_ORIGIN` aur `VITE_API_BASE_URL` abhi khali chhod dein.
3. Pehla build 5–10 minute leta hai. Ban jaye to dono URL note karein:
   - API: `https://dialoo-api-xxxx.onrender.com`
   - Website: `https://dialoo-web-xxxx.onrender.com`
4. **dialoo-api → Environment**: `FRONTEND_ORIGIN` = website URL (bina `/` ke). Save → redeploy.
5. **dialoo-web → Environment**: `VITE_API_BASE_URL` = `https://dialoo-api-xxxx.onrender.com/api/v1` → *Manual Deploy → Clear build cache & deploy* (API address build ke time chahiye).

## Step 4 — Check karein
1. `https://<api>.onrender.com/api/v1/health` → `{"status":"UP"...}` (pehli baar ~1 minute).
2. Website kholein → login → OTP screen par dev OTP dikhega.
3. Admin: `https://<website>.onrender.com/admin` → `ADMIN_PHONE` + `ADMIN_PASSWORD` → OTP.
4. Pura flow: `LOCAL-DEVELOPMENT.md` ka Step 5.
5. API logs me ye lines dikhni chahiye: `Successfully validated ... migrations` aur `Started DialooApplication`.

## ⚠️ Security (public link par)
`OTP_DEV_MODE=true` me OTP screen par dikhta hai, yaani link jisse mile wo **kisi bhi mobile number se login** kar sakta hai. Link sirf apne logon ko dein aur testing ke baad service **Suspend** kar dein. Admin ko abhi bhi password + OTP chahiye, isliye `ADMIN_PASSWORD` mazboot rakhein.

## Production checklist (real users se pehle)
- [ ] Render plan `free` → `starter` (sleep band, zyada RAM)
- [ ] `OTP_DEV_MODE=false`, `SMS_PROVIDER=twilio` + `TWILIO_*` variables
- [ ] `FLYWAY_EXTRA_LOCATION=classpath:db/none` (demo providers nahi)
- [ ] Custom domain (API + website), `FRONTEND_ORIGIN` me wahi domain
- [ ] Azure MySQL: automated backups on, firewall sirf Render IPs ke liye
- [ ] Apna geocoder / paid provider (`GEO_NOMINATIM_URL`), public Nominatim sirf halke use ke liye hai
- [ ] `JWT_SECRET` Render ne generate kiya hai — kisi ke saath share na karein

## Troubleshooting
- **`Could not resolve placeholder 'DB_PASSWORD'`**: `DB_PASSWORD` environment variable set nahi hai.
- **`Communications link failure` / timeout**: Azure firewall me Render ka outbound IP allow nahi hai.
- **`Access denied`**: `DB_USERNAME` / `DB_PASSWORD` galat, ya password reset ke baad Render me update nahi kiya.
- **`Detected resolved migration not applied to database`** (V9.1 / V13.1): DB purana hai aur demo data nahi laga — `FLYWAY_EXTRA_LOCATION=classpath:db/none` karein.
- **`Migration checksum mismatch`**: kisi purani migration file ko edit kiya gaya. Original file wapas rakhein; DB ko manually na badlein.
- **Website par CORS error**: `FRONTEND_ORIGIN` bilkul website ke URL jaisa ho (https, bina trailing `/`).
- **Website khuli par data nahi aata**: `VITE_API_BASE_URL` build se pehle set nahi tha — set karke *Clear build cache & deploy*.
- **API 502 / health check fail**: Render → `dialoo-api` → Logs dekhein; free instance ka pehla start slow hota hai.

## Android / iOS app ko is API se jodna
`apps/web/.env.production` me `VITE_API_BASE_URL=https://<api>.onrender.com/api/v1` daalein aur `MOBILE-APP.md` ke release steps chalayein. Backend ke `FRONTEND_ORIGIN` me `https://localhost,capacitor://localhost` bhi comma se jodein.
