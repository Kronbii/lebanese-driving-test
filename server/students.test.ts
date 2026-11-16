import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSchool, sampleMetrics, sampleProgress, setup, SUPER_ADMIN, type TestContext } from "./test-utils";

let t: TestContext;
let root: string;
let admin: string;
let schoolId: string;
let code: string;

beforeAll(async () => {
  t = await setup();
  root = await t.login(SUPER_ADMIN);
  ({ adminCookie: admin, schoolId } = await createSchool(t, root, { slug: "cedar", plan: "pro", adminEmail: "owner@cedar.test" }));
  const invite = await t.json("POST", "/staff/invite-codes", { cookie: admin, body: { label: "Reception QR" } });
  expect(invite.status).toBe(201);
  code = invite.body.code;
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
});

afterAll(async () => {
  await t.close();
});

const join = (body: Record<string, unknown>) =>
  t.json("POST", "/student/join", { body: { displayName: "Rana", consent: true, consentVersion: "2026-11", ...body } });

describe("cloud student lifecycle", () => {
  let deviceToken: string;
  let loginCode: string;
  let studentId: string;

  it("requires consent", async () => {
    const res = await join({ code, consent: false });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("consent_required");
  });

  it("rejects unknown codes", async () => {
    const res = await join({ code: "ZZZZZZ" });
    expect(res.body.error).toBe("invalid_code");
  });

  it("joins with an invite code", async () => {
    const res = await join({ code: code.toLowerCase(), phone: "+961 3 000000" });
    expect(res.status).toBe(200);
    expect(res.body.deviceToken).toBeTruthy();
    expect(res.body.loginCode).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
    expect(res.body.student.status).toBe("registered");
    expect(res.body.student.phone).toBe("+961 3 000000");
    expect(res.body.student.school.slug).toBe("cedar");
    deviceToken = res.body.deviceToken;
    loginCode = res.body.loginCode;
    studentId = res.body.student.id;

    const invites = await t.json("GET", "/staff/invite-codes", { cookie: admin });
    expect(invites.body[0].uses).toBe(1);
  });

  it("stores only hashes", async () => {
    const [row] = await t.db.query<{ login_code_hash: string }>(`SELECT login_code_hash FROM students WHERE id = $1`, [studentId]);
    expect(row!.login_code_hash).toMatch(/^[0-9a-f]{64}$/);
    const tokens = await t.db.query<{ token_hash: string }>(`SELECT token_hash FROM device_tokens WHERE student_id = $1`, [studentId]);
    expect(tokens[0]!.token_hash).not.toContain(deviceToken);
  });

  it("syncs progress and moves registered -> practicing", async () => {
    const empty = await t.json("GET", "/student/progress", { token: deviceToken });
    expect(empty.body).toEqual({ progress: null, savedAt: null });

    const sync = await t.json("PUT", "/student/progress", {
      token: deviceToken,
      body: { progress: sampleProgress({ wrongOn: [7, 12] }), metrics: sampleMetrics() }
    });
    expect(sync.status).toBe(200);
    expect(sync.body.ok).toBe(true);
    expect(sync.body.savedAt).toBe(t.clock.now.toISOString());

    const back = await t.json("GET", "/student/progress", { token: deviceToken });
    expect(back.body.progress.xp).toBe(420);
    expect(back.body.progress.questions["7"].wrong).toBe(2);

    const me = await t.json("GET", "/student/me", { token: deviceToken });
    expect(me.body.status).toBe("practicing");
  });

  it("validates progress shape and size", async () => {
    const bad = await t.json("PUT", "/student/progress", { token: deviceToken, body: { progress: { version: 2 }, metrics: sampleMetrics() } });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("bad_request");
    const huge = sampleProgress();
    (huge.notes as Record<string, string>)["1"] = "x".repeat(320_000);
    const tooBig = await t.json("PUT", "/student/progress", { token: deviceToken, body: { progress: huge, metrics: sampleMetrics() } });
    expect(tooBig.status).toBe(413);
    expect((await t.json("GET", "/student/me")).status).toBe(401);
  });

  it("shows metrics to staff and audits detail views", async () => {
    const list = await t.json<any[]>("GET", "/staff/students", { cookie: admin });
    const row = list.body.find((s) => s.id === studentId);
    expect(row.linked).toBe(true);
    expect(row.metrics.readiness).toBe(78);
    expect(row.source).toBe("invite:Reception QR");
    expect(row.consentAt).toBeTruthy();

    const filtered = await t.json<any[]>("GET", "/staff/students?status=practicing&q=ran", { cookie: admin });
    expect(filtered.body.map((s) => s.id)).toEqual([studentId]);

    const detail = await t.json("GET", `/staff/students/${studentId}`, { cookie: admin });
    expect(detail.body.history).toHaveLength(3);
    expect(detail.body.topWrong.map((w: { questionId: number }) => w.questionId).sort((a: number, b: number) => a - b)).toEqual([7, 12]);

    const log = await t.json<{ action: string; target: string }[]>("GET", "/staff/audit-log", { cookie: admin });
    expect(log.body.some((entry) => entry.action === "student.view" && entry.target === studentId)).toBe(true);
  });

  it("logs in on a new device with the login code, and can rotate it", async () => {
    const login = await t.json("POST", "/student/login", { body: { loginCode: loginCode.toLowerCase().replace("-", " ") } });
    expect(login.status).toBe(200);
    expect(login.body.loginCode).toBeUndefined();
    expect(login.body.deviceToken).not.toBe(deviceToken);

    const rotated = await t.json("POST", "/student/login-code", { token: deviceToken });
    expect(rotated.body.loginCode).not.toBe(loginCode);
    const old = await t.json("POST", "/student/login", { body: { loginCode } });
    expect(old.body.error).toBe("invalid_code");
  });

  it("exports everything and deletes on request", async () => {
    const res = await t.call("GET", "/student/export", { token: deviceToken });
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);
    const data = (await res.json()) as any;
    expect(data.student.displayName).toBe("Rana");
    expect(data.progress.xp).toBe(420);
    expect(data.metrics.readiness).toBe(78);
    expect(data.student.consentVersion).toBe("2026-11");

    const del = await t.json("DELETE", "/student/me", { token: deviceToken });
    expect(del.body).toEqual({ ok: true });
    expect((await t.json("GET", "/student/me", { token: deviceToken })).status).toBe(401);
    expect((await t.json("GET", `/staff/students/${studentId}`, { cookie: admin })).status).toBe(404);
    const tokens = await t.db.query(`SELECT 1 FROM device_tokens WHERE student_id = $1`, [studentId]);
    expect(tokens).toHaveLength(0);
  });
});

