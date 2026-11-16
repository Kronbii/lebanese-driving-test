import { Hono } from "hono";
import type { QuestionNote, SchoolLanding } from "../../src/api/types.js";
import { QUESTIONS } from "../../src/data/questions.js";
import { AiRefusal, instructorNotePrompt } from "../ai.js";
import {
  audit,
  dbOf,
  depsOf,
  effectiveFeatures,
  nowOf,
  rateLimit,
  readBody,
  requireFeature,
  requireRole,
  schoolById,
  staffOf,
  staffSchool,
  type BranchRow,
  type Ctx,
  type HonoEnv,
  type SchoolRow,
  type StudentRow,
  type UserRow
} from "../context.js";
import { iso, isoRequired, json, type Db } from "../db.js";
import { Fail, newId, randomCode, toCsv } from "../lib.js";
import {
  schoolSettings,
  toAppointment,
  toAudit,
  toBranch,
  toInvite,
  toStaffStudent,
  toStaffStudentDetail,
  toStaffUser,
  type AppointmentRow,
  type AuditRow,
  type InviteRow
} from "../mappers.js";
import {
  appointmentPatchSchema,
  branchPatchSchema,
  branchSchema,
  flagCreateSchema,
  instructorNoteSchema,
  invitePatchSchema,
  inviteCreateSchema,
  noteCreateSchema,
  schoolUpdateSchema,
  staffUserCreateSchema,
  staffUserPatchSchema,
  studentCreateSchema,
  studentUpdateSchema
} from "../schemas.js";
import { assertBranch, assertInstructor, assertStudentCapacity, deleteStudentData, purgeSchool } from "../services.js";
import { computeOverview } from "../overview.js";
import { issueLoginCode } from "./student.js";

export const staffRoutes = new Hono<HonoEnv>();

/** Every column except the (large) progress blob. */
const STUDENT_LIST_COLUMNS = `id, school_id, display_name, phone, status, package, branch_id, instructor_id,
  payment_note, exam_date, lesson_date, notes, source, interest, consent_at, consent_version, NULL AS login_code_hash,
  linked_at, NULL::jsonb AS progress, metrics, progress_saved_at, last_active_at, created_at`;

/** Builds "col = $n" assignments for the defined keys of `fields`. */
function buildSet(fields: Record<string, unknown>, startAt: number, jsonColumns: string[] = []) {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    params.push(jsonColumns.includes(column) ? json(value) : value);
    sets.push(
      jsonColumns.includes(column)
        ? `${column} = $${startAt + params.length - 1}::text::jsonb`
        : `${column} = $${startAt + params.length - 1}`
    );
  }
  return { sets, params };
}

const emptyToNull = <T>(value: T | null | undefined): T | null | undefined =>
  value === undefined ? undefined : value === "" ? null : value;

// ---------- school ----------

staffRoutes.get("/staff/school", async (c) => {
  const school = await staffSchool(c);
  return c.json(await schoolSettings(dbOf(c), school));
});

async function updateSchool(c: Ctx) {
  requireRole(c, "school_admin");
  const user = staffOf(c);
  const school = await staffSchool(c);
  const body = await readBody(c, schoolUpdateSchema, 200_000);
  let landing: SchoolLanding | undefined = body.landing;
  if (landing && user.role !== "super_admin") {
    // Only super admins verify pass rates; an unchanged verified value stays verified.
    const previous = (school.landing as SchoolLanding | null)?.passRate ?? null;
    if (landing.passRate) {
      const stillVerified =
        Boolean(previous?.verified) && previous?.value === landing.passRate.value;
      landing = { ...landing, passRate: { ...landing.passRate, verified: stillVerified } };
    }
  }
  const { sets, params } = buildSet(
    {
      name: body.name,
      branding: body.branding,
      contact: body.contact,
      landing,
      collect_phone: body.collectPhone,
      retention_days: body.retentionDays
    },
    2,
    ["name", "branding", "contact", "landing"]
  );
  const db = dbOf(c);
  if (sets.length) {
    await db.query(`UPDATE schools SET ${sets.join(", ")} WHERE id = $1`, [school.id, ...params]);
    await audit(c, "school.update", { schoolId: school.id, target: school.id, meta: { fields: Object.keys(body) } });
  }
  const fresh = await schoolById(db, school.id);
  return c.json(await schoolSettings(db, fresh!));
}

