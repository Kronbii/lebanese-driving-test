import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createPgliteDb } from "./db";
import { createSchool, setup, SUPER_ADMIN, type TestContext } from "./test-utils";

let t: TestContext;
let root: string;

beforeAll(async () => {
  t = await setup();
  root = await t.login(SUPER_ADMIN);
});

afterAll(async () => {
  await t.close();
});

describe("health", () => {
  it("reports capabilities", async () => {
    const res = await t.json("GET", "/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, ai: false, email: true });
    expect(res.res.headers.get("cache-control")).toBe("no-store");
    expect(res.res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("returns contract-shaped 404s", async () => {
    const res = await t.json("GET", "/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "not_found" });
  });
});

describe("magic-link auth", () => {
  it("never reveals whether an email exists", async () => {
    const before = t.emails.length;
    const res = await t.json("POST", "/auth/request-link", { body: { email: "nobody@test.dev" } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(t.emails.length).toBe(before);
  });

  it("logs in, reads /me, logs out", async () => {
    const before = t.emails.length;
    await t.json("POST", "/auth/request-link", { body: { email: "  ROOT@test.dev " } });
    const message = t.emails[before]!;
    expect(message.to).toBe(SUPER_ADMIN);
    const token = decodeURIComponent(/token=([^\s"&<]+)/.exec(message.text)![1]!);
    expect(message.text).toContain("http://localhost/staff/verify?token=");

    const verified = await t.call("POST", "/auth/verify", { body: { token } });
    expect(verified.status).toBe(200);
    const setCookie = verified.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/ldt_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//);
    const cookie = `ldt_session=${/ldt_session=([^;]+)/.exec(setCookie)![1]}`;

    // Single use.
    const again = await t.json("POST", "/auth/verify", { body: { token } });
    expect(again.status).toBe(400);
    expect(again.body.error).toBe("invalid_code");

    const me = await t.json("GET", "/auth/me", { cookie });
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(SUPER_ADMIN);
    expect(me.body.user.role).toBe("super_admin");
    expect(me.body.school).toBeNull();

    const out = await t.json("POST", "/auth/logout", { cookie });
    expect(out.status).toBe(200);
    expect((await t.json("GET", "/auth/me", { cookie })).status).toBe(401);
  });

  it("rejects expired links", async () => {
    const before = t.emails.length;
    await t.json("POST", "/auth/request-link", { body: { email: SUPER_ADMIN } });
    const token = decodeURIComponent(/token=([^\s"&<]+)/.exec(t.emails[before]!.text)![1]!);
    const saved = t.clock.now;
    t.clock.now = new Date(saved.getTime() + 16 * 60_000);
    const res = await t.json("POST", "/auth/verify", { body: { token } });
    t.clock.now = saved;
    expect(res.status).toBe(410);
    expect(res.body.error).toBe("expired");
  });

  it("returns a devLink when no email provider is configured outside production", async () => {
    const db = await createPgliteDb();
    const app = createApp({ db, env: { NODE_ENV: "development", SUPER_ADMIN_EMAIL: "boss@test.dev", APP_URL: "https://app.example" }, sendEmail: null, ai: null, rateLimit: false });
    const res = await app.request("http://localhost/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "boss@test.dev" })
    });
    const body = (await res.json()) as { ok: boolean; devLink?: string };
    expect(body.ok).toBe(true);
    expect(body.devLink).toMatch(/^https:\/\/app\.example\/staff\/verify\?token=/);

    // Without APP_URL, dev links follow the browser's localhost origin (Vite proxy).
    const viaVite = createApp({ db, env: { NODE_ENV: "development", SUPER_ADMIN_EMAIL: "boss@test.dev" }, sendEmail: null, ai: null, rateLimit: false });
    const viteRes = await viaVite.request("http://localhost:8787/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ email: "boss@test.dev" })
    });
    expect(((await viteRes.json()) as { devLink: string }).devLink).toMatch(/^http:\/\/localhost:5173\/staff\/verify\?token=/);

    const prod = createApp({ db, env: { NODE_ENV: "production", SUPER_ADMIN_EMAIL: "boss@test.dev" }, sendEmail: null, ai: null, rateLimit: false });
    const prodRes = await prod.request("http://localhost/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "boss@test.dev" })
    });
    expect(await prodRes.json()).toEqual({ ok: true });
    await db.close();
  });

  it("rate limits request-link", async () => {
    const db = await createPgliteDb();
    const app = createApp({ db, env: { NODE_ENV: "test" }, sendEmail: async () => undefined, ai: null });
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await app.request("http://localhost/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.9" },
        body: JSON.stringify({ email: `x${i}@test.dev` })
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    await db.close();
  });
});

describe("RBAC and school isolation", () => {
  let adminA: string;
  let adminB: string;
  let coachA: string;
  let schoolA: string;

  beforeAll(async () => {
    ({ adminCookie: adminA, schoolId: schoolA } = await createSchool(t, root, { slug: "alpha", plan: "pro", adminEmail: "owner@alpha.test" }));
    ({ adminCookie: adminB } = await createSchool(t, root, { slug: "beta", plan: "pro", adminEmail: "owner@beta.test" }));
    const created = await t.json("POST", "/staff/users", {
      cookie: adminA,
      body: { email: "coach@alpha.test", name: "Coach A", role: "instructor" }
    });
    expect(created.status).toBe(201);
    coachA = await t.login("coach@alpha.test");
  });

  it("me returns the school for school staff", async () => {
    const me = await t.json("GET", "/auth/me", { cookie: coachA });
    expect(me.body.user.role).toBe("instructor");
    expect(me.body.school.slug).toBe("alpha");
    expect(me.body.school.features.cloudStudents).toBe(true);
  });

  it("blocks instructors from managing users, branches and school settings", async () => {
    expect((await t.json("POST", "/staff/users", { cookie: coachA, body: { email: "z@alpha.test", name: "Z", role: "instructor" } })).status).toBe(403);
    expect((await t.json("POST", "/staff/branches", { cookie: coachA, body: { name: "North" } })).status).toBe(403);
    const put = await t.json("PUT", "/staff/school", { cookie: coachA, body: { collectPhone: false } });
    expect(put.status).toBe(403);
    expect(put.body.error).toBe("forbidden");
    expect((await t.json("GET", "/staff/audit-log", { cookie: coachA })).status).toBe(403);
    expect((await t.json("GET", "/staff/export", { cookie: coachA })).status).toBe(403);
    // Read access is fine.
    expect((await t.json("GET", "/staff/branches", { cookie: coachA })).status).toBe(200);
  });

  it("blocks non super admins from /admin", async () => {
    expect((await t.json("GET", "/admin/schools", { cookie: adminA })).status).toBe(403);
    expect((await t.json("GET", "/admin/schools")).status).toBe(401);
    expect((await t.json("GET", "/admin/schools", { cookie: root })).status).toBe(200);
  });

  it("instructors cannot delete students; admins can", async () => {
    const created = await t.json("POST", "/staff/students", { cookie: coachA, body: { displayName: "Walk-in" } });
    expect(created.status).toBe(201);
    expect((await t.json("DELETE", `/staff/students/${created.body.id}`, { cookie: coachA })).status).toBe(403);
    expect((await t.json("DELETE", `/staff/students/${created.body.id}`, { cookie: adminA })).status).toBe(200);
  });

  it("school A staff cannot see school B students", async () => {
    const b = await t.json("POST", "/staff/students", { cookie: adminB, body: { displayName: "Beta Student" } });
    expect(b.status).toBe(201);
    expect((await t.json("GET", `/staff/students/${b.body.id}`, { cookie: adminA })).status).toBe(404);
    expect((await t.json("PATCH", `/staff/students/${b.body.id}`, { cookie: adminA, body: { notes: "x" } })).status).toBe(404);
    expect((await t.json("DELETE", `/staff/students/${b.body.id}`, { cookie: adminA })).status).toBe(404);
    const listA = await t.json<{ displayName: string }[]>("GET", "/staff/students", { cookie: adminA });
    expect(listA.body.some((s) => s.displayName === "Beta Student")).toBe(false);
    const listB = await t.json<{ displayName: string }[]>("GET", "/staff/students", { cookie: adminB });
    expect(listB.body.some((s) => s.displayName === "Beta Student")).toBe(true);
  });

  it("school admins manage their school and the audit log records it", async () => {
    const branch = await t.json("POST", "/staff/branches", { cookie: adminA, body: { name: "Beirut", address: "Hamra" } });
    expect(branch.status).toBe(201);
    const updated = await t.json("PUT", "/staff/school", {
      cookie: adminA,
      body: { collectPhone: false, landing: { headline: { ar: "أهلاً" }, about: null, testimonials: [], passRate: { value: 99, verified: true }, showStats: true } }
    });
    expect(updated.status).toBe(200);
    expect(updated.body.collectPhone).toBe(false);
    // School admins can't self-verify a pass rate.
    expect(updated.body.landing.passRate).toEqual({ value: 99, verified: false });
    const pub = await t.json("GET", "/schools/alpha");
    expect(pub.body.landing.passRate).toBeNull();
    expect(pub.body.plan).toBeUndefined();
    expect(pub.body.branches.map((b: { name: string }) => b.name)).toContain("Beirut");

    const log = await t.json<{ action: string }[]>("GET", "/staff/audit-log", { cookie: adminA });
    const actions = log.body.map((entry) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(["school.update", "branch.create", "user.create", "student.delete", "staff.login"]));
    expect(log.body.every((entry: any) => entry.schoolId === schoolA)).toBe(true);
  });

  it("super admins can act on a school via ?schoolId=", async () => {
    const res = await t.json("GET", `/staff/students?schoolId=${schoolA}`, { cookie: root });
    expect(res.status).toBe(200);
    expect((await t.json("GET", "/staff/students", { cookie: root })).status).toBe(400);
  });
});

describe("CSRF", () => {
  it("rejects cookie-authenticated mutations from a foreign Origin", async () => {
    const res = await t.json("POST", "/staff/branches", {
      cookie: root,
      headers: { Origin: "https://evil.example" },
      body: { name: "x" }
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("forbidden");
  });

  it("rejects non-JSON bodies on cookie-authenticated mutations", async () => {
    const res = await t.json("POST", "/auth/logout", {
      cookie: root,
      raw: "a=1",
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    expect(res.status).toBe(403);
    // Still logged in.
    expect((await t.json("GET", "/auth/me", { cookie: root })).status).toBe(200);
  });

  it("allows same-origin requests", async () => {
    const res = await t.json("GET", "/admin/schools", { cookie: root, headers: { Origin: "http://localhost" } });
    expect(res.status).toBe(200);
    const created = await t.json("POST", "/admin/schools", {
      cookie: root,
      headers: { Origin: "http://localhost" },
      body: { slug: "gamma", name: { ar: "غاما" }, plan: "starter" }
    });
    expect(created.status).toBe(201);
  });
});