describe("invite codes", () => {
  it("enforces maxUses", async () => {
    const invite = await t.json("POST", "/staff/invite-codes", { cookie: admin, body: { maxUses: 1 } });
    expect((await join({ code: invite.body.code })).status).toBe(200);
    const second = await join({ code: invite.body.code });
    expect(second.status).toBe(403);
    expect(second.body.error).toBe("limit_reached");
  });

  it("enforces expiry and deactivation", async () => {
    const invite = await t.json("POST", "/staff/invite-codes", {
      cookie: admin,
      body: { expiresAt: new Date(t.clock.now.getTime() + 3_600_000).toISOString() }
    });
    expect((await join({ code: invite.body.code })).status).toBe(200);
    t.clock.now = new Date(t.clock.now.getTime() + 2 * 3_600_000);
    const expired = await join({ code: invite.body.code });
    expect(expired.body.error).toBe("expired");

    const other = await t.json("POST", "/staff/invite-codes", { cookie: admin, body: {} });
    await t.json("PATCH", `/staff/invite-codes/${other.body.code}`, { cookie: admin, body: { active: false } });
    expect((await join({ code: other.body.code })).body.error).toBe("invalid_code");
  });

  it("does not store the phone when the school opts out", async () => {
    await t.json("PUT", "/staff/school", { cookie: admin, body: { collectPhone: false } });
    const invite = await t.json("POST", "/staff/invite-codes", { cookie: admin, body: {} });
    const res = await join({ code: invite.body.code, phone: "70123456" });
    expect(res.body.student.phone).toBeNull();
    await t.json("PUT", "/staff/school", { cookie: admin, body: { collectPhone: true } });
  });

  it("enforces the plan's student limit", async () => {
    const [{ n }] = await t.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM students WHERE school_id = $1 AND status <> 'lead'`, [schoolId]);
    await t.json("PATCH", `/admin/schools/${schoolId}`, { cookie: root, body: { studentLimit: n } });
    const invite = await t.json("POST", "/staff/invite-codes", { cookie: admin, body: {} });
    const res = await join({ code: invite.body.code });
    expect(res.body.error).toBe("limit_reached");
    await t.json("PATCH", `/admin/schools/${schoolId}`, { cookie: root, body: { studentLimit: null } });
  });
});

describe("feature flags", () => {
  let starterAdmin: string;
  let starterCode: string;

  beforeAll(async () => {
    ({ adminCookie: starterAdmin } = await createSchool(t, root, { slug: "olive", plan: "starter", adminEmail: "owner@olive.test" }));
    starterCode = (await t.json("POST", "/staff/invite-codes", { cookie: starterAdmin, body: {} })).body.code;
  });

  it("blocks cloud students and the dashboard on starter", async () => {
    const res = await join({ code: starterCode });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("feature_disabled");
    const overview = await t.json("GET", "/staff/overview", { cookie: starterAdmin });
    expect(overview.body.error).toBe("feature_disabled");
    const classroom = await t.json("POST", "/staff/classroom", { cookie: starterAdmin, body: { questionIds: [1], anonymous: true } });
    expect(classroom.body.error).toBe("feature_disabled");
  });

  it("honours per-school overrides", async () => {
    const olive = (await t.json<any[]>("GET", "/admin/schools", { cookie: root })).body.find((s) => s.slug === "olive");
    const patched = await t.json("PATCH", `/admin/schools/${olive.id}`, { cookie: root, body: { featureOverrides: { cloudStudents: true } } });
    expect(patched.body.features.cloudStudents).toBe(true);
    expect(patched.body.features.instructorDashboard).toBe(false);
    expect((await join({ code: starterCode })).status).toBe(200);

    const log = await t.json<{ action: string }[]>("GET", `/admin/audit-log?schoolId=${olive.id}`, { cookie: root });
    expect(log.body.map((entry) => entry.action)).toContain("school.update");
  });

  it("ai: 503 without a key, 403 when the school's plan lacks it", async () => {
    const pub = await t.json("POST", "/ai/explain", { body: { questionId: 1, style: "simple", lang: "en" } });
    expect(pub.status).toBe(503);
    expect(pub.body.error).toBe("ai_unavailable");
    const school = await t.json("POST", "/ai/explain", { body: { questionId: 1, style: "simple", lang: "en", schoolSlug: "olive" } });
    expect(school.status).toBe(403);
    expect(school.body.error).toBe("feature_disabled");
  });

  it("suspended schools refuse joins and leads but staff can still log in and export", async () => {
    const olive = (await t.json<any[]>("GET", "/admin/schools", { cookie: root })).body.find((s) => s.slug === "olive");
    await t.json("PATCH", `/admin/schools/${olive.id}`, { cookie: root, body: { status: "suspended" } });
    expect((await join({ code: starterCode })).body.error).toBe("school_suspended");
    const lead = await t.json("POST", "/schools/olive/leads", { body: { name: "X", consent: true } });
    expect(lead.body.error).toBe("school_suspended");
    const relog = await t.login("owner@olive.test");
    const exported = await t.json("GET", "/staff/export", { cookie: relog });
    expect(exported.status).toBe(200);
    expect(exported.body.school.status).toBe("suspended");
    const pub = await t.json("GET", "/schools/olive");
    expect(pub.body.status).toBe("suspended");
  });
});

describe("leads and appointments", () => {
  it("requires consent and stores leads as students with status lead", async () => {
    const noConsent = await t.json("POST", "/schools/cedar/leads", { body: { name: "Lead", consent: false } });
    expect(noConsent.body.error).toBe("consent_required");
    const lead = await t.json("POST", "/schools/cedar/leads", {
      body: { name: "Karim", phone: "71000000", interest: "motorcycle", message: "Weekend lessons?", ref: "QR-Reception!", consent: true }
    });
    expect(lead.body).toEqual({ ok: true });
    const leads = await t.json<any[]>("GET", "/staff/students?status=lead", { cookie: admin });
    expect(leads.body).toHaveLength(1);
    expect(leads.body[0]).toMatchObject({ displayName: "Karim", phone: "71000000", interest: "motorcycle", source: "qr-reception", notes: "Weekend lessons?", linked: false });
  });

  it("creates appointments and lets staff update them", async () => {
    const bad = await t.json("POST", "/schools/cedar/appointments", { body: { name: "A", kind: "lesson", preferredAt: "2026-11-20T09:00", consent: false } });
    expect(bad.body.error).toBe("consent_required");
    const ok = await t.json("POST", "/schools/cedar/appointments", {
      body: { name: "Maya", phone: "03000000", kind: "theory_exam", preferredAt: "2026-11-20T09:00", consent: true }
    });
    expect(ok.body).toEqual({ ok: true });
    const list = await t.json<any[]>("GET", "/staff/appointments?status=requested", { cookie: admin });
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ name: "Maya", kind: "theory_exam", status: "requested", preferredAt: "2026-11-20T09:00" });
    const patched = await t.json("PATCH", `/staff/appointments/${list.body[0].id}`, { cookie: admin, body: { status: "confirmed", notes: "Bring ID" } });
    expect(patched.body).toMatchObject({ status: "confirmed", notes: "Bring ID" });
  });

  it("counts lead events", async () => {
    const rows = await t.db.query<{ n: number }>(`SELECT sum(count)::int AS n FROM events WHERE school_id = $1 AND kind = 'lead'`, [schoolId]);
    expect(rows[0]!.n).toBe(2);
  });
});

describe("events and errors", () => {
  it("upserts anonymous counters", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await t.call("POST", "/events", { body: { kind: "exam_completed", schoolSlug: "cedar" } });
      expect(res.status).toBe(204);
    }
    await t.call("POST", "/events", { body: { kind: "visit" } });
    await t.call("POST", "/events", { body: { kind: "qr_scan", schoolSlug: "cedar", ref: "flyer" } });
    expect((await t.call("POST", "/events", { body: { kind: "hack" } })).status).toBe(400);

    const rows = await t.db.query<{ school_id: string; kind: string; ref: string; count: number }>(
      `SELECT school_id, kind, ref, count FROM events WHERE kind IN ('exam_completed', 'visit', 'qr_scan') ORDER BY kind`
    );
    expect(rows).toEqual([
      { school_id: schoolId, kind: "exam_completed", ref: "", count: 3 },
      { school_id: schoolId, kind: "qr_scan", ref: "flyer", count: 1 },
      { school_id: "public", kind: "visit", ref: "", count: 1 }
    ]);
    const pub = await t.json("GET", "/schools/cedar");
    expect(pub.body.stats.examsCompleted).toBe(3);
  });

  it("dedupes error reports", async () => {
    await t.call("POST", "/errors", { body: { message: "boom", path: "/exam?token=secret" } });
    await t.call("POST", "/errors", { body: { message: "boom", path: "/exam?x=1", release: "1.2.3" } });
    const errors = await t.json<any[]>("GET", "/admin/errors", { cookie: root });
    expect(errors.body).toHaveLength(1);
    expect(errors.body[0]).toMatchObject({ message: "boom", path: "/exam", count: 2, release: "1.2.3" });
  });
});

describe("overview and CSV", () => {
  it("computes the staff overview", async () => {
    const invite = await t.json("POST", "/staff/invite-codes", { cookie: admin, body: {} });
    const a = await join({ code: invite.body.code, displayName: "Ready One" });
    await t.json("PUT", "/student/progress", {
      token: a.body.deviceToken,
      body: { progress: sampleProgress({ wrongOn: [5] }), metrics: sampleMetrics({ readiness: 92, readinessLabel: "ready", avgScorePct: 90 }) }
    });
    const b = await join({ code: invite.body.code, displayName: "Struggling" });
    await t.json("PUT", "/student/progress", {
      token: b.body.deviceToken,
      body: { progress: sampleProgress({ wrongOn: [5, 9], history: [false, false, false] }), metrics: sampleMetrics({ readiness: 30, readinessLabel: "not_ready", avgScorePct: 60 }) }
    });
    await t.json("POST", "/staff/question-flags", { cookie: admin, body: { questionId: 9, reason: "confusing wording" } });

    const res = await t.json("GET", "/staff/overview", { cookie: admin });
    expect(res.status).toBe(200);
    const o = res.body;
    expect(o.counts.lead).toBe(1);
    expect(o.ready).toBe(1);
    expect(o.atRisk).toBe(1);
    expect(o.avgScorePct).toBe(75);
    expect(o.topWrong[0]).toMatchObject({ questionId: 5, wrong: 4, attempts: 6 });
    expect(o.weakTopics[0]).toMatchObject({ topic: "signs_warning", accuracy: 55, students: 2 });
    expect(o.usage).toHaveLength(30);
    expect(o.usage.at(-1)).toMatchObject({ exams: 3, leads: 2, qrScans: 1 });
    expect(o.flagged).toEqual([{ questionId: 9, count: 1 }]);
    expect(o.byBranch[0].students).toBeGreaterThan(0);
  });

  it("exports students as UTF-8 CSV with BOM", async () => {
    await t.json("POST", "/staff/students", { cookie: admin, body: { displayName: "طالب عربي" } });
    const res = await t.call("GET", "/staff/export/students.csv", { cookie: admin });
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("طالب عربي");
    expect(text.split("\r\n")[0]).toMatch(/^﻿?id,name,phone,status/);
  });
});

describe("retention", () => {
  it("purges inactive students via the school admin endpoint and the cron", async () => {
    const fresh = await t.json("POST", "/staff/students", { cookie: admin, body: { displayName: "Recent" } });
    await t.json("PUT", "/staff/school", { cookie: admin, body: { retentionDays: 30 } });
    const before = (await t.json<any[]>("GET", "/staff/students", { cookie: admin })).body.length;
    t.clock.now = new Date(t.clock.now.getTime() + 40 * 86_400_000);
    // The old 30-day session has expired by now.
    expect((await t.json("GET", "/staff/students", { cookie: admin })).status).toBe(401);
    const admin2 = await t.login("owner@cedar.test");
    const recent = await t.json("POST", "/staff/students", { cookie: admin2, body: { displayName: "Brand new" } });

    const run = await t.json("POST", "/staff/retention/run", { cookie: admin2 });
    expect(run.status).toBe(200);
    expect(run.body.deleted).toBe(before);
    const after = await t.json<any[]>("GET", "/staff/students", { cookie: admin2 });
    expect(after.body.map((s) => s.id)).toEqual([recent.body.id]);
    expect(after.body.some((s) => s.id === fresh.body.id)).toBe(false);

    expect((await t.json("GET", "/cron/retention")).status).toBe(401);
    expect((await t.json("GET", "/cron/retention", { token: "wrong" })).status).toBe(401);
    t.clock.now = new Date(t.clock.now.getTime() + 40 * 86_400_000);
    const cron = await t.json("GET", "/cron/retention", { token: "cron-secret" });
    expect(cron.status).toBe(200);
    expect(cron.body.deleted).toBe(1);
  });
});
