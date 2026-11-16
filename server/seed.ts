/**
 * Demo data for local development: `npm run seed`.
 * Writes to PGlite at .data/pglite (or DATABASE_URL). Idempotent: skips if school "demo" exists.
 * PGlite allows one process per data dir — stop `npm run dev:api` while seeding.
 *
 * All names, phones and numbers are synthetic.
 */
import { pathToFileURL } from "node:url";
import type { SchoolBranding, SchoolContact, SchoolLanding, StudentMetrics, StudentStatus } from "../src/api/types.js";
import { QUESTIONS } from "../src/data/questions.js";
import type { ProgressState, Question, QuestionProgress, TopicId } from "../src/domain/types.js";
import { createDbFromEnv, json, type Db } from "./db.js";
import { addDays, dayKey, newId, readEnv } from "./lib.js";
import { migrate } from "./schema.js";

/** Deterministic PRNG so the demo looks the same on every machine. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const TOPICS: TopicId[] = [
  "gear",
  "maintenance",
  "control",
  "traffic_rules",
  "hazards",
  "law_penalties",
  "first_aid",
  "signs_warning",
  "signs_prohibition",
  "signs_mandatory"
];

interface Profile {
  name: string;
  status: StudentStatus;
  /** Share of the bank seen, 0..1 (0 = no progress synced). */
  coverage: number;
  accuracy: number;
  exams: boolean[];
  readiness: number;
  label: StudentMetrics["readinessLabel"];
  lastActiveDaysAgo: number | null;
  examInDays: number | null;
  linked: boolean;
  branch: 0 | 1;
  instructor: boolean;
  pkg: "theory" | "motorcycle" | "car" | "full";
  payment?: string;
}

const PROFILES: Profile[] = [
  { name: "Demo Student 1", status: "exam_ready", coverage: 0.95, accuracy: 0.92, exams: [true, true, false, true, true], readiness: 88, label: "ready", lastActiveDaysAgo: 0, examInDays: 5, linked: true, branch: 0, instructor: true, pkg: "motorcycle", payment: "Paid in full" },
  { name: "Demo Student 2", status: "exam_ready", coverage: 0.9, accuracy: 0.9, exams: [false, true, true, true], readiness: 85, label: "ready", lastActiveDaysAgo: 1, examInDays: 12, linked: true, branch: 1, instructor: true, pkg: "full" },
  { name: "Demo Student 3", status: "practicing", coverage: 0.7, accuracy: 0.82, exams: [false, true, true], readiness: 72, label: "almost", lastActiveDaysAgo: 0, examInDays: null, linked: true, branch: 0, instructor: true, pkg: "theory", payment: "50% paid" },
  { name: "Demo Student 4", status: "practicing", coverage: 0.35, accuracy: 0.62, exams: [false], readiness: 38, label: "not_ready", lastActiveDaysAgo: 2, examInDays: 7, linked: true, branch: 0, instructor: true, pkg: "motorcycle" },
  { name: "Demo Student 5", status: "practicing", coverage: 0.6, accuracy: 0.66, exams: [true, false, false, false], readiness: 45, label: "not_ready", lastActiveDaysAgo: 1, examInDays: 20, linked: true, branch: 1, instructor: false, pkg: "car" },
  { name: "Demo Student 6", status: "practicing", coverage: 0.8, accuracy: 0.8, exams: [true, true], readiness: 62, label: "needs_signs", lastActiveDaysAgo: 3, examInDays: null, linked: true, branch: 1, instructor: true, pkg: "motorcycle" },
  { name: "Demo Student 7", status: "registered", coverage: 0, accuracy: 0, exams: [], readiness: 0, label: "not_ready", lastActiveDaysAgo: 0, examInDays: null, linked: true, branch: 0, instructor: false, pkg: "theory" },
  { name: "Demo Student 8", status: "registered", coverage: 0, accuracy: 0, exams: [], readiness: 0, label: "not_ready", lastActiveDaysAgo: null, examInDays: null, linked: false, branch: 1, instructor: false, pkg: "full", payment: "Deposit received" },
  { name: "Demo Student 9", status: "passed", coverage: 1, accuracy: 0.94, exams: [true, true, true, true, true, true], readiness: 93, label: "ready", lastActiveDaysAgo: 6, examInDays: -4, linked: true, branch: 0, instructor: true, pkg: "motorcycle", payment: "Paid in full" },
  { name: "Demo Student 10", status: "inactive", coverage: 0.25, accuracy: 0.7, exams: [false], readiness: 40, label: "not_ready", lastActiveDaysAgo: 24, examInDays: null, linked: true, branch: 1, instructor: false, pkg: "theory" },
  { name: "Demo Student 11", status: "practicing", coverage: 0.5, accuracy: 0.75, exams: [true, false], readiness: 55, label: "almost", lastActiveDaysAgo: 9, examInDays: null, linked: true, branch: 0, instructor: true, pkg: "car" },
  { name: "Demo Student 12", status: "passed", coverage: 0.98, accuracy: 0.91, exams: [true, false, true, true, true], readiness: 90, label: "ready", lastActiveDaysAgo: 15, examInDays: -12, linked: true, branch: 1, instructor: true, pkg: "full" }
];

