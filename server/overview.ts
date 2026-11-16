import type { StaffOverview, StudentMetrics, StudentStatus } from "../src/api/types.js";
import type { TopicId } from "../src/domain/types.js";
import type { SchoolRow } from "./context.js";
import { isoRequired, type Db } from "./db.js";
import { addDays, dayKey, lastDays } from "./lib.js";

interface OverviewStudentRow {
  id: string;
  status: StudentStatus;
  branch_id: string | null;
  instructor_id: string | null;
  exam_date: string | null;
  linked_at: unknown;
  metrics: StudentMetrics | null;
  last_active_at: unknown;
  created_at: unknown;
  questions: Record<string, { seen?: number; wrong?: number }> | null;
  history: { passed?: boolean }[] | null;
}

const STATUSES: StudentStatus[] = ["lead", "registered", "practicing", "exam_ready", "passed", "inactive"];

const round1 = (value: number) => Math.round(value * 10) / 10;

export async function computeOverview(
  db: Db,
  school: SchoolRow,
  now: Date,
  filters: { branchId: string | null; instructorId: string | null }
): Promise<StaffOverview> {
  const where = ["school_id = $1"];
  const params: unknown[] = [school.id];
  if (filters.branchId) {
    params.push(filters.branchId);
    where.push(`branch_id = $${params.length}`);
  }
  if (filters.instructorId) {
    params.push(filters.instructorId);
    where.push(`instructor_id = $${params.length}`);
  }
  const students = await db.query<OverviewStudentRow>(
    `SELECT id, status, branch_id, instructor_id, exam_date, linked_at, metrics, last_active_at, created_at,
       progress -> 'questions' AS questions, progress -> 'history' AS history
     FROM students WHERE ${where.join(" AND ")}`,
    params
  );
  const [branches, staff] = await Promise.all([
    db.query<{ id: string; name: string }>(`SELECT id, name FROM branches WHERE school_id = $1 ORDER BY name`, [school.id]),
    db.query<{ id: string; name: string }>(`SELECT id, name FROM users WHERE school_id = $1 ORDER BY name`, [school.id])
  ]);

  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<StudentStatus, number>;
  const today = dayKey(now);
  const in14 = dayKey(addDays(now, 14));
  const weekAgo = addDays(now, -7).getTime();

  let linkedStudents = 0;
  let ready = 0;
  let atRisk = 0;
  let inactive7d = 0;
  const scores: number[] = [];
  const wrongAgg = new Map<number, { wrong: number; attempts: number }>();
  const topicAgg = new Map<string, { sum: number; students: number }>();
  const branchAgg = new Map<string | null, { students: number; ready: number }>();
  const instructorAgg = new Map<string | null, { students: number; ready: number }>();

  for (const student of students) {
    counts[student.status] = (counts[student.status] ?? 0) + 1;
    if (student.status === "lead") continue;

    const metrics = student.metrics;
    const isReady = metrics?.readinessLabel === "ready";
    const bump = (map: Map<string | null, { students: number; ready: number }>, key: string | null) => {
      const entry = map.get(key) ?? { students: 0, ready: 0 };
      entry.students += 1;
      if (isReady) entry.ready += 1;
      map.set(key, entry);
    };
    bump(branchAgg, student.branch_id);
    bump(instructorAgg, student.instructor_id);

    const linked = student.linked_at !== null && student.linked_at !== undefined;
    if (!linked) continue;
    linkedStudents += 1;
    if (isReady) ready += 1;

    const active = student.status !== "passed" && student.status !== "inactive";
    if (active) {
      const examSoon = Boolean(student.exam_date && student.exam_date.slice(0, 10) >= today && student.exam_date.slice(0, 10) <= in14);
      const lowReadiness = (metrics?.readiness ?? 0) < 50;
      const history = Array.isArray(student.history) ? student.history : [];
      const last3 = history.slice(-3);
      const failingLast3 = last3.length === 3 && last3.every((item) => !item.passed);
      if ((examSoon && lowReadiness) || failingLast3) atRisk += 1;

      const lastActive = new Date(isoRequired(student.last_active_at ?? student.linked_at)).getTime();
      if (lastActive < weekAgo) inactive7d += 1;
    }

    if (typeof metrics?.avgScorePct === "number") scores.push(metrics.avgScorePct);

    for (const [id, stat] of Object.entries(student.questions ?? {})) {
      const questionId = Number(id);
      if (!Number.isFinite(questionId)) continue;
      const entry = wrongAgg.get(questionId) ?? { wrong: 0, attempts: 0 };
      entry.wrong += Number(stat?.wrong) || 0;
      entry.attempts += Number(stat?.seen) || 0;
      wrongAgg.set(questionId, entry);
    }

    for (const [topic, accuracy] of Object.entries(metrics?.topicAccuracy ?? {})) {
      if (typeof accuracy !== "number" || !Number.isFinite(accuracy)) continue;
      const entry = topicAgg.get(topic) ?? { sum: 0, students: 0 };
      entry.sum += accuracy;
      entry.students += 1;
      topicAgg.set(topic, entry);
    }
  }

  const topWrong = [...wrongAgg.entries()]
    .filter(([, value]) => value.wrong > 0)
    .map(([questionId, value]) => ({
      questionId,
      wrong: value.wrong,
      attempts: value.attempts,
      wrongRate: value.attempts > 0 ? Math.round((value.wrong / value.attempts) * 1000) / 1000 : 1
    }))
    .sort((a, b) => b.wrong - a.wrong || b.wrongRate - a.wrongRate)
    .slice(0, 15);

  const weakTopics = [...topicAgg.entries()]
    .map(([topic, value]) => ({
      topic: topic as TopicId,
      accuracy: round1(value.sum / value.students),
      students: value.students
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 8);

  const branchName = new Map(branches.map((row) => [row.id, row.name]));
  const staffName = new Map(staff.map((row) => [row.id, row.name]));
  const byBranch = [...branchAgg.entries()]
    .map(([branchId, value]) => ({
      branchId,
      name: branchId ? (branchName.get(branchId) ?? "") : "",
      students: value.students,
      ready: value.ready
    }))
    .sort((a, b) => b.students - a.students);
  const byInstructor = [...instructorAgg.entries()]
    .map(([instructorId, value]) => ({
      instructorId,
      name: instructorId ? (staffName.get(instructorId) ?? "") : "",
      students: value.students,
      ready: value.ready
    }))
    .sort((a, b) => b.students - a.students);

  // Usage: last 30 days of anonymous counters for this school (zero-filled).
  const days = lastDays(now, 30);
  const eventRows = await db.query<{ day: string; kind: string; n: number }>(
    `SELECT day, kind, sum(count)::int AS n FROM events WHERE school_id = $1 AND day >= $2 GROUP BY day, kind`,
    [school.id, days[0]]
  );
  const usageMap = new Map(days.map((day) => [day, { day, visits: 0, exams: 0, passes: 0, leads: 0, qrScans: 0 }]));
  for (const row of eventRows) {
    const entry = usageMap.get(row.day);
    if (!entry) continue;
    if (row.kind === "visit") entry.visits += row.n;
    else if (row.kind === "exam_completed") entry.exams += row.n;
    else if (row.kind === "exam_passed") entry.passes += row.n;
    else if (row.kind === "lead") entry.leads += row.n;
    else if (row.kind === "qr_scan") entry.qrScans += row.n;
  }

  const flagged = await db.query<{ question_id: number; n: number }>(
    `SELECT question_id, count(*)::int AS n FROM question_flags WHERE school_id = $1
     GROUP BY question_id ORDER BY n DESC, question_id LIMIT 50`,
    [school.id]
  );

  return {
    counts,
    linkedStudents,
    ready,
    atRisk,
    inactive7d,
    avgScorePct: scores.length ? round1(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
    topWrong,
    weakTopics,
    byBranch,
    byInstructor,
    usage: [...usageMap.values()],
    flagged: flagged.map((row) => ({ questionId: row.question_id, count: row.n }))
  };
}
