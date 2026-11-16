# Lebanese Motorcycle Theory Exam Trainer

Arabic-first (RTL) trainer for the Lebanese motorcycle theory exam, with English and French,
plus an optional platform for driving schools: branded pages, student tracking, a live
classroom quiz and an admin console. Vite + React + TypeScript on the front, a small Hono API
on Postgres for the school features.

**Public mode needs no server.** Everything a student does on their own (exams, signs,
mistakes, progress, profiles, backups) runs in the browser and is saved in `localStorage`.
The API is only used when a school is involved.

## What's inside

**Students (works offline, no account)**
- 251 official questions (101 road signs), 30-question exam, pass at 25/30.
- Exam modes: official, timed, strict (answers at the end), exam-day simulation; practice modes:
  free practice, today's review (spaced repetition), mistake notebook, weakest, unseen, signs only,
  by topic, favourites.
- Explanations for every question (why the answer is right, why each wrong option is wrong,
  common-mistake tips) in Arabic, English and French — labelled as study aids, never replacing
  the official Arabic wording. Optional English/French question translations with the official
  Arabic shown alongside.
- Road-sign tools: searchable gallery by category, flashcards, reverse mode, 60-second drill,
  most-confused signs, printable sign sheet.
- Pass-readiness score (recent exams, mastery, coverage, signs, trend, recency, timed results)
  with labels, a study plan, streaks, XP and badges, weekly summary, topic accuracy.
- Local profiles for shared devices (optional PIN), backup/restore by file or QR code.
- Installable PWA, offline mode, low-data mode, dark/light theme, font size, high contrast,
  read-aloud, daily reminder as a calendar event, printable reports and certificates.

**Schools (API)** — branded landing page at `/s/<slug>` with QR posters, WhatsApp, lead and
appointment forms, school-branded trainer at `/s/<slug>/learn`, invite codes so students can
link a profile (with consent) for cross-device progress, instructor dashboard (readiness,
at-risk, inactive, weak topics, most-missed questions, CRM statuses, packages, payment notes,
exam/lesson dates), live classroom quiz with projector screen, instructor question notes and
videos, embed widget, school settings, audit log, data export and retention.

**Platform** — super-admin console for schools, plans (Starter/Pro/Premium), feature flags,
manual billing status, usage, audit log and error reports. AI explanations via the Claude API
when `ANTHROPIC_API_KEY` is set.

## Run locally

```bash
npm install
npm run dev          # student app only (public mode), http://localhost:5173
```

With the school features:

```bash
npm run seed         # demo school "demo", invite code DEMO26 (stop the API first)
npm run dev:all      # Vite + API; Vite proxies /api to http://localhost:8787
```

Then open `/s/demo` (school page), `/staff` (sign in as `owner@demo.test`, `coach@demo.test`
or `admin@demo.test`; the sign-in link is shown on screen in development) and `/admin`.
See [server/README.md](server/README.md) for environment variables and API details.

## Checks

```bash
npm test               # unit + API tests (domain, content consistency, i18n, server)
npm run typecheck
npm run build
npm run bank -- validate   # question bank checks + checksum
npm run test:viewport      # mobile/tablet overflow check (needs npm run dev:all and Chrome)
```

## Project layout

```
src/
  app/            Settings, Profile, School and Trainer contexts (state for the student app)
  domain/         Pure learning logic: engine, modes, readiness, notebook, flashcards, plan, badges
  data/           Official questions, study content (content/*.json), topics, banks, manifest
  i18n/           Translation helpers and messages per feature (ar/en/fr)
  features/
    trainer/      Student pages (home, exam, results, practice, signs, notebook, progress, settings…)
    school/       School landing page, lead and appointment forms
    staff/        Instructor/school-admin dashboard, CRM, live classroom host
    admin/        Super-admin console
    live/         Students joining a live classroom quiz
    print/        Printable exams, answer keys, sign sheets, reports, certificates, posters
    share/        WhatsApp sharing and image cards
    projector/    Classroom projector mode
    embed/        Embeddable widget for school websites
    privacy/      Privacy policy
  api/            API contract (types.ts) and fetch client
server/           Hono API, Postgres/PGlite, migrations, seed, tests
api/              Vercel Function entry
scripts/          Question bank pipeline, viewport check
```

## Question bank

Questions live in `src/data/questions.ts` and were transcribed from the official PDF and
cross-checked against its answer markers. Study content per question is in
`src/data/content/*.json`. To add questions (for example a future car bank), use
`npm run bank -- import <file.json|file.csv> --category car`, then add study content and run
`npm run bank -- manifest`. Tests fail if the bank changes without updating the manifest.