function buildProgress(profile: Profile, now: Date, random: () => number): { progress: ProgressState; metrics: StudentMetrics } {
  const bank = (QUESTIONS as Question[]).filter((question) => (question.category ?? "motorcycle") === "motorcycle");
  const lastActive = now.getTime() - (profile.lastActiveDaysAgo ?? 0) * 86_400_000;
  const questions: Record<number, QuestionProgress> = {};
  let signCorrect = 0;
  let signWrong = 0;
  for (const question of bank) {
    if (random() > profile.coverage) continue;
    const seen = 1 + Math.floor(random() * 4);
    let correct = 0;
    let wrong = 0;
    const picks = question.options.map(() => 0);
    for (let i = 0; i < seen; i++) {
      if (random() < profile.accuracy) correct += 1;
      else {
        wrong += 1;
        const wrongOptions = question.options.map((_, index) => index).filter((index) => index !== question.answer);
        const pick = wrongOptions[Math.floor(random() * wrongOptions.length)]!;
        picks[pick]! += 1;
      }
    }
    if (question.sign) {
      signCorrect += correct;
      signWrong += wrong;
    }
    questions[question.id] = {
      seen,
      correct,
      wrong,
      level: Math.max(0, Math.min(5, correct - wrong + 1)),
      lastExam: Math.max(0, profile.exams.length - 1),
      recentWrong: wrong > 0 && random() < 0.5 ? 1 : 0,
      lastSeenAt: lastActive - Math.floor(random() * 5 * 86_400_000),
      streak: wrong ? 0 : correct,
      ...(wrong ? { picks } : {})
    };
  }

  const history = profile.exams.map((passed, index) => {
    const score = passed ? 25 + Math.floor(random() * 6) : 15 + Math.floor(random() * 10);
    return {
      at: lastActive - (profile.exams.length - 1 - index) * 2 * 86_400_000,
      score,
      total: 30,
      passed,
      examIndex: index,
      mode: "official" as const,
      durationMs: 900_000 + Math.floor(random() * 600_000)
    };
  });
  const pcts = history.map((item) => Math.round((item.score / item.total) * 1000) / 10);

  const activity: ProgressState["activity"] = {};
  if (profile.coverage > 0) {
    for (let d = 0; d < 14; d++) {
      if (random() < 0.45) continue;
      const day = dayKey(new Date(lastActive - d * 86_400_000));
      const answered = 10 + Math.floor(random() * 40);
      activity[day] = { answered, correct: Math.round(answered * profile.accuracy) };
    }
  }

  const seenCount = Object.keys(questions).length;
  const levelSum = Object.values(questions).reduce((sum, item) => sum + item.level, 0);
  const topicAccuracy: Partial<Record<TopicId, number>> = {};
  if (seenCount) {
    for (const topic of TOPICS) {
      const signTopic = topic.startsWith("signs_");
      const base = profile.accuracy * 100 - (signTopic && profile.label === "needs_signs" ? 22 : 0);
      topicAccuracy[topic] = Math.round(Math.max(20, Math.min(100, base + (random() - 0.5) * 18)));
    }
  }
  const weakTopics = (Object.entries(topicAccuracy) as [TopicId, number][])
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([topic]) => topic);

  const progress: ProgressState = {
    version: 2,
    examIndex: profile.exams.length,
    questions,
    history,
    favorites: Object.keys(questions).slice(0, 3).map(Number),
    notes: {},
    flashcards: {},
    activity,
    xp: seenCount * 7 + history.length * 50,
    badges: history.length ? { first_exam: history[0]!.at } : {},
    updatedAt: lastActive
  };
  const metrics: StudentMetrics = {
    examsTaken: history.length,
    passes: history.filter((item) => item.passed).length,
    bestScorePct: pcts.length ? Math.max(...pcts) : null,
    avgScorePct: pcts.length ? Math.round((pcts.reduce((s, v) => s + v, 0) / pcts.length) * 10) / 10 : null,
    lastScorePct: pcts.length ? pcts[pcts.length - 1]! : null,
    readiness: profile.readiness,
    readinessLabel: profile.label,
    coveragePct: Math.round((seenCount / bank.length) * 100),
    masteryPct: Math.round((levelSum / (bank.length * 5)) * 100),
    signAccuracyPct: signCorrect + signWrong ? Math.round((signCorrect / (signCorrect + signWrong)) * 100) : null,
    topicAccuracy,
    weakTopics,
    lastPracticeAt: seenCount ? lastActive : null
  };
  return { progress, metrics };
}

