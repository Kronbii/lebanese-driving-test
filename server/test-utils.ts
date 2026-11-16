import { createApp, type CreateAppOptions } from "./app";
import type { AiComplete, EmailMessage } from "./context";
import { createPgliteDb, type Db } from "./db";
import type { Env } from "./lib";

export interface CallOptions {
  body?: unknown;
  cookie?: string | null;
  token?: string | null;
  headers?: Record<string, string>;
  /** Raw body (skips JSON encoding and the JSON content-type). */
  raw?: string;
}

export interface TestContext {
  db: Db;
  app: ReturnType<typeof createApp>;
  emails: EmailMessage[];
  clock: { now: Date };
  call: (method: string, path: string, options?: CallOptions) => Promise<Response>;
  json: <T = any>(method: string, path: string, options?: CallOptions) => Promise<{ status: number; body: T; res: Response }>;
  login: (email: string) => Promise<string>;
  close: () => Promise<void>;
}

export const SUPER_ADMIN = "root@test.dev";

export async function setup(
  overrides: Partial<Omit<CreateAppOptions, "db">> & { env?: Env; ai?: AiComplete | null } = {}
): Promise<TestContext> {
  const { env: envOverrides, ...rest } = overrides;
  const db = await createPgliteDb();
  const emails: EmailMessage[] = [];
  const clock = { now: new Date("2026-11-16T10:00:00.000Z") };
  const app = createApp({
    db,
    env: { NODE_ENV: "test", SUPER_ADMIN_EMAIL: SUPER_ADMIN, CRON_SECRET: "cron-secret", ...envOverrides },
    now: () => clock.now,
    sendEmail: async (message) => {
      emails.push(message);
    },
    ai: null,
    rateLimit: false,
    ...rest
  });

  const call = (method: string, path: string, options: CallOptions = {}) => {
    const headers: Record<string, string> = { ...options.headers };
    let body: string | undefined;
    if (options.raw !== undefined) body = options.raw;
    else if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      headers["Content-Type"] ??= "application/json";
    }
    if (options.cookie) headers.Cookie = options.cookie;
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (body !== undefined) headers["Content-Length"] = String(Buffer.byteLength(body));
    return Promise.resolve(app.request(`http://localhost/api${path}`, { method, headers, body }));
  };

  const json = async <T,>(method: string, path: string, options?: CallOptions) => {
    const res = await call(method, path, options);
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text.replace(/^﻿/, "")) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body: body as T, res };
  };

  const login = async (email: string) => {
    const before = emails.length;
    const requested = await json("POST", "/auth/request-link", { body: { email } });
    if (requested.status !== 200) throw new Error(`request-link ${requested.status}`);
    const message = emails[before];
    if (!message) throw new Error(`no email sent to ${email}`);
    const token = /token=([^\s"&<]+)/.exec(message.text)?.[1];
    if (!token) throw new Error("token not found in email");
    const verified = await call("POST", "/auth/verify", { body: { token: decodeURIComponent(token) } });
    if (verified.status !== 200) throw new Error(`verify ${verified.status}: ${await verified.text()}`);
    const cookie = verified.headers.get("set-cookie") ?? "";
    const value = /ldt_session=([^;]+)/.exec(cookie)?.[1];
    if (!value) throw new Error("no session cookie");
    return `ldt_session=${value}`;
  };

  return { db, app, emails, clock, call, json, login, close: () => db.close() };
}

/** Super admin creates a school (+ its admin), returns ids and the admin's cookie. */
export async function createSchool(
  t: TestContext,
  rootCookie: string,
  options: { slug: string; plan: "starter" | "pro" | "premium"; adminEmail: string }
) {
  const created = await t.json("POST", "/admin/schools", {
    cookie: rootCookie,
    body: { slug: options.slug, name: { ar: `مدرسة ${options.slug}`, en: options.slug }, plan: options.plan, status: "active", adminEmail: options.adminEmail, adminName: "Owner" }
  });
  if (created.status !== 201) throw new Error(`create school ${created.status}: ${JSON.stringify(created.body)}`);
  const adminCookie = await t.login(options.adminEmail);
  return { schoolId: created.body.id as string, adminCookie };
}

export function sampleProgress(options: { wrongOn?: number[]; history?: boolean[] } = {}) {
  const questions: Record<string, { seen: number; correct: number; wrong: number; level: number; lastExam: number; recentWrong: number; picks?: number[] }> = {};
  for (let id = 1; id <= 40; id++) {
    const wrong = options.wrongOn?.includes(id) ? 2 : 0;
    questions[String(id)] = { seen: 3, correct: 3 - wrong, wrong, level: wrong ? 1 : 3, lastExam: 1, recentWrong: wrong ? 1 : 0, picks: wrong ? [0, 2, 0] : undefined };
  }
  return {
    version: 2,
    examIndex: 3,
    questions,
    history: (options.history ?? [true, false, true]).map((passed, index) => ({
      at: Date.UTC(2026, 10, 10 + index),
      score: passed ? 27 : 20,
      total: 30,
      passed,
      examIndex: index,
      mode: "official"
    })),
    favorites: [3, 9],
    notes: { "5": "remember this" },
    flashcards: {},
    activity: { "2026-11-15": { answered: 30, correct: 26 } },
    xp: 420,
    badges: { first_exam: Date.UTC(2026, 10, 10) },
    updatedAt: Date.UTC(2026, 10, 15)
  };
}

export function sampleMetrics(overrides: Record<string, unknown> = {}) {
  return {
    examsTaken: 3,
    passes: 2,
    bestScorePct: 90,
    avgScorePct: 82.2,
    lastScorePct: 90,
    readiness: 78,
    readinessLabel: "almost",
    coveragePct: 16,
    masteryPct: 40,
    signAccuracyPct: 70,
    topicAccuracy: { gear: 90, signs_warning: 55 },
    weakTopics: ["signs_warning"],
    lastPracticeAt: Date.UTC(2026, 10, 15),
    ...overrides
  };
}
