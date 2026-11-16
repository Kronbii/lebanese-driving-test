import { Hono } from "hono";
import type { ClassPhase, ClassroomHostState, ClassroomPlayerState } from "../../src/api/types.js";
import { QUESTIONS } from "../../src/data/questions.js";
import {
  audit,
  bearer,
  dbOf,
  nowOf,
  rateLimit,
  readBody,
  requireActive,
  requireFeature,
  schoolById,
  staffOf,
  staffSchool,
  type Ctx,
  type HonoEnv
} from "../context.js";
import { json, type Db } from "../db.js";
import { Fail, newId, randomCode, randomToken, sha256, toCsv } from "../lib.js";
import { advanceSchema, classroomCreateSchema, liveAnswerSchema, liveJoinSchema } from "../schemas.js";

const QUESTION_BY_ID = new Map(QUESTIONS.map((question) => [question.id, question]));
const MAX_PARTICIPANTS = 200;

interface SessionRow {
  id: string;
  code: string;
  school_id: string;
  host_user_id: string | null;
  question_ids: number[];
  anonymous: boolean;
  phase: ClassPhase;
  idx: number;
  revealed_index: number;
  created_at: unknown;
}

interface ParticipantRow {
  id: string;
  session_id: string;
  name: string;
  created_at: unknown;
}

interface AnswerRow {
  participant_id: string;
  question_index: number;
  selected: number;
  correct: boolean;
}

/** Question shown at the current index (kept in "ended" so the last reveal stays visible). */
function currentQuestionId(session: SessionRow): number | null {
  if (session.phase === "lobby" || session.idx < 0) return null;
  return session.question_ids[session.idx] ?? null;
}

async function loadParticipantsAndAnswers(db: Db, session: SessionRow) {
  const [participants, answers] = await Promise.all([
    db.query<ParticipantRow>(
      `SELECT id, session_id, name, created_at FROM classroom_participants WHERE session_id = $1 ORDER BY seq, created_at, id`,
      [session.id]
    ),
    db.query<AnswerRow>(
      `SELECT participant_id, question_index, selected, correct FROM classroom_answers WHERE session_id = $1`,
      [session.id]
    )
  ]);
  // +1 per correct answer, counted once the question has been revealed.
  const scores = new Map<string, number>(participants.map((p) => [p.id, 0]));
  for (const answer of answers) {
    if (answer.correct && answer.question_index <= session.revealed_index) {
      scores.set(answer.participant_id, (scores.get(answer.participant_id) ?? 0) + 1);
    }
  }
  return { participants, answers, scores };
}

function leaderboard(participants: ParticipantRow[], scores: Map<string, number>, limit?: number) {
  const list = participants
    .map((p) => ({ name: p.name, score: scores.get(p.id) ?? 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return limit ? list.slice(0, limit) : list;
}

async function hostState(db: Db, session: SessionRow): Promise<ClassroomHostState> {
  const { participants, answers, scores } = await loadParticipantsAndAnswers(db, session);
  const questionId = currentQuestionId(session);
  const question = questionId !== null ? QUESTION_BY_ID.get(questionId) : undefined;
  const current = answers.filter((answer) => answer.question_index === session.idx);
  const distribution = (question?.options ?? []).map(
    (_, index) => current.filter((answer) => answer.selected === index).length
  );
  const answered = new Set(current.map((answer) => answer.participant_id));
  return {
    code: session.code,
    phase: session.phase,
    index: Math.max(session.idx, 0),
    total: session.question_ids.length,
    questionId,
    anonymous: session.anonymous,
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      score: scores.get(p.id) ?? 0,
      answered: answered.has(p.id)
    })),
    distribution,
    answeredCount: current.length,
    leaderboard: leaderboard(participants, scores)
  };
}

async function playerState(db: Db, session: SessionRow, participant: ParticipantRow): Promise<ClassroomPlayerState> {
  const { participants, answers, scores } = await loadParticipantsAndAnswers(db, session);
  const questionId = currentQuestionId(session);
  const mine = answers.find((a) => a.participant_id === participant.id && a.question_index === session.idx);
  const showCorrect = (session.phase === "reveal" || session.phase === "ended") && questionId !== null;
  return {
    code: session.code,
    phase: session.phase,
    index: Math.max(session.idx, 0),
    total: session.question_ids.length,
    questionId,
    myAnswer: mine ? mine.selected : null,
    correct: showCorrect ? (QUESTION_BY_ID.get(questionId!)?.answer ?? null) : null,
    myScore: scores.get(participant.id) ?? 0,
    myName: participant.name,
    leaderboard: leaderboard(participants, scores, 10)
  };
}