staffRoutes.put("/staff/school", updateSchool);
staffRoutes.patch("/staff/school", updateSchool);

// ---------- branches ----------

staffRoutes.get("/staff/branches", async (c) => {
  const school = await staffSchool(c);
  const rows = await dbOf(c).query<BranchRow>(
    `SELECT * FROM branches WHERE school_id = $1 ORDER BY created_at, name`,
    [school.id]
  );
  return c.json(rows.map(toBranch));
});

staffRoutes.post("/staff/branches", async (c) => {
  requireRole(c, "school_admin");
  const school = await staffSchool(c);
  const body = await readBody(c, branchSchema);
  const [row] = await dbOf(c).query<BranchRow>(
    `INSERT INTO branches (id, school_id, name, address, map_url, phone, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [newId(), school.id, body.name, body.address || null, body.mapUrl || null, body.phone || null, nowOf(c).toISOString()]
  );
  await audit(c, "branch.create", { schoolId: school.id, target: row!.id, meta: { name: body.name } });
  return c.json(toBranch(row!), 201);
});

staffRoutes.patch("/staff/branches/:id", async (c) => {
  requireRole(c, "school_admin");
  const school = await staffSchool(c);
  const body = await readBody(c, branchPatchSchema);
  const { sets, params } = buildSet(
    {
      name: body.name,
      address: emptyToNull(body.address),
      map_url: emptyToNull(body.mapUrl),
      phone: emptyToNull(body.phone)
    },
    3
  );
  const db = dbOf(c);
  const rows = sets.length
    ? await db.query<BranchRow>(
        `UPDATE branches SET ${sets.join(", ")} WHERE id = $1 AND school_id = $2 RETURNING *`,
        [c.req.param("id"), school.id, ...params]
      )
    : await db.query<BranchRow>(`SELECT * FROM branches WHERE id = $1 AND school_id = $2`, [c.req.param("id"), school.id]);
  if (!rows[0]) throw new Fail("not_found");
  await audit(c, "branch.update", { schoolId: school.id, target: rows[0].id, meta: { fields: Object.keys(body) } });
  return c.json(toBranch(rows[0]));
});

staffRoutes.delete("/staff/branches/:id", async (c) => {
  requireRole(c, "school_admin");
  const school = await staffSchool(c);
  const rows = await dbOf(c).query<{ id: string; name: string }>(
    `DELETE FROM branches WHERE id = $1 AND school_id = $2 RETURNING id, name`,
    [c.req.param("id"), school.id]
  );
  if (!rows[0]) throw new Fail("not_found");
  await audit(c, "branch.delete", { schoolId: school.id, target: rows[0].id, meta: { name: rows[0].name } });
  return c.json({ ok: true as const });
});

// ---------- staff users ----------

staffRoutes.get("/staff/users", async (c) => {
  // Instructors may list colleagues (read-only) to assign students; only admins manage them.
  const school = await staffSchool(c);
  const rows = await dbOf(c).query<UserRow>(
    `SELECT * FROM users WHERE school_id = $1 ORDER BY role, name`,
    [school.id]
  );
  return c.json(rows.map(toStaffUser));
});

staffRoutes.post("/staff/users", async (c) => {
  requireRole(c, "school_admin");
  const school = await staffSchool(c);
  const body = await readBody(c, staffUserCreateSchema);
  const db = dbOf(c);
  await assertBranch(db, school.id, body.branchId);
  const existing = await db.query(`SELECT 1 FROM users WHERE email = $1`, [body.email]);
  if (existing.length) throw new Fail("conflict", "email already in use");
  const [row] = await db.query<UserRow>(
    `INSERT INTO users (id, email, name, role, school_id, branch_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [newId(), body.email, body.name, body.role, school.id, body.branchId ?? null, nowOf(c).toISOString()]
  );
  await audit(c, "user.create", { schoolId: school.id, target: row!.id, meta: { email: body.email, role: body.role } });
  return c.json(toStaffUser(row!), 201);
});

staffRoutes.patch("/staff/users/:id", async (c) => {
  const me = requireRole(c, "school_admin");
  const school = await staffSchool(c);
  const body = await readBody(c, staffUserPatchSchema);
  const db = dbOf(c);
  const id = c.req.param("id");
  if (id === me.id && body.role && body.role !== me.role) throw new Fail("bad_request", "cannot change own role");
  await assertBranch(db, school.id, body.branchId);
  const { sets, params } = buildSet({ name: body.name, role: body.role, branch_id: body.branchId }, 3);
  const rows = sets.length
    ? await db.query<UserRow>(
        `UPDATE users SET ${sets.join(", ")} WHERE id = $1 AND school_id = $2 AND role <> 'super_admin' RETURNING *`,
        [id, school.id, ...params]
      )
    : await db.query<UserRow>(`SELECT * FROM users WHERE id = $1 AND school_id = $2`, [id, school.id]);
  if (!rows[0]) throw new Fail("not_found");
  await audit(c, "user.update", { schoolId: school.id, target: id, meta: { fields: Object.keys(body), role: body.role ?? null } });
  return c.json(toStaffUser(rows[0]));
});

staffRoutes.delete("/staff/users/:id", async (c) => {
  const me = requireRole(c, "school_admin");
  const school = await staffSchool(c);
  const id = c.req.param("id");
  if (id === me.id) throw new Fail("bad_request", "cannot delete yourself");
  const rows = await dbOf(c).query<{ id: string; email: string }>(
    `DELETE FROM users WHERE id = $1 AND school_id = $2 AND role <> 'super_admin' RETURNING id, email`,
    [id, school.id]
  );
  if (!rows[0]) throw new Fail("not_found");
  await audit(c, "user.delete", { schoolId: school.id, target: id, meta: { email: rows[0].email } });
  return c.json({ ok: true as const });
});

// ---------- invite codes ----------

staffRoutes.get("/staff/invite-codes", async (c) => {
  const school = await staffSchool(c);
  const rows = await dbOf(c).query<InviteRow>(
    `SELECT * FROM invite_codes WHERE school_id = $1 ORDER BY created_at DESC`,
    [school.id]
  );
  return c.json(rows.map(toInvite));
});

staffRoutes.post("/staff/invite-codes", async (c) => {
  requireRole(c, "school_admin");
  const school = await staffSchool(c);
  const body = await readBody(c, inviteCreateSchema);
  const db = dbOf(c);
  await assertBranch(db, school.id, body.branchId);
  await assertInstructor(db, school.id, body.instructorId);
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode(6);
    const rows = await db.query<InviteRow>(
      `INSERT INTO invite_codes (code, school_id, label, branch_id, instructor_id, max_uses, uses, expires_at, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7, true, $8)
       ON CONFLICT (code) DO NOTHING RETURNING *`,
      [
        code,
        school.id,
        body.label || null,
        body.branchId ?? null,
        body.instructorId ?? null,
        body.maxUses ?? null,
        body.expiresAt ? new Date(body.expiresAt).toISOString() : null,
        nowOf(c).toISOString()
      ]
    );
    if (rows[0]) {
      await audit(c, "invite.create", { schoolId: school.id, target: code });
      return c.json(toInvite(rows[0]), 201);
    }
  }
  throw new Fail("server_error", "could not allocate code");
});

