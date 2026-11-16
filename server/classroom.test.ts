import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { QUESTIONS } from "../src/data/questions";
import type { AiRequest } from "./context";
import { createSchool, setup, SUPER_ADMIN, type TestContext } from "./test-utils";

let t: TestContext;
let admin: string;
let root: string;
const aiCalls: AiRequest[] = [];

beforeAll(async () => {
  t = await setup({
    ai: async (request) => {
      aiCalls.push(request);
      return "Because the helmet protects you.";
    }
  });
  root = await t.login(SUPER_ADMIN);
  ({ adminCookie: admin } = await createSchool(t, root, { slug: "pine", plan: "premium", adminEmail: "owner@pine.test" }));
});

afterAll(async () => {
  await t.close();
});

const q = (id: number) => QUESTIONS.find((question) => question.id === id)!;

describe("live classroom", () => {
  const ids = [1, 2, 3];
  let code: string;
  let rami: string;
  let lina: string;

  it("creates a session with a 6-digit code", async () => {
    const res = await t.json("POST", "/staff/classroom", { cookie: admin, body: { questionIds: ids, anonymous: false } });
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^\d{6}$/);
    expect(res.body).toMatchObject({ phase: "lobby", index: 0, total: 3, questionId: null, participants: [], answeredCount: 0 });
    code = res.body.code;
    const bad = await t.json("POST", "/staff/classroom", { cookie: admin, body: { questionIds: [99999], anonymous: false } });
    expect(bad.status).toBe(400);
  });

  it("lets two players join", async () => {
    const noName = await t.json("POST", `/live/${code}/join`, { body: {} });
    expect(noName.status).toBe(400);
    const a = await t.json("POST", `/live/${code}/join`, { body: { name: "Rami" } });
    const b = await t.json("POST", `/live/${code}/join`, { body: { name: "Lina" } });
    expect(a.status).toBe(200);
    expect(a.body.state).toMatchObject({ phase: "lobby", myName: "Rami", myScore: 0, myAnswer: null, correct: null });
    rami = a.body.participantToken;
    lina = b.body.participantToken;
    const host = await t.json("GET", `/staff/classroom/${code}`, { cookie: admin });
    expect(host.body.participants.map((p: { name: string }) => p.name)).toEqual(["Rami", "Lina"]);
    expect((await t.json("GET", `/live/${code}/state`)).status).toBe(401);
    expect((await t.json("GET", "/live/000000/state", { token: rami })).status).toBe(401);
  });

  it("runs questions: answer once, reveal, score, next", async () => {
    expect((await t.json("POST", `/live/${code}/answer`, { token: rami, body: { selected: 0 } })).status).toBe(409);
    const started = await t.json("POST", `/staff/classroom/${code}/advance`, { cookie: admin, body: { action: "start" } });
    expect(started.body).toMatchObject({ phase: "question", index: 0, questionId: 1 });
    expect(started.body.distribution).toHaveLength(q(1).options.length);

    const right = q(1).answer;
    const wrong = (right + 1) % q(1).options.length;
    const ra = await t.json("POST", `/live/${code}/answer`, { token: rami, body: { selected: right } });
    expect(ra.body).toMatchObject({ myAnswer: right, correct: null, myScore: 0 });
    expect((await t.json("POST", `/live/${code}/answer`, { token: rami, body: { selected: wrong } })).status).toBe(409);
    await t.json("POST", `/live/${code}/answer`, { token: lina, body: { selected: wrong } });

    const before = await t.json("GET", `/staff/classroom/${code}`, { cookie: admin });
    expect(before.body.answeredCount).toBe(2);
    expect(before.body.participants.every((p: { answered: boolean }) => p.answered)).toBe(true);
    expect(before.body.distribution[right]).toBe(1);
    expect(before.body.leaderboard.every((entry: { score: number }) => entry.score === 0)).toBe(true);

    expect((await t.json("POST", `/staff/classroom/${code}/advance`, { cookie: admin, body: { action: "start" } })).status).toBe(409);
    const revealed = await t.json("POST", `/staff/classroom/${code}/advance`, { cookie: admin, body: { action: "reveal" } });
    expect(revealed.body.phase).toBe("reveal");
    expect(revealed.body.leaderboard[0]).toEqual({ name: "Rami", score: 1 });

    const ramiState = await t.json("GET", `/live/${code}/state`, { token: rami });
    expect(ramiState.body).toMatchObject({ phase: "reveal", correct: right, myScore: 1, myAnswer: right });
    expect((await t.json("POST", `/live/${code}/answer`, { token: lina, body: { selected: 0 } })).status).toBe(409);

    const next = await t.json("POST", `/staff/classroom/${code}/advance`, { cookie: admin, body: { action: "next" } });
    expect(next.body).toMatchObject({ phase: "question", index: 1, questionId: 2, answeredCount: 0 });
    const linaState = await t.json("POST", `/live/${code}/answer`, { token: lina, body: { selected: q(2).answer } });
    expect(linaState.body).toMatchObject({ index: 1, myAnswer: q(2).answer, myScore: 0 });
    await t.json("POST", `/staff/classroom/${code}/advance`, { cookie: admin, body: { action: "reveal" } });
  });

  it("ends, shows the leaderboard and exports CSV", async () => {
    const ended = await t.json("POST", `/staff/classroom/${code}/advance`, { cookie: admin, body: { action: "end" } });
    expect(ended.body.phase).toBe("ended");
    expect(ended.body.leaderboard).toEqual([
      { name: "Lina", score: 1 },
      { name: "Rami", score: 1 }
    ]);
    expect((await t.json("POST", `/staff/classroom/${code}/advance`, { cookie: admin, body: { action: "next" } })).status).toBe(409);
    const player = await t.json("GET", `/live/${code}/state`, { token: rami });
    expect(player.body.phase).toBe("ended");
    // Ended sessions can't be joined.
    expect((await t.json("POST", `/live/${code}/join`, { body: { name: "Late" } })).status).toBe(404);

    const csv = await t.call("GET", `/staff/classroom/${code}/export.csv`, { cookie: admin });
    expect(csv.headers.get("content-type")).toMatch(/text\/csv/);
    const text = (await csv.text()).replace(/^﻿/, "");
    const lines = text.trim().split("\r\n");
    expect(lines[0]).toBe("name,score,Q1 (#1),Q2 (#2),Q3 (#3)");
    expect(lines).toHaveLength(4);
    expect(text).toContain("Rami,1,");
    expect(text).toContain("✓");
  });

  it("names anonymous players", async () => {
    const res = await t.json("POST", "/staff/classroom", { cookie: admin, body: { questionIds: [4], anonymous: true } });
    const first = await t.json("POST", `/live/${res.body.code}/join`, { body: { name: "ignored" } });
    const second = await t.json("POST", `/live/${res.body.code}/join`, { body: {} });
    expect(first.body.state.myName).toBe("طالب 1");
    expect(second.body.state.myName).toBe("طالب 2");
  });
});

