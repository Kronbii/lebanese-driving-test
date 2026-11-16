import type { EventKind } from "../src/api/types";
import type { SchoolRow } from "./context";
import type { Db } from "./db";
import { addDays, dayKey, Fail } from "./lib";

/** Anonymous counter: upsert-increment (day, school, kind, ref). Never stores IP/UA. */
export async function bumpEvent(
  db: Db,
  now: Date,
  schoolId: string | null,
  kind: EventKind,
  ref: string | null = null
) {
  await db.query(
    `INSERT INTO events (day, school_id, kind, ref, count) VALUES ($1, $2, $3, $4, 1)
     ON CONFLICT (day, school_id, kind, ref) DO UPDATE SET count = events.count + 1`,
    [dayKey(now), schoolId ?? "public", kind, ref ?? ""]
  );
}

/** Students (not leads) count against the plan's studentLimit. */
export async function assertStudentCapacity(db: Db, school: SchoolRow) {
  if (school.student_limit === null || school.student_limit === undefined) return;
  const [row] = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM students WHERE school_id = $1 AND status <> 'lead'`,
    [school.id]
  );
  if ((row?.n ?? 0) >= school.student_limit) throw new Fail("limit_reached", "student_limit");
}

/** Deletes a student and everything hanging off it (device tokens, appointments cascade). */
export async function deleteStudentData(db: Db, studentId: string) {
  await db.query(`DELETE FROM device_tokens WHERE student_id = $1`, [studentId]);
  await db.query(`DELETE FROM appointments WHERE student_id = $1`, [studentId]);
  await db.query(`DELETE FROM students WHERE id = $1`, [studentId]);
}

/**
 * Retention: delete students whose last activity (or creation, if never active) is older
 * than the school's retention_days. Returns the number deleted.
 */
export async function purgeSchool(db: Db, school: Pick<SchoolRow, "id" | "retention_days">, now: Date) {
  if (!school.retention_days) return 0;
  const cutoff = addDays(now, -school.retention_days).toISOString();
  const rows = await db.query<{ id: string }>(
    `SELECT id FROM students WHERE school_id = $1 AND coalesce(last_active_at, created_at) < $2`,
    [school.id, cutoff]
  );
  for (const row of rows) await deleteStudentData(db, row.id);
  return rows.length;
}

export async function purgeAll(db: Db, now: Date) {
  const schools = await db.query<Pick<SchoolRow, "id" | "retention_days">>(
    `SELECT id, retention_days FROM schools WHERE retention_days IS NOT NULL`
  );
  const results: { schoolId: string; deleted: number }[] = [];
  for (const school of schools) {
    const deleted = await purgeSchool(db, school, now);
    results.push({ schoolId: school.id, deleted });
  }
  return results;
}

/** Ensures a branch/instructor reference belongs to the school (or is null). */
export async function assertBranch(db: Db, schoolId: string, branchId: string | null | undefined) {
  if (!branchId) return;
  const rows = await db.query(`SELECT 1 FROM branches WHERE id = $1 AND school_id = $2`, [branchId, schoolId]);
  if (!rows.length) throw new Fail("bad_request", "unknown branchId");
}

export async function assertInstructor(db: Db, schoolId: string, userId: string | null | undefined) {
  if (!userId) return;
  const rows = await db.query(`SELECT 1 FROM users WHERE id = $1 AND school_id = $2`, [userId, schoolId]);
  if (!rows.length) throw new Fail("bad_request", "unknown instructorId");
}
