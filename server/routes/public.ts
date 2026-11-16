import { Hono } from "hono";
import {
  audit,
  bearer,
  dbOf,
  depsOf,
  effectiveFeatures,
  nowOf,
  rateLimit,
  readBody,
  requireActive,
  requireFeature,
  requireSchoolBySlug,
  schoolBySlug,
  type HonoEnv,
  type SchoolRow
} from "../context.js";
import { cleanRef, clampText, Fail, newId } from "../lib.js";
import { publicSchool } from "../mappers.js";
import { appointmentSchema, errorReportSchema, eventSchema, leadSchema } from "../schemas.js";
import { assertBranch, bumpEvent, purgeAll } from "../services.js";
import { createHash, timingSafeEqual } from "node:crypto";

export const publicRoutes = new Hono<HonoEnv>();

publicRoutes.get("/health", (c) => {
  const deps = depsOf(c);
  return c.json({ ok: true as const, ai: Boolean(deps.ai), email: Boolean(deps.sendEmail) });
});

publicRoutes.post("/events", async (c) => {
  rateLimit(c, "events");
  const body = await readBody(c, eventSchema, 4_000);
  const db = dbOf(c);
  let schoolId: string | null = null;
  if (body.schoolSlug) {
    const school = await schoolBySlug(db, body.schoolSlug);
    if (!school) return c.body(null, 204);
    schoolId = school.id;
  }
  await bumpEvent(db, nowOf(c), schoolId, body.kind, cleanRef(body.ref));
  return c.body(null, 204);
});

publicRoutes.post("/errors", async (c) => {
  rateLimit(c, "errors");
  const body = await readBody(c, errorReportSchema, 20_000);
  const now = nowOf(c).toISOString();
  const path = clampText(body.path, 500);
  // Strip query strings: they could carry tokens.
  const cleanPath = path ? path.split(/[?#]/)[0]! : null;
  await dbOf(c).query(
    `INSERT INTO error_reports (id, at, first_at, message, stack, path_key, path, release, count)
     VALUES ($1, $2, $2, $3, $4, $5, $6, $7, 1)
     ON CONFLICT (message, path_key) DO UPDATE
       SET count = error_reports.count + 1, at = EXCLUDED.at,
           stack = coalesce(EXCLUDED.stack, error_reports.stack),
           release = coalesce(EXCLUDED.release, error_reports.release)`,
    [newId(), now, body.message.slice(0, 2000), clampText(body.stack, 10_000), cleanPath ?? "", cleanPath, clampText(body.release, 100)]
  );
  return c.body(null, 204);
});

publicRoutes.get("/schools/by-host", async (c) => {
  const host = (c.req.query("host") ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (!host) throw new Fail("bad_request", "host required");
  const candidates = host.startsWith("www.") ? [host, host.slice(4)] : [host, `www.${host}`];
  const rows = await dbOf(c).query<SchoolRow>(
    `SELECT * FROM schools WHERE custom_domain = $1 OR custom_domain = $2 LIMIT 1`,
    candidates
  );
  const school = rows[0];
  if (!school || !effectiveFeatures(school).customDomain) throw new Fail("not_found");
  c.header("Cache-Control", "public, max-age=300");
  return c.json({ slug: school.slug });
});

publicRoutes.get("/schools/:slug", async (c) => {
  const school = await requireSchoolBySlug(c, c.req.param("slug"));
  c.header("Cache-Control", "public, max-age=60");
  return c.json(await publicSchool(dbOf(c), school));
});

publicRoutes.get("/schools/:slug/question-notes", async (c) => {
  const school = await requireSchoolBySlug(c, c.req.param("slug"));
  const rows = await dbOf(c).query<{ question_id: number; body: string; video_url: string | null }>(
    `SELECT question_id, body, video_url FROM question_notes
     WHERE school_id = $1 AND visibility = 'school' ORDER BY question_id, created_at`,
    [school.id]
  );
  return c.json({
    notes: rows.map((row) => ({ questionId: row.question_id, body: row.body, videoUrl: row.video_url }))
  });
});

publicRoutes.post("/schools/:slug/leads", async (c) => {
  rateLimit(c, "leads");
  const school = await requireSchoolBySlug(c, c.req.param("slug"));
  const body = await readBody(c, leadSchema);
  requireActive(school);
  requireFeature(school, "leads");
  if (!body.consent) throw new Fail("consent_required");
  const db = dbOf(c);
  const now = nowOf(c);
  const branchId = body.branchId ? body.branchId : null;
  await assertBranch(db, school.id, branchId);
  const ref = cleanRef(body.ref);
  await db.query(
    `INSERT INTO students (id, school_id, display_name, phone, status, branch_id, notes, source, interest,
       consent_at, consent_version, created_at)
     VALUES ($1, $2, $3, $4, 'lead', $5, $6, $7, $8, $9, 'lead-form', $9)`,
    [
      newId(),
      school.id,
      body.name,
      school.collect_phone ? clampText(body.phone, 40) : null,
      branchId,
      clampText(body.message, 1000),
      ref,
      body.interest ?? null,
      now.toISOString()
    ]
  );
  await bumpEvent(db, now, school.id, "lead", ref);
  return c.json({ ok: true as const });
});

publicRoutes.post("/schools/:slug/appointments", async (c) => {
  rateLimit(c, "appointments");
  const school = await requireSchoolBySlug(c, c.req.param("slug"));
  const body = await readBody(c, appointmentSchema);
  requireActive(school);
  requireFeature(school, "leads");
  if (!body.consent) throw new Fail("consent_required");
  const db = dbOf(c);
  const now = nowOf(c);
  const branchId = body.branchId ? body.branchId : null;
  await assertBranch(db, school.id, branchId);
  await db.query(
    `INSERT INTO appointments (id, school_id, student_id, name, phone, kind, preferred_at, status, branch_id,
       message, notes, consent_at, created_at)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, 'requested', $7, $8, NULL, $9, $9)`,
    [
      newId(),
      school.id,
      body.name,
      school.collect_phone ? clampText(body.phone, 40) : null,
      body.kind,
      body.preferredAt,
      branchId,
      clampText(body.message, 1000),
      now.toISOString()
    ]
  );
  await bumpEvent(db, now, school.id, "lead", "appointment");
  return c.json({ ok: true as const });
});

const digest = (value: string) => createHash("sha256").update(value).digest();

publicRoutes.get("/cron/retention", async (c) => {
  const secret = depsOf(c).env.CRON_SECRET;
  const token = bearer(c);
  if (!secret || !token || !timingSafeEqual(digest(token), digest(secret))) throw new Fail("unauthorized");
  const results = await purgeAll(dbOf(c), nowOf(c));
  for (const result of results) {
    if (result.deleted > 0) {
      await audit(c, "retention.run", {
        schoolId: result.schoolId,
        meta: { deleted: result.deleted, trigger: "cron" },
        actorEmail: null
      });
    }
  }
  const deleted = results.reduce((sum, result) => sum + result.deleted, 0);
  return c.json({ ok: true as const, deleted, schools: results.length });
});
