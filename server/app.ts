import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { ApiErrorBody } from "../src/api/types.js";
import { anthropicCompleter } from "./ai.js";
import {
  loadStaff,
  SESSION_COOKIE,
  type AiComplete,
  type AppDeps,
  type Ctx,
  type HonoEnv,
  type SendEmail
} from "./context.js";
import { createDbFromEnv, type Db } from "./db.js";
import { resendSender } from "./email.js";
import { Fail, isProduction, RateLimiter, readEnv, type Env } from "./lib.js";
import { adminRoutes } from "./routes/admin.js";
import { aiRoutes } from "./routes/ai.js";
import { authRoutes } from "./routes/auth.js";
import { classroomRoutes } from "./routes/classroom.js";
import { publicRoutes } from "./routes/public.js";
import { staffRoutes } from "./routes/staff.js";
import { studentRoutes } from "./routes/student.js";
import { migrate } from "./schema.js";

export interface CreateAppOptions {
  /** A ready Db, or a lazy factory (resolved on the first request). */
  db: Db | (() => Promise<Db>);
  env?: Env;
  now?: () => Date;
  /** undefined -> Resend when configured; null -> no email provider (devLink outside production). */
  sendEmail?: SendEmail | null;
  /** undefined -> Anthropic when ANTHROPIC_API_KEY is set; null -> AI unavailable. */
  ai?: AiComplete | null;
  /** In-memory rate limiting (default true). */
  rateLimit?: boolean;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Origin must match the host serving the API (or APP_URL; localhost in dev). */
function originAllowed(c: Ctx, env: Env, origin: string): boolean {
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  const hosts = new Set<string>();
  const host = c.req.header("host");
  if (host) hosts.add(host.toLowerCase());
  const forwarded = c.req.header("x-forwarded-host");
  if (forwarded) hosts.add(forwarded.split(",")[0]!.trim().toLowerCase());
  hosts.add(new URL(c.req.url).host.toLowerCase());
  if (env.APP_URL) {
    try {
      hosts.add(new URL(env.APP_URL).host.toLowerCase());
    } catch {
      // ignore malformed APP_URL
    }
  }
  if (hosts.has(originUrl.host.toLowerCase())) return true;
  // Dev convenience: Vite on another localhost port proxies to the API.
  return !isProduction(env) && ["localhost", "127.0.0.1", "[::1]"].includes(originUrl.hostname);
}

/**
 * CSRF defence for cookie-authenticated mutations (on top of SameSite=Lax):
 *  - a request body must be JSON (HTML forms can't send application/json);
 *  - when the browser sends Origin, it must match the API host.
 * Body-less requests (e.g. DELETE, logout) are allowed without a Content-Type.
 */
function csrfCheck(c: Ctx, env: Env) {
  if (!MUTATING.has(c.req.method)) return;
  if (!getCookie(c, SESSION_COOKIE)) return;
  const origin = c.req.header("origin");
  if (origin && !originAllowed(c, env, origin)) throw new Fail("forbidden", "csrf: origin mismatch");
  const contentType = c.req.header("content-type");
  const length = Number(c.req.header("content-length") ?? "0");
  const hasBody = length > 0 || Boolean(c.req.header("transfer-encoding"));
  if (contentType ? !/^application\/json\b/i.test(contentType) : hasBody) {
    throw new Fail("forbidden", "csrf: content-type must be application/json");
  }
}

export function createApp(options: CreateAppOptions) {
  const env = options.env ?? readEnv();
  let dbPromise: Promise<Db> | null = typeof options.db === "function" ? null : Promise.resolve(options.db);
  const getDb = () => {
    if (!dbPromise) {
      const factory = options.db as () => Promise<Db>;
      dbPromise = factory().catch((error) => {
        dbPromise = null;
        throw error;
      });
    }
    return dbPromise;
  };
  const base = {
    env,
    now: options.now ?? (() => new Date()),
    sendEmail: options.sendEmail === undefined ? resendSender(env) : options.sendEmail,
    ai: options.ai === undefined ? anthropicCompleter(env) : options.ai,
    rateLimit: options.rateLimit ?? true,
    limiter: new RateLimiter()
  };

  const app = new Hono<HonoEnv>().basePath("/api");

  app.onError((error, c) => {
    if (error instanceof Fail) {
      const body: ApiErrorBody = { error: error.code };
      if (error.detail) body.message = error.detail;
      return c.json(body, error.status as 400);
    }
    if (error instanceof HTTPException) {
      const status = error.status;
      const code = status === 401 ? "unauthorized" : status === 403 ? "forbidden" : status === 404 ? "not_found" : status >= 500 ? "server_error" : "bad_request";
      return c.json({ error: code, message: error.message } satisfies ApiErrorBody, status);
    }
    console.error("[api] unhandled error", c.req.method, c.req.path, error);
    return c.json({ error: "server_error" } satisfies ApiErrorBody, 500);
  });

  app.notFound((c) => c.json({ error: "not_found" } satisfies ApiErrorBody, 404));

  app.use("*", async (c, next) => {
    const db = await getDb();
    await migrate(db);
    const deps: AppDeps = { ...base, db };
    c.set("deps", deps);
    c.set("staff", null);
    csrfCheck(c, env);
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    if (!c.res.headers.get("Cache-Control")) c.header("Cache-Control", "no-store");
  });

  app.use("/staff/*", async (c, next) => {
    const user = await loadStaff(c);
    if (!user) throw new Fail("unauthorized");
    c.set("staff", user);
    await next();
  });

  app.use("/admin/*", async (c, next) => {
    const user = await loadStaff(c);
    if (!user) throw new Fail("unauthorized");
    if (user.role !== "super_admin") throw new Fail("forbidden");
    c.set("staff", user);
    await next();
  });

  app.route("/", publicRoutes);
  app.route("/", authRoutes);
  app.route("/", studentRoutes);
  app.route("/", staffRoutes);
  app.route("/", classroomRoutes);
  app.route("/", adminRoutes);
  app.route("/", aiRoutes);

  return app;
}

export type App = ReturnType<typeof createApp>;

/**
 * Default app (Vercel + dev server): Postgres when DATABASE_URL is set, otherwise PGlite
 * at PGLITE_DIR (default .data/pglite). The database is opened lazily on the first request.
 * Vercel has no writable disk, so there a missing DATABASE_URL is a clear 500 rather than a
 * PGlite crash; /health then fails too and the web app hides school features.
 */
const defaultEnv = readEnv();
const app = createApp({
  env: defaultEnv,
  db: () =>
    !defaultEnv.DATABASE_URL && process.env.VERCEL
      ? Promise.reject(new Fail("server_error", "DATABASE_URL is not set"))
      : createDbFromEnv(defaultEnv, process.env.PGLITE_DIR ?? ".data/pglite")
});

export default app;