async function hostSession(c: Ctx): Promise<SessionRow> {
  const school = await staffSchool(c);
  requireFeature(school, "classroom");
  const rows = await dbOf(c).query<SessionRow>(
    `SELECT * FROM classroom_sessions WHERE code = $1 AND school_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [c.req.param("code"), school.id]
  );
  if (!rows[0]) throw new Fail("not_found");
  return rows[0];
}

async function participantFor(c: Ctx): Promise<{ session: SessionRow; participant: ParticipantRow }> {
  const token = bearer(c);
  if (!token) throw new Fail("unauthorized");
  const db = dbOf(c);
  const [participant] = await db.query<ParticipantRow>(
    `SELECT id, session_id, name, created_at FROM classroom_participants WHERE token_hash = $1`,
    [sha256(token)]
  );
  if (!participant) throw new Fail("unauthorized");
  const [session] = await db.query<SessionRow>(`SELECT * FROM classroom_sessions WHERE id = $1`, [participant.session_id]);
  if (!session || session.code !== c.req.param("code")) throw new Fail("unauthorized");
  return { session, participant };
}

export const classroomRoutes = new Hono<HonoEnv>();

// ---------- host (staff; /staff/* auth middleware already ran) ----------

classroomRoutes.post("/staff/classroom", async (c) => {
  const user = staffOf(c);
  const school = await staffSchool(c);
  requireFeature(school, "classroom");
  const body = await readBody(c, classroomCreateSchema);
  const unknown = body.questionIds.filter((id) => !QUESTION_BY_ID.has(id));
  if (unknown.length) throw new Fail("bad_request", `unknown questionIds: ${unknown.slice(0, 5).join(",")}`);
  const db = dbOf(c);
  const now = nowOf(c).toISOString();
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = randomCode(6, "0123456789");
    const clash = await db.query(`SELECT 1 FROM classroom_sessions WHERE code = $1 AND phase <> 'ended'`, [code]);
    if (clash.length) continue;
    const [session] = await db.query<SessionRow>(
      `INSERT INTO classroom_sessions (id, code, school_id, host_user_id, question_ids, anonymous, phase, idx, revealed_index, created_at)
       VALUES ($1, $2, $3, $4, $5::text::jsonb, $6, 'lobby', -1, -1, $7) RETURNING *`,
      [newId(), code, school.id, user.id, json(body.questionIds), body.anonymous, now]
    );
    return c.json(await hostState(db, session!), 201);
  }
  throw new Fail("server_error", "could not allocate code");
});

classroomRoutes.get("/staff/classroom/:code", async (c) => {
  const session = await hostSession(c);
  return c.json(await hostState(dbOf(c), session));
});

classroomRoutes.post("/staff/classroom/:code/advance", async (c) => {
  const session = await hostSession(c);
  const { action } = await readBody(c, advanceSchema);
  const last = session.question_ids.length - 1;
  let next: { phase: ClassPhase; idx: number; revealed: number } | null = null;
  switch (action) {
    case "start":
      if (session.phase === "lobby") next = { phase: "question", idx: 0, revealed: -1 };
      break;
    case "reveal":
      if (session.phase === "question") next = { phase: "reveal", idx: session.idx, revealed: session.idx };
      break;
    case "next":
      if (session.phase === "question" || session.phase === "reveal") {
        // Moving on from an unrevealed question still counts its answers.
        const revealed = session.idx;
        next = session.idx >= last
          ? { phase: "ended", idx: session.idx, revealed }
          : { phase: "question", idx: session.idx + 1, revealed };
      }
      break;
    case "end":
      if (session.phase !== "ended") {
        next = { phase: "ended", idx: Math.max(session.idx, 0), revealed: session.phase === "lobby" ? -1 : session.idx };
      }
      break;
  }
  if (!next) throw new Fail("conflict", `cannot ${action} from ${session.phase}`);
  const db = dbOf(c);
  const [updated] = await db.query<SessionRow>(
    `UPDATE classroom_sessions SET phase = $2, idx = $3, revealed_index = $4,
       ended_at = CASE WHEN $2 = 'ended' THEN $5::timestamptz ELSE ended_at END
     WHERE id = $1 AND phase = $6 RETURNING *`,
    [session.id, next.phase, next.idx, next.revealed, nowOf(c).toISOString(), session.phase]
  );
  if (!updated) throw new Fail("conflict", "state changed, retry");
  return c.json(await hostState(db, updated));
});

classroomRoutes.get("/staff/classroom/:code/export.csv", async (c) => {
  const session = await hostSession(c);
  const db = dbOf(c);
  const { participants, answers, scores } = await loadParticipantsAndAnswers(db, session);
  const header = [
    "name",
    "score",
    ...session.question_ids.map((id, index) => `Q${index + 1} (#${id})`)
  ];
  const rows = participants
    .slice()
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
    .map((p) => [
      p.name,
      scores.get(p.id) ?? 0,
      ...session.question_ids.map((_, index) => {
        const answer = answers.find((a) => a.participant_id === p.id && a.question_index === index);
        return answer ? `${answer.selected + 1} ${answer.correct ? "✓" : "✗"}` : "";
      })
    ]);
  const correctRow = [
    "(correct)",
    "",
    ...session.question_ids.map((id) => String((QUESTION_BY_ID.get(id)?.answer ?? -1) + 1))
  ];
  await audit(c, "classroom.export", { schoolId: session.school_id, target: session.id });
  return c.body(toCsv(header, [...rows, correctRow]), 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="classroom-${session.code}.csv"`
  });
});

// ---------- players (public, participant bearer token) ----------

classroomRoutes.post("/live/:code/join", async (c) => {
  rateLimit(c, "liveJoin");
  const body = await readBody(c, liveJoinSchema, 2_000);
  const db = dbOf(c);
  const [session] = await db.query<SessionRow>(
    `SELECT * FROM classroom_sessions WHERE code = $1 AND phase <> 'ended' ORDER BY created_at DESC LIMIT 1`,
    [c.req.param("code")]
  );
  if (!session) throw new Fail("not_found");
  const school = await schoolById(db, session.school_id);
  if (!school) throw new Fail("not_found");
  requireActive(school);
  requireFeature(school, "classroom");
  const [count] = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM classroom_participants WHERE session_id = $1`,
    [session.id]
  );
  const n = count?.n ?? 0;
  if (n >= MAX_PARTICIPANTS) throw new Fail("limit_reached", "classroom full");
  let name: string;
  if (session.anonymous) {
    name = `طالب ${n + 1}`;
  } else {
    name = (body.name ?? "").trim();
    if (!name) throw new Fail("bad_request", "name required");
  }
  const token = randomToken(24);
  const [participant] = await db.query<ParticipantRow>(
    `INSERT INTO classroom_participants (id, session_id, name, seq, token_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, session_id, name, created_at`,
    [newId(), session.id, name, n + 1, sha256(token), nowOf(c).toISOString()]
  );
  return c.json({ participantToken: token, state: await playerState(db, session, participant!) });
});

classroomRoutes.get("/live/:code/state", async (c) => {
  const { session, participant } = await participantFor(c);
  return c.json(await playerState(dbOf(c), session, participant));
});

classroomRoutes.post("/live/:code/answer", async (c) => {
  const { session, participant } = await participantFor(c);
  const { selected } = await readBody(c, liveAnswerSchema, 1_000);
  if (session.phase !== "question") throw new Fail("conflict", "not accepting answers");
  const questionId = currentQuestionId(session);
  const question = questionId !== null ? QUESTION_BY_ID.get(questionId) : undefined;
  if (!question) throw new Fail("conflict", "no question");
  if (selected >= question.options.length) throw new Fail("bad_request", "option out of range");
  const db = dbOf(c);
  const inserted = await db.query(
    `INSERT INTO classroom_answers (session_id, participant_id, question_index, selected, correct, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (participant_id, question_index) DO NOTHING RETURNING participant_id`,
    [session.id, participant.id, session.idx, selected, selected === question.answer, nowOf(c).toISOString()]
  );
  if (!inserted.length) throw new Fail("conflict", "already answered");
  return c.json(await playerState(db, session, participant));
});