describe("question notes", () => {
  it("keeps private notes private and publishes school notes", async () => {
    await t.json("POST", "/staff/users", { cookie: admin, body: { email: "coach@pine.test", name: "Coach", role: "instructor" } });
    const coach = await t.login("coach@pine.test");
    const priv = await t.json("POST", "/staff/question-notes", { cookie: coach, body: { questionId: 5, visibility: "private", body: "my reminder" } });
    expect(priv.status).toBe(201);
    const shared = await t.json("POST", "/staff/question-notes", {
      cookie: admin,
      body: { questionId: 5, visibility: "school", body: "Look at the sign shape", videoUrl: "https://example.com/v" }
    });
    expect(shared.body.authorName).toBe("Owner");

    const coachView = await t.json<any[]>("GET", "/staff/question-notes?questionId=5", { cookie: coach });
    expect(coachView.body.map((n) => n.body).sort()).toEqual(["Look at the sign shape", "my reminder"]);
    const adminView = await t.json<any[]>("GET", "/staff/question-notes", { cookie: admin });
    expect(adminView.body.map((n) => n.body)).toEqual(["Look at the sign shape"]);

    const pub = await t.json("GET", "/schools/pine/question-notes");
    expect(pub.body).toEqual({ notes: [{ questionId: 5, body: "Look at the sign shape", videoUrl: "https://example.com/v" }] });

    expect((await t.json("DELETE", `/staff/question-notes/${shared.body.id}`, { cookie: coach })).status).toBe(403);
    expect((await t.json("DELETE", `/staff/question-notes/${priv.body.id}`, { cookie: admin })).status).toBe(404);
    expect((await t.json("DELETE", `/staff/question-notes/${priv.body.id}`, { cookie: coach })).status).toBe(200);
  });
});

describe("AI", () => {
  it("explains a question with the official answer in the prompt", async () => {
    const res = await t.json("POST", "/ai/explain", { body: { questionId: 1, selected: 1, style: "nervous", lang: "fr", schoolSlug: "pine" } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: "Because the helmet protects you." });
    const call = aiCalls.at(-1)!;
    expect(call.system).toContain("French");
    expect(call.system).toContain("reassuring");
    expect(call.system).toContain("120 words");
    expect(call.prompt).toContain(q(1).text);
    expect(call.prompt).toContain(`Official correct answer: A) ${q(1).options[0]}`);
    expect(call.prompt).toContain("which is wrong");

    expect((await t.json("POST", "/ai/explain", { body: { questionId: 99999, style: "simple", lang: "ar" } })).status).toBe(404);
  });

  it("writes instructor notes from anonymous school aggregates", async () => {
    const res = await t.json("POST", "/staff/ai/instructor-note", { cookie: admin, body: { questionId: 2, lang: "ar" } });
    expect(res.status).toBe(200);
    expect(aiCalls.at(-1)!.prompt).toContain("No school answer data yet.");
  });
});

describe("custom domains", () => {
  it("resolves a school by host when the plan allows it", async () => {
    const pine = (await t.json<any[]>("GET", "/admin/schools", { cookie: root })).body.find((s) => s.slug === "pine");
    const patched = await t.json("PATCH", `/admin/schools/${pine.id}`, { cookie: root, body: { customDomain: "learn.pine.test" } });
    expect(patched.body.customDomain).toBe("learn.pine.test");
    expect((await t.json("GET", "/schools/by-host?host=LEARN.pine.test:443")).body).toEqual({ slug: "pine" });
    expect((await t.json("GET", "/schools/by-host?host=www.learn.pine.test")).body).toEqual({ slug: "pine" });
    expect((await t.json("GET", "/schools/by-host?host=other.test")).status).toBe(404);
    await t.json("PATCH", `/admin/schools/${pine.id}`, { cookie: root, body: { featureOverrides: { customDomain: false } } });
    expect((await t.json("GET", "/schools/by-host?host=learn.pine.test")).status).toBe(404);
  });
});