staffRoutes.patch("/staff/invite-codes/:code", async (c) => {
  requireRole(c, "school_admin");
  const school = await staffSchool(c);
  const body = await readBody(c, invitePatchSchema);
  const db = dbOf(c);
  await assertBranch(db, school.id, body.branchId);
  await assertInstructor(db, school.id, body.instructorId);
  const { sets, params } = buildSet(
    {
      label: emptyToNull(body.label),
      branch_id: body.branchId,
      instructor_id: body.instructorId,
      max_uses: body.maxUses,
      expires_at: body.expiresAt === undefined ? undefined : body.expiresAt ? new Date(body.expiresAt).toISOString() : null,
      active: body.active
    },
    3
  );
  const code = c.req.param("code").toUpperCase();
  const rows = sets.length
    ? await db.query<InviteRow>(
        `UPDATE invite_codes SET ${sets.join(", ")} WHERE code = $1 AND school_id = $2 RETURNING *`,
        [code, school.id, ...params]
      )
    : await db.query<InviteRow>(`SELECT * FROM invite_codes WHERE code = $1 AND school_id = $2`, [code, school.id]);
  if (!rows[0]) throw new Fail("not_found");
  await audit(c, "invite.update", { schoolId: school.id, target: code, meta: { fields: Object.keys(body) } });
  return c.json(toInvite(rows[0]));
});

