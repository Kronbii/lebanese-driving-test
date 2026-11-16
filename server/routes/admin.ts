import { Hono } from "hono";
import type { AdminSchoolRow } from "../../src/api/types";
import {
  audit,
  dbOf,
  nowOf,
  readBody,
  schoolById,
  type HonoEnv,
  type SchoolRow
} from "../context";
import { json, type Db } from "../db";
import { addDays, dayKey, Fail, lastDays, newId } from "../lib";
import { DEFAULT_BRANDING, EMPTY_CONTACT, EMPTY_LANDING, schoolSettings, toAudit, toErrorReport, type AuditRow, type ErrorRow } from "../mappers";
import { adminSchoolUpdateSchema, schoolCreateSchema } from "../schemas";

export const adminRoutes = new Hono<HonoEnv>();

async function adminRow(db: Db, school: SchoolRow, now: Date): Promise<AdminSchoolRow> {
  const since = dayKey(addDays(now, -29));
  const [[students], [events], [staff]] = await Promise.all([
    db.query<{ students: number; linked: number }>(
      `SELECT count(*) FILTER (WHERE status <> 'lead')::int AS students,
              count(*) FILTER (WHERE linked_at IS NOT NULL)::int AS linked
       FROM students WHERE school_id = $1`,
      [school.id]
    ),
    db.query<{ exams: number; leads: number }>(
      `SELECT coalesce(sum(count) FILTER (WHERE kind = 'exam_completed'), 0)::int AS exams,
              coalesce(sum(count) FILTER (WHERE kind = 'lead'), 0)::int AS leads
       FROM events WHERE school_id = $1 AND day >= $2`,
      [school.id, since]
    ),
    db.query<{ n: number }>(`SELECT count(*)::int AS n FROM users WHERE school_id = $1`, [school.id])
  ]);
  return {
    ...(await schoolSettings(db, school)),
    usage: {
      students: students?.students ?? 0,
      linkedStudents: students?.linked ?? 0,
      exams30d: events?.exams ?? 0,
      leads30d: events?.leads ?? 0,
      staff: staff?.n ?? 0
    }
  };
}

adminRoutes.get("/admin/schools", async (c) => {
  const db = dbOf(c);
  const schools = await db.query<SchoolRow>(`SELECT * FROM schools ORDER BY created_at DESC`);
  const now = nowOf(c);
  const rows: AdminSchoolRow[] = [];
  for (const school of schools) rows.push(await adminRow(db, school, now));
  return c.json(rows);
});

adminRoutes.get("/admin/schools/:id", async (c) => {
  const school = await schoolById(dbOf(c), c.req.param("id"));
  if (!school) throw new Fail("not_found");
  return c.json(await adminRow(dbOf(c), school, nowOf(c)));
});

adminRoutes.post("/admin/schools", async (c) => {
  const body = await readBody(c, schoolCreateSchema);
  const db = dbOf(c);
  const now = nowOf(c).toISOString();
  if ((await db.query(`SELECT 1 FROM schools WHERE slug = $1`, [body.slug])).length) {
    throw new Fail("conflict", "slug taken");
  }
  if (body.adminEmail && (await db.query(`SELECT 1 FROM users WHERE email = $1`, [body.adminEmail.toLowerCase()])).length) {
    throw new Fail("conflict", "admin email already in use");
  }
  const id = newId();
  const [school] = await db.query<SchoolRow>(
    `INSERT INTO schools (id, slug, name, branding, contact, landing, plan, status, feature_overrides, collect_phone, created_at)
     VALUES ($1, $2, $3::text::jsonb, $4::text::jsonb, $5::text::jsonb, $6::text::jsonb, $7, $8, '{}'::jsonb, true, $9)
     RETURNING *`,
    [id, body.slug, json(body.name), json(DEFAULT_BRANDING), json(EMPTY_CONTACT), json(EMPTY_LANDING), body.plan, body.status ?? "trial", now]
  );
  if (body.adminEmail) {
    const email = body.adminEmail.toLowerCase();
    await db.query(
      `INSERT INTO users (id, email, name, role, school_id, created_at) VALUES ($1, $2, $3, 'school_admin', $4, $5)`,
      [newId(), email, body.adminName || email.split("@")[0], id, now]
    );
  }
  await audit(c, "school.create", { schoolId: id, target: id, meta: { slug: body.slug, plan: body.plan } });
  return c.json(await adminRow(db, school!, nowOf(c)), 201);
});