export async function seedDemo(db: Db, now = new Date()): Promise<{ created: boolean }> {
  await migrate(db);
  const existing = await db.query(`SELECT 1 FROM schools WHERE slug = 'demo'`);
  if (existing.length) return { created: false };

  const random = rng(20261116);
  const at = (daysAgo: number) => addDays(now, -daysAgo).toISOString();
  const schoolId = newId();

  const branding: SchoolBranding = { logoUrl: null, primaryColor: "#0f766e", accentColor: "#255f85" };
  const contact: SchoolContact = {
    phone: "+961 00 000 000",
    whatsapp: "96100000000",
    email: "hello@demo.test",
    address: "Demo Street, Beirut (fictional)",
    mapUrl: null,
    instagram: null,
    tiktok: null,
    facebook: null,
    website: null
  };
  const landing: SchoolLanding = {
    headline: {
      ar: "استعد لامتحان القيادة النظري بثقة",
      en: "Get ready for your theory test with confidence",
      fr: "Préparez votre examen théorique en toute confiance"
    },
    about: {
      ar: "مدرسة تجريبية لعرض المنصة: تدريب على الأسئلة الرسمية، متابعة من المدرب، وحجز الدروس بسهولة.",
      en: "A demo school showcasing the platform: practice on the official questions, instructor follow-up and easy lesson booking.",
      fr: "Une auto-école de démonstration : entraînement sur les questions officielles, suivi par le moniteur et réservation facile des leçons."
    },
    testimonials: [
      { name: "Demo Learner A", text: "التمارين اليومية ساعدتني أنجح من أول مرة." },
      { name: "Demo Learner B", text: "The mock exams felt exactly like the real one." }
    ],
    passRate: { value: 90, verified: false, note: "Demo figure, not verified" },
    showStats: true
  };

  await db.query(
    `INSERT INTO schools (id, slug, name, branding, contact, landing, plan, status, student_limit, retention_days,
       custom_domain, paid_until, billing_note, feature_overrides, collect_phone, created_at)
     VALUES ($1, 'demo', $2::text::jsonb, $3::text::jsonb, $4::text::jsonb, $5::text::jsonb, 'premium', 'active', 200, 365,
       NULL, $6, 'Demo account — no billing', '{}'::jsonb, true, $7)`,
    [
      schoolId,
      json({ ar: "مدرسة القيادة التجريبية", en: "Demo Driving School", fr: "Auto-école Démo" }),
      json(branding),
      json(contact),
      json(landing),
      dayKey(addDays(now, 60)),
      at(90)
    ]
  );

  const branchIds = [newId(), newId()];
  await db.query(
    `INSERT INTO branches (id, school_id, name, address, map_url, phone, created_at) VALUES
       ($1, $3, 'Demo Branch — Beirut', 'Fictional address 1, Beirut', NULL, '+961 00 000 001', $4),
       ($2, $3, 'Demo Branch — Tripoli', 'Fictional address 2, Tripoli', NULL, '+961 00 000 002', $4)`,
    [branchIds[0], branchIds[1], schoolId, at(90)]
  );

  const users = [
    { id: newId(), email: "admin@demo.test", name: "Demo Super Admin", role: "super_admin", school: null, branch: null },
    { id: newId(), email: "owner@demo.test", name: "Demo Owner", role: "school_admin", school: schoolId, branch: null },
    { id: newId(), email: "coach@demo.test", name: "Demo Coach", role: "instructor", school: schoolId, branch: branchIds[0] }
  ];
  for (const user of users) {
    await db.query(
      `INSERT INTO users (id, email, name, role, school_id, branch_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING`,
      [user.id, user.email, user.name, user.role, user.school, user.branch, at(90)]
    );
  }
  const [coach] = await db.query<{ id: string }>(`SELECT id FROM users WHERE email = 'coach@demo.test'`);
  const coachId = coach?.id ?? null;

  await db.query(
    `INSERT INTO invite_codes (code, school_id, label, branch_id, instructor_id, max_uses, uses, expires_at, active, created_at)
     VALUES ('DEMO26', $1, 'Demo reception QR', $2, $3, NULL, $4, NULL, true, $5) ON CONFLICT (code) DO NOTHING`,
    [schoolId, branchIds[0], coachId, PROFILES.filter((p) => p.linked).length, at(60)]
  );

  for (const [index, profile] of PROFILES.entries()) {
    const created = 45 - index * 3;
    const synced = profile.coverage > 0 ? buildProgress(profile, now, random) : null;
    const lastActive = profile.lastActiveDaysAgo === null ? null : at(profile.lastActiveDaysAgo);
    await db.query(
      `INSERT INTO students (id, school_id, display_name, phone, status, package, branch_id, instructor_id, payment_note,
         exam_date, lesson_date, notes, source, interest, consent_at, consent_version, login_code_hash, linked_at,
         progress, metrics, progress_saved_at, last_active_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NULL, $14, $15, NULL, $16,
         $17::text::jsonb, $18::text::jsonb, $19, $20, $21)`,
      [
        newId(),
        schoolId,
        profile.name,
        `+961 00 ${String(100000 + index).slice(-6)}`,
        profile.status,
        profile.pkg,
        branchIds[profile.branch],
        profile.instructor ? coachId : null,
        profile.payment ?? null,
        profile.examInDays === null ? null : dayKey(addDays(now, profile.examInDays)),
        index % 3 === 0 ? dayKey(addDays(now, 2 + index)) : null,
        index === 3 ? "Needs extra help with priority signs." : null,
        profile.linked ? "invite:Demo reception QR" : "staff",
        profile.linked ? at(created) : null,
        profile.linked ? "2026-11" : null,
        profile.linked ? at(created) : null,
        synced ? json(synced.progress) : null,
        synced ? json(synced.metrics) : null,
        synced ? lastActive : null,
        lastActive,
        at(created)
      ]
    );
  }

  const leads = [
    { name: "Demo Lead 1", interest: "motorcycle", source: "qr-reception", message: "Do you have weekend classes?" },
    { name: "Demo Lead 2", interest: "car", source: "instagram", message: null },
    { name: "Demo Lead 3", interest: "full", source: null, message: "Price for the full package?" }
  ];
  for (const [index, lead] of leads.entries()) {
    await db.query(
      `INSERT INTO students (id, school_id, display_name, phone, status, branch_id, notes, source, interest, consent_at,
         consent_version, created_at)
       VALUES ($1, $2, $3, $4, 'lead', $5, $6, $7, $8, $9, 'lead-form', $9)`,
      [newId(), schoolId, lead.name, `+961 00 ${String(200000 + index).slice(-6)}`, branchIds[index % 2], lead.message, lead.source, lead.interest, at(index + 1)]
    );
  }

  const appointments = [
    { name: "Demo Lead 1", kind: "consultation", inDays: 1, status: "requested" },
    { name: "Demo Student 3", kind: "lesson", inDays: 2, status: "confirmed" },
    { name: "Demo Student 1", kind: "theory_exam", inDays: 5, status: "confirmed" }
  ];
  for (const [index, appt] of appointments.entries()) {
    const preferred = addDays(now, appt.inDays);
    preferred.setUTCHours(7 + index * 2, 0, 0, 0);
    await db.query(
      `INSERT INTO appointments (id, school_id, student_id, name, phone, kind, preferred_at, status, branch_id, message, notes,
         consent_at, created_at)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, NULL, NULL, $9, $9)`,
      [newId(), schoolId, appt.name, `+961 00 ${String(300000 + index).slice(-6)}`, appt.kind, preferred.toISOString().slice(0, 16), appt.status, branchIds[index % 2], at(index + 1)]
    );
  }

  await db.query(
    `INSERT INTO question_notes (id, school_id, author_id, author_name, question_id, visibility, body, video_url, created_at)
     VALUES ($1, $2, $3, 'Demo Coach', 12, 'school', 'Demo note: remember the rule of thumb we practised in class.', NULL, $4),
            ($5, $2, $3, 'Demo Coach', 40, 'private', 'Demo private reminder: revisit this with the Tuesday group.', NULL, $4)`,
    [newId(), schoolId, coachId, at(5), newId()]
  );
  for (const questionId of [17, 17, 88]) {
    await db.query(
      `INSERT INTO question_flags (id, school_id, user_id, question_id, reason, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [newId(), schoolId, coachId, questionId, "Students find the wording confusing (demo)", at(3)]
    );
  }

  // 30 days of anonymous counters for the school (plus some public traffic).
  for (let d = 29; d >= 0; d--) {
    const day = dayKey(addDays(now, -d));
    const weekend = [5, 6].includes(addDays(now, -d).getUTCDay());
    const visits = Math.round((weekend ? 18 : 35) + random() * 25);
    const exams = Math.round(visits * (0.25 + random() * 0.15));
    const counters: [string, string, number][] = [
      ["visit", "", visits],
      ["exam_completed", "", exams],
      ["exam_passed", "", Math.round(exams * (0.45 + random() * 0.2))],
      ["qr_scan", "qr-reception", Math.round(random() * 5)],
      ["lead", "", random() < 0.35 ? 1 : 0],
      ["install", "", random() < 0.4 ? 1 : 0]
    ];
    for (const [kind, ref, count] of counters) {
      if (count <= 0) continue;
      await db.query(
        `INSERT INTO events (day, school_id, kind, ref, count) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (day, school_id, kind, ref) DO UPDATE SET count = EXCLUDED.count`,
        [day, schoolId, kind, ref, count]
      );
    }
    await db.query(
      `INSERT INTO events (day, school_id, kind, ref, count) VALUES ($1, 'public', 'visit', '', $2)
       ON CONFLICT (day, school_id, kind, ref) DO UPDATE SET count = EXCLUDED.count`,
      [day, Math.round(60 + random() * 80)]
    );
  }

  await db.query(
    `INSERT INTO audit_log (id, at, actor_email, school_id, action, target, meta) VALUES ($1, $2, 'admin@demo.test', $3, 'school.create', $3, $4::text::jsonb)`,
    [newId(), at(90), schoolId, json({ slug: "demo", plan: "premium", seed: true })]
  );
  return { created: true };
}

const isMain = (() => {
  try {
    return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  const env = readEnv();
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  const db = await createDbFromEnv(env, dir);
  try {
    const { created } = await seedDemo(db);
    console.log(
      created
        ? `[seed] demo school created in ${env.DATABASE_URL ? "Postgres" : dir}.
  Super admin: admin@demo.test · School admin: owner@demo.test · Instructor: coach@demo.test
  Invite code: DEMO26 · School slug: demo`
        : "[seed] school 'demo' already exists — nothing to do."
    );
  } finally {
    await db.close();
  }
}
