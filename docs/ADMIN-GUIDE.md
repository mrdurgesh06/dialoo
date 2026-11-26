# Dialoo Admin — Guide (Hinglish)

Admin console: `http://localhost:5173/admin` (website) — app me admin nahi hai.

## 1. Password bhool gaye? (Forgot password)
1. Admin login page par **Forgot password?** dabayein.
2. Apna **mobile number ya email** daalein (jo admin account me saved hai) → *Send verification code*.
3. 6-digit code **admin account ke registered mobile par SMS** se aata hai (local testing me `OTP_DEV_MODE=true` hone par code screen par dikhta hai).
4. Code + naya password daalein (12+ characters, chhota letter, BADA letter, number, symbol) → *Set new password*.
5. Ab naye password se login karein (phir se OTP aayega).
- Security: jawab hamesha ek jaisa aata hai (koi bata nahi sakta ki account hai ya nahi); ek IP se 15 minute me 10 se zyada requests block; reset hote hi us account ke **sab purane admin sessions logout** ho jaate hain; har reset audit log me jata hai.
- Note: email se sirf account **pehchana** jata hai; code mobile par SMS se jata hai. (Email se code bhejne ke liye alag SMTP integration chahiye, abhi nahi hai.)
- Agar mobile bhi kho gaya: koi doosra **Super Admin** *Users → Reset password* se temporary password bana sakta hai.

## 2. Naya Admin / Super Admin banana
Sirf **Super Admin** kar sakta hai.
1. Admin console → **Users** → **+ Add admin / staff**.
2. Naam, **mobile number (OTP isi par aayega)**, email (optional), aur role chunein:
   - **Support** — bookings dekhna aur cancel/handle karna.
   - **Admin** — providers approve, users, catalog, offers, locations, broadcast, audit.
   - **Super admin** — sab kuch + settings + staff banana.
3. *Create login* dabate hi ek **temporary password** ek hi baar dikhta hai — copy karke us vyakti ko private me dein.
4. Wo `/admin` par is password se login karta hai → OTP → turant **apna naya password** chunna padta hai.
- Agar wo mobile pehle se customer/provider ke roop me hai to usi account ko staff role mil jata hai (purana data safe).
- Staff ki list me **Reset password** (naya temporary password) aur **Disable** buttons hain. Khud ko disable/reset nahi kar sakte (galti se lock hone se bachne ke liye).
- Pehla Super Admin `ADMIN_PHONE` / `ADMIN_PASSWORD` se bootstrap hota hai.

## 3. Locations (poora Uttar Pradesh)
- **75 zile + unke headquarters city + kuch bade towns** pehle se loaded hain (coordinates approximate; ±kuch km). Sab UP cities active hain: user ka GPS sabse paas ke active city (60 km ke andar) se match hota hai.
- Admin → **Locations**: city ko on/off karein, naya city/town jodein, aur har city me **Areas (mohalla/locality)** aur **Streets** add karein. Wahan khade hokar **📍 My location** dabayein to exact coordinates aa jaate hain.
- Jab online map (Nominatim) na chale, app apne database ke street/area se "Near MG Marg, Hazratganj, Lucknow" jaisa address dikhata hai.

## 4. Provider fee — ₹99/month
- Ek paid plan: **Dialoo Provider — ₹99/month** (verified listing, priority search, unlimited requests, chat/call). **Free** plan trial ke liye (5 requests tak).
- Pro (₹199) aur Business (₹499) band (inactive) hain. Price/features badalne ya plan dobara on karne ke liye: **Settings → Provider subscription plans**.
- Abhi online payment gateway (Razorpay) jura nahi hai: provider "Upgrade" dabata hai to order banta hai aur plan tab active hona chahiye jab payment verify ho (gateway ka kaam baaki).

## 5. Naye services
45 categories aur 160+ services (pest control, RO service, CCTV, mobile/laptop repair, packers & movers, photographer, cook, tailor, solar, locksmith, pet care…). Sab **Catalog** page se edit/hide kiye ja sakte hain; naye add bhi.
