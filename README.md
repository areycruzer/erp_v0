# Hajiri

Hajiri is a web app for recording daily worker attendance on construction sites. A foreman marks attendance for the workers at a site, a site incharge approves or rejects it, and an admin manages users, sites and audit records. The name means "attendance" in Hindi.

Status: prototype. It is not production-ready. See [Known limitations](#known-limitations).

## Features

- **Roles.** Admin, Site Incharge and Foreman, enforced by middleware on the API and by protected routes in the frontend.
- **Authentication.** Email and password login with JWT tokens. Passwords are hashed with bcryptjs. There are endpoints to register, log in, refresh, log out and change a password.
- **Sites, workers and users.** Admins manage users and sites and assign users to sites. Admins and site incharges manage workers and can transfer them between sites.
- **Attendance.** A mobile-oriented foreman screen submits attendance for several workers at once for a site and date. Site incharges see pending records and approve or reject them. The API also returns attendance stats per worker and per site.
- **Offline entry.** If the device is offline, or the request fails, the foreman screen saves the attendance to IndexedDB. The app tries to send saved records again when the connection comes back.
- **PWA.** A web app manifest and service worker are generated with vite-plugin-pwa, so the app can be installed on a phone.
- **Notifications.** In-app notifications with an unread count, per-user preferences and admin broadcasts.
- **Audit trail.** Attendance changes are written to an audit log. Admins can browse the log, view analytics, and export reports as CSV, JSON or a basic HTML-based PDF. Audit log cleanup runs on a schedule with node-cron.
- **API hardening.** helmet, CORS, rate limiting (100 requests per 15 minutes per IP) and request validation with express-validator.

## Stack

- **Frontend:** React 18, TypeScript, Vite 5, Tailwind CSS 3, React Router 6, TanStack Query, React Hook Form with Zod, idb, vite-plugin-pwa
- **Backend:** Node.js, Express 4, TypeScript, SQLite (sqlite3 and sqlite), jsonwebtoken, bcryptjs, node-cron
- **Database:** a SQLite file. SQL migrations in `backend/database/migrations` run when the server starts.

## Run locally

You need Node.js 18 or newer.

### Backend

```bash
cd backend
npm install
cp .env.example .env    # then set JWT_SECRET and JWT_REFRESH_SECRET
npm run dev
```

The server listens on the `PORT` from `.env` (3001 in the example, 3004 if unset). It creates the database at `backend/data/hajiri.db`, or at `DB_PATH` if you set it. Check that it is up with `GET /health`.

The database settings in `.env.example` describe PostgreSQL, but the backend only reads `DB_PATH` and uses SQLite.

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:3001" > .env
npm run dev
```

Open http://localhost:3000. `VITE_API_URL` must match the backend port. Without it, the frontend calls `http://localhost:3004`.

### First user

The seeded users do not have working passwords. Create an account through the API, then log in with it:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@example.com","password":"change-me","role":"ADMIN"}'
```

## Project structure

```
backend/
  src/
    routes/          auth, users, sites, workers, attendance, notifications, audit
    services/        auth, notifications, audit log, reports, retention, schedules, analytics
    repositories/    SQL access for each table
    middleware/      JWT auth and role checks
    migrations/      migration runner
    config/          SQLite connection
    scripts/         one-off database helper scripts
  database/migrations/  SQL schema and seed data
frontend/
  src/
    components/      pages and UI (foreman screen, approvals, admin, audit)
    contexts/        auth and notification state
    lib/             API client and offline storage (pwa.ts)
database/            SQL files the backend does not read (docker-compose.yml mounts database/init)
```

The `test-*.js`, `*.ps1` and `health-check.js` files are manual scripts used during development. They are not an automated test suite.

## Known limitations

- `npm run build` in `frontend` fails the type check because `date-fns` is imported but not listed in `frontend/package.json`. `npm run dev` is not affected by this check.
- There are no automated tests. `npm test` in `backend` fails because `jest.config.js` points to a setup file that does not exist.
- `POST /api/auth/register` is public and lets the caller choose any role, including ADMIN.
- The offline sync posts records without an auth token, and in a different shape from the online form.
- `docker-compose.yml` starts PostgreSQL and Redis, but the backend does not use either.
