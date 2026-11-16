import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedDemo } from "./seed";
import { setup, type TestContext } from "./test-utils";

let t: TestContext;

beforeAll(async () => {
  t = await setup({ env: { NODE_ENV: "test" } });
});

afterAll(async () => {
  await t.close();
});

describe("demo seed", () => {
  it("creates the demo school once and the data drives the dashboard", async () => {
    expect(await seedDemo(t.db, t.clock.now)).toEqual({ created: true });
    expect(await seedDemo(t.db, t.clock.now)).toEqual({ created: false });

    const pub = await t.json("GET", "/schools/demo");
    expect(pub.status).toBe(200);
    expect(pub.body.name.en).toBe("Demo Driving School");
    expect(pub.body.branches).toHaveLength(2);
    expect(pub.body.landing.passRate).toBeNull(); // unverified -> hidden publicly
    expect(pub.body.features.classroom).toBe(true);

    const owner = await t.login("owner@demo.test");
    const overview = await t.json("GET", "/staff/overview", { cookie: owner });
    expect(overview.status).toBe(200);
    expect(overview.body.counts).toMatchObject({ lead: 3, registered: 2, exam_ready: 2, passed: 2, inactive: 1 });
    expect(overview.body.ready).toBeGreaterThanOrEqual(3);
    expect(overview.body.atRisk).toBeGreaterThanOrEqual(2);
    expect(overview.body.inactive7d).toBeGreaterThanOrEqual(1);
    expect(overview.body.topWrong.length).toBeGreaterThan(0);
    expect(overview.body.usage.reduce((sum: number, day: { visits: number }) => sum + day.visits, 0)).toBeGreaterThan(300);
    expect(overview.body.flagged[0]).toEqual({ questionId: 17, count: 2 });

    const appts = await t.json("GET", "/staff/appointments", { cookie: owner });
    expect(appts.body).toHaveLength(3);

    const join = await t.json("POST", "/student/join", {
      body: { code: "demo26", displayName: "Demo Student 13", consent: true, consentVersion: "2026-11" }
    });
    expect(join.status).toBe(200);

    const admin = await t.login("admin@demo.test");
    const schools = await t.json("GET", "/admin/schools", { cookie: admin });
    expect(schools.body[0].usage.students).toBe(13);
    expect(await t.login("coach@demo.test")).toMatch(/^ldt_session=/);
  });
});