staffRoutes.delete("/staff/invite-codes/:code", async (c) => {
  requireRole(c, "school_admin");
  const school = await staffSchool(c);
  const code = c.req.param("code").toUpperCase();
  const rows = await dbOf(c).query(`DELETE FROM invite_codes WHERE code = $1 AND school_id = $2 RETURNING code`, [
    code,
    school.id
  ]);
  if (!rows[0]) throw new Fail("not_found");
  await audit(c, "invite.delete", { schoolId: school.id, target: code });
  return c.json({ ok: true as const });
});

// ---------- students ----------

const studentStatuses = new Set(["lead", "registered", "practicing", "exam_ready", "passed", "inactive"]);

staffRoutes.get("/staff/students", async (c) => {
  const user = staffOf(c);
  const school = await staffSchool(c);
  const where = ["school_id = $1"];
  const params: unknown[] = [school.id];
  const add = (clause: (n: number) => string, value: unknown) => {
    params.push(value);
    where.push(clause(params.length));
  };
  const status = c.req.query("status");
  if (status) {
    if (!studentStatuses.has(status)) throw new Fail("bad_request", "unknown status");
    add((n) => `status = $${n}`, status);
  }
  const branchId = c.req.query("branchId");
  if (branchId) add((n) => `branch_id = $${n}`, branchId);
  const instructorId = c.req.query("instructorId");
  if (instructorId) add((n) => `instructor_id = $${n}`, instructorId);
  if (c.req.query("mine") === "1") add((n) => `instructor_id = $${n}`, user.id);
  const q = c.req.query("q")?.trim();
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    add((n) => `(display_name ILIKE $${n} OR coalesce(phone, '') ILIKE $${n} OR coalesce(notes, '') ILIKE $${n})`, pattern);
  }
  const rows = await dbOf(c).query<StudentRow>(
    `SELECT ${STUDENT_LIST_COLUMNS} FROM students WHERE ${where.join(" AND ")}
     ORDER BY coalesce(last_active_at, created_at) DESC LIMIT 2000`,
    params
  );
  const withMetrics = effectiveFeatures(school).instructorDashboard;
  return c.json(rows.map((row) => toStaffStudent(row, withMetrics)));
});