adminRoutes.patch("/admin/schools/:id", async (c) => {
  const db = dbOf(c);
  const school = await schoolById(db, c.req.param("id"));
  if (!school) throw new Fail("not_found");
  const body = await readBody(c, adminSchoolUpdateSchema, 200_000);
  if (body.slug && body.slug !== school.slug) {
    if ((await db.query(`SELECT 1 FROM schools WHERE slug = $1`, [body.slug])).length) throw new Fail("conflict", "slug taken");
  }
  if (body.customDomain && body.customDomain !== school.custom_domain) {
    if ((await db.query(`SELECT 1 FROM schools WHERE custom_domain = $1`, [body.customDomain])).length) {
      throw new Fail("conflict", "domain taken");
    }
  }
  const columns: Record<string, unknown> = {
    name: body.name,
    branding: body.branding,
    contact: body.contact,
    landing: body.landing,
    collect_phone: body.collectPhone,
    retention_days: body.retentionDays,
    slug: body.slug,
    plan: body.plan,
    status: body.status,
    student_limit: body.studentLimit,
    custom_domain: body.customDomain,
    paid_until: body.paidUntil,
    billing_note: body.billingNote === undefined ? undefined : body.billingNote || null,
    feature_overrides: body.featureOverrides
  };
  const jsonColumns = new Set(["name", "branding", "contact", "landing", "feature_overrides"]);
  const sets: string[] = [];
  const params: unknown[] = [school.id];
  for (const [column, value] of Object.entries(columns)) {
    if (value === undefined) continue;
    params.push(jsonColumns.has(column) ? json(value) : value);
    sets.push(jsonColumns.has(column) ? `${column} = $${params.length}::text::jsonb` : `${column} = $${params.length}`);
  }
  if (sets.length) await db.query(`UPDATE schools SET ${sets.join(", ")} WHERE id = $1`, params);

  if (body.plan && body.plan !== school.plan) {
    await audit(c, "school.plan", { schoolId: school.id, target: school.id, meta: { from: school.plan, to: body.plan } });
  }
  if (body.status && body.status !== school.status) {
    await audit(c, "school.status", { schoolId: school.id, target: school.id, meta: { from: school.status, to: body.status } });
  }
  await audit(c, "school.update", { schoolId: school.id, target: school.id, meta: { fields: Object.keys(body) } });
  const fresh = await schoolById(db, school.id);
  return c.json(await adminRow(db, fresh!, nowOf(c)));
});

adminRoutes.delete("/admin/schools/:id", async (c) => {
  const db = dbOf(c);
  const school = await schoolById(db, c.req.param("id"));
  if (!school) throw new Fail("not_found");
  await db.query(`DELETE FROM events WHERE school_id = $1`, [school.id]);
  await db.query(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE school_id = $1)`, [school.id]);
  await db.query(`DELETE FROM schools WHERE id = $1`, [school.id]);
  await audit(c, "school.delete", { schoolId: school.id, target: school.id, meta: { slug: school.slug } });
  return c.json({ ok: true as const });
});

adminRoutes.get("/admin/usage", async (c) => {
  const db = dbOf(c);
  const now = nowOf(c);
  const days = lastDays(now, 30);
  const [[schools], [students], [totals], daily] = await Promise.all([
    db.query<{ n: number }>(`SELECT count(*)::int AS n FROM schools`),
    db.query<{ n: number }>(`SELECT count(*)::int AS n FROM students WHERE status <> 'lead'`),
    db.query<{ exams: number; leads: number }>(
      `SELECT coalesce(sum(count) FILTER (WHERE kind = 'exam_completed'), 0)::int AS exams,
              coalesce(sum(count) FILTER (WHERE kind = 'lead'), 0)::int AS leads
       FROM events WHERE day >= $1`,
      [days[0]]
    ),
    db.query<{ day: string; kind: string; n: number }>(
      `SELECT day, kind, sum(count)::int AS n FROM events WHERE day >= $1 GROUP BY day, kind`,
      [days[0]]
    )
  ]);
  const map = new Map(days.map((day) => [day, { day, exams: 0, visits: 0, leads: 0 }]));
  for (const row of daily) {
    const entry = map.get(row.day);
    if (!entry) continue;
    if (row.kind === "exam_completed") entry.exams += row.n;
    else if (row.kind === "visit") entry.visits += row.n;
    else if (row.kind === "lead") entry.leads += row.n;
  }
  return c.json({
    totals: {
      schools: schools?.n ?? 0,
      students: students?.n ?? 0,
      exams30d: totals?.exams ?? 0,
      leads30d: totals?.leads ?? 0
    },
    daily: [...map.values()]
  });
});

adminRoutes.get("/admin/errors", async (c) => {
  const rows = await dbOf(c).query<ErrorRow>(`SELECT * FROM error_reports ORDER BY at DESC LIMIT 500`);
  return c.json(rows.map(toErrorReport));
});

adminRoutes.delete("/admin/errors/:id", async (c) => {
  await dbOf(c).query(`DELETE FROM error_reports WHERE id = $1`, [c.req.param("id")]);
  return c.json({ ok: true as const });
});

adminRoutes.get("/admin/audit-log", async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 300, 1), 2000);
  const schoolId = c.req.query("schoolId");
  const rows = await dbOf(c).query<AuditRow>(
    schoolId
      ? `SELECT * FROM audit_log WHERE school_id = $1 ORDER BY at DESC LIMIT ${limit}`
      : `SELECT * FROM audit_log ORDER BY at DESC LIMIT ${limit}`,
    schoolId ? [schoolId] : []
  );
  return c.json(rows.map(toAudit));
});
