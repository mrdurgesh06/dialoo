# Dialoo

Local-services marketplace: customers book nearby professionals, providers manage requests, admins run the platform.

| | Stack | Folder |
|---|---|---|
| **API** | Java 21, Spring Boot 3.4, MySQL 8, Flyway | [`apps/api`](apps/api) |
| **Web** (customer + provider + `/admin`) | React 18, Vite 5 | [`apps/web`](apps/web) |
| **Mobile** (Android / iOS) | Capacitor 8 shell around the web build | [`apps/mobile`](apps/mobile) |

## Repository layout
```
dialoo/
├── apps/
│   ├── api/        Spring Boot API  (Dockerfile, db/migration, db/demo, db/rollback)
│   ├── web/        React app  (src/features/{auth,customer,provider,admin}, src/shared, src/styles)
│   └── mobile/     Capacitor android/ + ios/, build scripts, Play Store assets
├── docs/           Deploy, local development, mobile, admin guide, changelog
├── scripts/        Helper scripts (migration verification)
├── .github/        CI (API build + tests, web build)
├── render.yaml     Render Blueprint (dialoo-api + dialoo-web)
└── .env.example    Every environment variable the API reads
```

## Quick start (local)
```bash
# 1. API  (needs Java 21, Maven, MySQL 8)  -> http://localhost:8080
cd apps/api
export DB_PASSWORD=... JWT_SECRET=... ADMIN_PHONE=... ADMIN_PASSWORD=...   # see .env.example
mvn spring-boot:run

# 2. Web  (needs Node 20+)  -> http://localhost:5173   (admin: /admin)
cd apps/web && npm install && npm run dev
```
Step-by-step (Windows/PowerShell, test flow): [`docs/LOCAL-DEVELOPMENT.md`](docs/LOCAL-DEVELOPMENT.md)

## Deploy
Render (API + website) with an external MySQL (Azure): [`docs/DEPLOY-RENDER.md`](docs/DEPLOY-RENDER.md)

## More
- Mobile apps (Android / iOS, Play Store / App Store): [`docs/MOBILE-APP.md`](docs/MOBILE-APP.md)
- Admin console guide: [`docs/ADMIN-GUIDE.md`](docs/ADMIN-GUIDE.md)
- Changelog: [`docs/CHANGELOG.md`](docs/CHANGELOG.md)

## Rules of the repo
- Never commit secrets. Credentials live only in environment variables (see `.env.example`).
- Never edit an applied Flyway migration (`V1…V13`); add a new `V14__*.sql`.