staffRoutes.post("/staff/students", async (c) => {
  const user = requireRole(c, "school_admin", "instructor");
  const school = await staffSchool(c);
  const body = await readBody(c, studentCreateSchema);
  const db = dbOf(c);
  const status = body.status ?? "registered";
  if (status !== "lead") await assertStudentCapacity(db, school);
  await assertBranch(db, school.id, body.branchId);
  await assertInstructor(db, school.id, body.instructorId);
  const instructorId =
    body.instructorId !== undefined ? body.instructorId : user.role === "instructor" ? user.id : null;
  const [row] = await db.query<StudentRow>(
    `INSERT INTO students (id, school_id, display_name, phone, status, package, branch_id, instructor_id, source, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'staff', $9) RETURNING *`,
    [
      newId(),
      school.id,
      body.displayName,
      body.phone || null,
      status,
      body.package ?? null,
      body.branchId ?? (user.role === "instructor" ? user.branch_id : null) ?? null,
      instructorId ?? null,
      nowOf(c).toISOString()
    ]
  );
  await audit(c, "student.create", { schoolId: school.id, target: row!.id });
  return c.json(toStaffStudent(row!, effectiveFeatures(school).instructorDashboard), 201);
});

async function studentInSchool(db: Db, school: SchoolRow, id: string): Promise<StudentRow> {
  const [row] = await db.query<StudentRow>(`SELECT * FROM students WHERE id = $1 AND school_id = $2`, [id, school.id]);
  if (!row) throw new Fail("not_found");
  return row;
}

staffRoutes.get("/staff/students/:id", async (c) => {
  const school = await staffSchool(c);
  const row = await studentInSchool(dbOf(c), school, c.req.param("id"));
  await audit(c, "student.view", { schoolId: school.id, target: row.id });
  return c.json(toStaffStudentDetail(row, effectiveFeatures(school).instructorDashboard));
});

staffRoutes.patch("/staff/students/:id", async (c) => {
  requireRole(c, "school_admin", "instructor");
  const school = await staffSchool(c);
  const body = await readBody(c, studentUpdateSchema);
  const db = dbOf(c);
  const current = await studentInSchool(db, school, c.req.param("id"));
  if (current.status === "lead" && body.status && body.status !== "lead") await assertStudentCapacity(db, school);
  await assertBranch(db, school.id, body.branchId);
  await assertInstructor(db, school.id, body.instructorId);
  const { sets, params } = buildSet(
    {
      display_name: body.displayName,
      phone: emptyToNull(body.phone),
      status: body.status,
      package: body.package,
      branch_id: body.branchId,
      instructor_id: body.instructorId,
      payment_note: emptyToNull(body.paymentNote),
      exam_date: body.examDate,
      lesson_date: body.lessonDate,
      notes: emptyToNull(body.notes)
    },
    3
  );
  const rows = sets.length
    ? await db.query<StudentRow>(
        `UPDATE students SET ${sets.join(", ")} WHERE id = $1 AND school_id = $2 RETURNING *`,
        [current.id, school.id, ...params]
      )
    : [current];
  await audit(c, "student.update", { schoolId: school.id, target: current.id, meta: { fields: Object.keys(body) } });
  return c.json(toStaffStudent(rows[0]!, effectiveFeatures(school).instructorDashboard));
});

staffRoutes.delete("/staff/students/:id", async (c) => {
  requireRole(c, "school_admin");
  const school = await staffSchool(c);
  const db = dbOf(c);
  const row = await studentInSchool(db, school, c.req.param("id"));
  await deleteStudentData(db, row.id);
  await audit(c, "student.delete", { schoolId: school.id, target: row.id, meta: { status: row.status } });
  return c.json({ ok: true as const });
});

/** Extra: generate a login code so a staff-registered student can link their device. */
staffRoutes.post("/staff/students/:id/login-code", async (c) => {
  requireRole(c, "school_admin", "instructor");
  const school = await staffSchool(c);
  requireFeature(school, "cloudStudents");
  const db = dbOf(c);
  const row = await studentInSchool(db, school, c.req.param("id"));
  if (row.status === "lead") throw new Fail("bad_request", "convert the lead to a student first");
  const loginCode = await issueLoginCode(db, row.id);
  await audit(c, "student.login_code", { schoolId: school.id, target: row.id });
  return c.json({ loginCode });
});

// ---------- overview ----------

