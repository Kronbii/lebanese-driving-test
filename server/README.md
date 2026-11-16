# API server

Hono app served under `/api`, implementing the contract in `src/api/types.ts`.
Public mode of the app never needs it; schools, staff, cloud students, leads, the live
classroom and AI explanations do.

```
server/
  app.ts          createApp({ db, env, now?, sendEmail?, ai?, rateLimit? }) + default app
  db.ts           Db interface: Postgres (postgres.js) or PGlite
  schema.ts       idempotent migrations, run once per process before the first request
  context.ts      deps, auth helpers (staff cookie, student/participant bearer), features, audit
  routes/         auth, public (schools, leads, events, errors, cron), student, staff,
                  classroom (+ /live), admin, ai
  overview.ts     StaffOverview aggregation
  services.ts     events, retention, student deletion, scoping checks
  ai.ts / email.ts  Anthropic + Resend integrations
  seed.ts         demo data (npm run seed)
  dev.ts          local Node server (npm run dev:api)
api/[[...route]].ts  Vercel Function entry (hono/vercel)
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | production | Postgres connection string (Neon, Supabase, RDS…). Unset → embedded PGlite at `.data/pglite` (override with `PGLITE_DIR`). Use a pooled URL on serverless; `DATABASE_POOL_MAX` (default 5) caps connections per instance. |
| `APP_URL` | production | Public origin of the web app, e.g. `https://drive.example.com`. Used to build sign-in links. **Set it in production** so links can't be steered by a forged `Host` header. Unset → the browser's localhost origin in dev, else the request origin. |
| `SUPER_ADMIN_EMAIL` | first run | Requesting a sign-in link for this email bootstraps the super admin account. |
| `RESEND_API_KEY` | production | Sends sign-in emails via the Resend HTTP API. Needs `EMAIL_FROM` too. |
| `EMAIL_FROM` | with Resend | Sender, e.g. `Driving School <login@drive.example.com>` (verified domain in Resend). |
| `ANTHROPIC_API_KEY` | optional | Enables `POST /ai/explain` and `POST /staff/ai/instructor-note`. Without it they return `503 ai_unavailable` and `/health` reports `ai: false`. |
| `ANTHROPIC_MODEL` | optional | Model id, default `claude-opus-5-5`. |
| `CRON_SECRET` | production | Bearer secret for `GET /api/cron/retention`. Vercel Cron sends it automatically when the env var is set. |
| `PORT` | optional | Dev server port (default `8787`). |
| `NODE_ENV` | — | `production` enables secure cookies and disables `devLink`. |

Without `RESEND_API_KEY`/`EMAIL_FROM` and outside production, `POST /auth/request-link`
returns the link as `devLink` and logs it to the console.

## Local development

```bash
npm install
npm run seed       # demo data into .data/pglite (idempotent; skips if school "demo" exists)
npm run dev:all    # Vite + API (API on http://localhost:8787/api, Vite proxies /api)
```

- PGlite allows **one process per data directory**: stop `dev:api` before running `npm run seed`,
  or point them at different dirs with `PGLITE_DIR`. Delete `.data/pglite` to start over.
- Sign in: open `/staff`, enter `owner@demo.test` (school admin), `coach@demo.test` (instructor)
  or `admin@demo.test` (super admin) and follow the `devLink` (also printed in the API console).
  `curl -s localhost:8787/api/auth/request-link -H 'Content-Type: application/json' -d '{"email":"owner@demo.test"}'`
- Student join code: `DEMO26`. Demo school slug: `demo` (premium plan, all features).
- Vite proxy: keep `changeOrigin` off (the default) or set `APP_URL=http://localhost:5173`, so
  sign-in links and the CSRF origin check see the browser's origin.
- Tests: `npx vitest run server` (in-memory PGlite, fake email/AI, fixed clock).

## Behaviour notes

- **Auth**: staff sign-in links are single use, valid 15 minutes, stored as SHA-256. Sessions last
  30 days in the `ldt_session` cookie (httpOnly, SameSite=Lax, Secure in production/https).
  Students and live-classroom players use `Authorization: Bearer` tokens (hashed at rest).
  Student login codes are 10 characters from an unambiguous alphabet, shown as `XXXXX-XXXXX`.
- **CSRF**: cookie-authenticated POST/PUT/PATCH/DELETE must send JSON (`Content-Type:
  application/json`) when they have a body, and a browser `Origin` must match the API host
  (or `APP_URL`; any localhost origin outside production). Body-less requests (DELETE, logout) need no
  Content-Type.
- **RBAC**: `super_admin` can use every `/staff/*` endpoint for any school by passing
  `?schoolId=` (or `X-School-Id`). `instructor` can read school data and create/update students,
  appointments, notes, flags and classrooms; only `school_admin` manages settings, branches, users,
  invite codes, deletes students, reads the audit log, exports and runs retention.
- **Feature flags**: `PLAN_FEATURES[plan]` merged with `feature_overrides`; enforced server-side.
- **Rate limits**: in-memory sliding windows per IP + route (per instance; best effort on serverless).
- **Privacy**: events store only `(day, school, kind, ref, count)`; error reports strip query strings;
  phones from public forms are stored only when the school has `collectPhone`. Students can export
  (`GET /student/export`) or delete (`DELETE /student/me`) their data.

### Additions beyond the contract

- `PATCH`/`DELETE /staff/invite-codes/:code` (edit, deactivate, delete).
- `POST /staff/students/:id/login-code` → `{ loginCode }` so staff-registered students can link a device.
- `GET /admin/schools/:id`, `DELETE /admin/errors/:id`, `GET /admin/audit-log?schoolId=`.
- `PATCH /staff/school` behaves like `PUT`. `POST /staff/retention/run` returns `{ ok, deleted, retentionDays }`.
- Error statuses: 400 `bad_request`/`consent_required`/`invalid_code`, 401, 403
  `forbidden`/`feature_disabled`/`limit_reached`/`school_suspended`, 404, 409 `conflict`,
  410 `expired`, 413 `bad_request` (body too large), 429, 503 `ai_unavailable`.

## Deployment (Vercel)

1. Create a Postgres database and set `DATABASE_URL` (pooled), `APP_URL`, `SUPER_ADMIN_EMAIL`,
   `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` and optionally `ANTHROPIC_API_KEY`.
2. Deploy. `api/[[...route]].ts` serves every `/api/*` route; tables are created automatically on
   the first request (guarded by an advisory lock).
3. `vercel.json` adds a daily cron hitting `/api/cron/retention`, an SPA rewrite for non-API paths
   and an HSTS header.
4. Sign in with `SUPER_ADMIN_EMAIL` at `/staff`, create schools, and hand out school-admin logins.

The embedded PGlite fallback is for local development only; on Vercel always set `DATABASE_URL`.

If a deploy fails at runtime with `ERR_MODULE_NOT_FOUND` for a `server/...` import, the function
was compiled without bundling (Node ESM needs file extensions). Fix by switching the relative
imports in `server/` and `api/` to `.js` extensions (TypeScript's Bundler resolution accepts them)
or by bundling the function.