staffRoutes.get("/staff/overview", async (c) => {
  const school = await staffSchool(c);
  requireFeature(school, "instructorDashboard");
  return c.json(
    await computeOverview(dbOf(c), school, nowOf(c), {
      branchId: c.req.query("branchId") || null,
      instructorId: c.req.query("instructorId") || null
    })
  );
});

// ---------- appointments ----------

const appointmentStatuses = new Set(["requested", "confirmed", "done", "cancelled"]);

staffRoutes.get("/staff/appointments", async (c) => {
  const school = await staffSchool(c);
  const status = c.req.query("status");
  if (status && !appointmentStatuses.has(status)) throw new Fail("bad_request", "unknown status");
  const rows = await dbOf(c).query<AppointmentRow>(
    status
      ? `SELECT * FROM appointments WHERE school_id = $1 AND status = $2 ORDER BY preferred_at, created_at`
      : `SELECT * FROM appointments WHERE school_id = $1 ORDER BY preferred_at, created_at`,
    status ? [school.id, status] : [school.id]
  );
  return c.json(rows.map(toAppointment));
});

staffRoutes.patch("/staff/appointments/:id", async (c) => {
  requireRole(c, "school_admin", "instructor");
  const school = await staffSchool(c);
  const body = await readBody(c, appointmentPatchSchema);
  const db = dbOf(c);
  const { sets, params } = buildSet(
    { status: body.status, notes: emptyToNull(body.notes), preferred_at: body.preferredAt },
    3
  );
  const rows = sets.length
    ? await db.query<AppointmentRow>(
        `UPDATE appointments SET ${sets.join(", ")} WHERE id = $1 AND school_id = $2 RETURNING *`,
        [c.req.param("id"), school.id, ...params]
      )
    : await db.query<AppointmentRow>(`SELECT * FROM appointments WHERE id = $1 AND school_id = $2`, [
        c.req.param("id"),
        school.id
      ]);
  if (!rows[0]) throw new Fail("not_found");
  await audit(c, "appointment.update", { schoolId: school.id, target: rows[0].id, meta: { status: body.status ?? null } });
  return c.json(toAppointment(rows[0]));
});

// ---------- question notes & flags ----------

interface NoteRow {
  id: string;
  question_id: number;
  visibility: "private" | "school";
  body: string;
  video_url: string | null;
  author_name: string;
  author_id: string | null;
  created_at: unknown;
}

const toNote = (row: NoteRow): QuestionNote => ({
  id: row.id,
  questionId: row.question_id,
  visibility: row.visibility,
  body: row.body,
  videoUrl: row.video_url,
  authorName: row.author_name,
  createdAt: isoRequired(row.created_at)
});

staffRoutes.get("/staff/question-notes", async (c) => {
  const user = staffOf(c);
  const school = await staffSchool(c);
  const questionId = c.req.query("questionId");
  const params: unknown[] = [school.id, user.id];
  let filter = "";
  if (questionId) {
    const parsed = Number(questionId);
    if (!Number.isInteger(parsed)) throw new Fail("bad_request", "questionId");
    params.push(parsed);
    filter = " AND question_id = $3";
  }
  const rows = await dbOf(c).query<NoteRow>(
    `SELECT * FROM question_notes WHERE school_id = $1 AND (visibility = 'school' OR author_id = $2)${filter}
     ORDER BY question_id, created_at`,
    params
  );
  return c.json(rows.map(toNote));
});

staffRoutes.post("/staff/question-notes", async (c) => {
  const user = staffOf(c);
  const school = await staffSchool(c);
  const body = await readBody(c, noteCreateSchema);
  const [row] = await dbOf(c).query<NoteRow>(
    `INSERT INTO question_notes (id, school_id, author_id, author_name, question_id, visibility, body, video_url, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [newId(), school.id, user.id, user.name, body.questionId, body.visibility, body.body, body.videoUrl || null, nowOf(c).toISOString()]
  );
  return c.json(toNote(row!), 201);
});

staffRoutes.delete("/staff/question-notes/:id", async (c) => {
  const user = staffOf(c);
  const school = await staffSchool(c);
  const db = dbOf(c);
  const [row] = await db.query<NoteRow>(`SELECT * FROM question_notes WHERE id = $1 AND school_id = $2`, [
    c.req.param("id"),
    school.id
  ]);
  if (!row || (row.visibility === "private" && row.author_id !== user.id)) throw new Fail("not_found");
  if (row.author_id !== user.id && user.role === "instructor") throw new Fail("forbidden");
  await db.query(`DELETE FROM question_notes WHERE id = $1`, [row.id]);
  return c.json({ ok: true as const });
});

staffRoutes.post("/staff/question-flags", async (c) => {
  const user = staffOf(c);
  const school = await staffSchool(c);
  const body = await readBody(c, flagCreateSchema);
  await dbOf(c).query(
    `INSERT INTO question_flags (id, school_id, user_id, question_id, reason, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [newId(), school.id, user.id, body.questionId, body.reason || null, nowOf(c).toISOString()]
  );
  return c.json({ ok: true as const });
});

// ---------- audit, export, retention ----------

staffRoutes.get("/staff/audit-log", async (c) => {
  requireRole(c, "school_admin");
  const school = await staffSchool(c);
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 200, 1), 1000);
  const rows = await dbOf(c).query<AuditRow>(
    `SELECT * FROM audit_log WHERE school_id = $1 ORDER BY at DESC LIMIT ${limit}`,
    [school.id]
  );
  return c.json(rows.map(toAudit));
});

staffRoutes.get("/staff/export", async (c) => {
  requireRole(c, "school_admin");
  const school = await staffSchool(c);
  const db = dbOf(c);
  const [users, invites, students, appointments, notes, flags, events] = await Promise.all([
    db.query<UserRow>(`SELECT * FROM users WHERE school_id = $1 ORDER BY created_at`, [school.id]),
    db.query<InviteRow>(`SELECT * FROM invite_codes WHERE school_id = $1 ORDER BY created_at`, [school.id]),
    db.query<StudentRow>(`SELECT * FROM students WHERE school_id = $1 ORDER BY created_at`, [school.id]),
    db.query<AppointmentRow>(`SELECT * FROM appointments WHERE school_id = $1 ORDER BY created_at`, [school.id]),
    db.query<NoteRow>(`SELECT * FROM question_notes WHERE school_id = $1 AND visibility = 'school' ORDER BY created_at`, [school.id]),
    db.query<{ question_id: number; reason: string | null; created_at: unknown }>(
      `SELECT question_id, reason, created_at FROM question_flags WHERE school_id = $1 ORDER BY created_at`,
      [school.id]
    ),
    db.query<{ day: string; kind: string; ref: string; count: number }>(
      `SELECT day, kind, ref, count FROM events WHERE school_id = $1 ORDER BY day, kind`,
      [school.id]
    )
  ]);
  await audit(c, "school.export", { schoolId: school.id, meta: { students: students.length } });
  c.header("Content-Disposition", `attachment; filename="${school.slug}-export.json"`);
  return c.json({
    exportedAt: nowOf(c).toISOString(),
    school: await schoolSettings(db, school),
    users: users.map(toStaffUser),
    inviteCodes: invites.map(toInvite),
    students: students.map((row) => ({
      ...toStaffStudentDetail(row, true),
      consentVersion: row.consent_version,
      progress: row.progress
    })),
    appointments: appointments.map(toAppointment),
    questionNotes: notes.map(toNote),
    questionFlags: flags.map((row) => ({ questionId: row.question_id, reason: row.reason, at: iso(row.created_at) })),
    events
  });
});

staffRoutes.get("/staff/export/students.csv", async (c) => {
  requireRole(c, "school_admin");
  const school = await staffSchool(c);
  const db = dbOf(c);
  const [rows, branches, users] = await Promise.all([
    db.query<StudentRow>(`SELECT ${STUDENT_LIST_COLUMNS} FROM students WHERE school_id = $1 ORDER BY created_at`, [school.id]),
    db.query<BranchRow>(`SELECT * FROM branches WHERE school_id = $1`, [school.id]),
    db.query<UserRow>(`SELECT * FROM users WHERE school_id = $1`, [school.id])
  ]);
  const branchName = new Map(branches.map((row) => [row.id, row.name]));
  const userName = new Map(users.map((row) => [row.id, row.name]));
  const csv = toCsv(
    [
      "id", "name", "phone", "status", "package", "branch", "instructor", "exam_date", "lesson_date",
      "payment_note", "notes", "source", "interest", "linked", "readiness", "readiness_label",
      "exams_taken", "passes", "avg_score_pct", "last_active_at", "created_at", "consent_at"
    ],
    rows.map((row) => [
      row.id,
      row.display_name,
      row.phone,
      row.status,
      row.package,
      row.branch_id ? branchName.get(row.branch_id) ?? row.branch_id : "",
      row.instructor_id ? userName.get(row.instructor_id) ?? row.instructor_id : "",
      row.exam_date,
      row.lesson_date,
      row.payment_note,
      row.notes,
      row.source,
      row.interest,
      row.linked_at ? "yes" : "no",
      row.metrics?.readiness ?? "",
      row.metrics?.readinessLabel ?? "",
      row.metrics?.examsTaken ?? "",
      row.metrics?.passes ?? "",
      row.metrics?.avgScorePct ?? "",
      iso(row.last_active_at),
      iso(row.created_at),
      iso(row.consent_at)
    ])
  );
  await audit(c, "students.export", { schoolId: school.id, meta: { rows: rows.length, format: "csv" } });
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${school.slug}-students.csv"`
  });
});

staffRoutes.post("/staff/retention/run", async (c) => {
  requireRole(c, "school_admin");
  const school = await staffSchool(c);
  const deleted = await purgeSchool(dbOf(c), school, nowOf(c));
  await audit(c, "retention.run", { schoolId: school.id, meta: { deleted, retentionDays: school.retention_days } });
  return c.json({ ok: true as const, deleted, retentionDays: school.retention_days });
});

// ---------- AI instructor note ----------

staffRoutes.post("/staff/ai/instructor-note", async (c) => {
  rateLimit(c, "ai");
  const school = await staffSchool(c);
  requireFeature(school, "ai");
  const body = await readBody(c, instructorNoteSchema);
  const ai = depsOf(c).ai;
  if (!ai) throw new Fail("ai_unavailable");
  const question = QUESTIONS.find((item) => item.id === body.questionId);
  if (!question) throw new Fail("not_found", "question");

  // Anonymous school aggregate for this question (no names sent to the model).
  const rows = await dbOf(c).query<{ stat: { seen?: number; wrong?: number; picks?: number[] } | null }>(
    `SELECT progress -> 'questions' -> $2 AS stat FROM students
     WHERE school_id = $1 AND progress IS NOT NULL AND progress -> 'questions' ? $2`,
    [school.id, String(question.id)]
  );
  const stats = { students: 0, wrong: 0, seen: 0, picks: question.options.map(() => 0) };
  for (const row of rows) {
    if (!row.stat) continue;
    stats.students += 1;
    stats.seen += Number(row.stat.seen) || 0;
    stats.wrong += Number(row.stat.wrong) || 0;
    row.stat.picks?.forEach((count, index) => {
      if (index < stats.picks.length) stats.picks[index]! += Number(count) || 0;
    });
  }
  try {
    const text = await ai(instructorNotePrompt(question, body.lang, stats));
    return c.json({ text });
  } catch (error) {
    if (error instanceof AiRefusal) throw new Fail("ai_unavailable", "refused");
    console.error("[ai] instructor-note failed", error);
    throw new Fail("ai_unavailable", "upstream");
  }
});
