import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { MeResponse, RequestLinkResponse } from "../../src/api/types";
import {
  audit,
  dbOf,
  depsOf,
  loadStaff,
  nowOf,
  rateLimit,
  readBody,
  schoolById,
  SESSION_COOKIE,
  type Ctx,
  type HonoEnv,
  type UserRow
} from "../context";
import { isoRequired, type Db } from "../db";
import { magicLinkEmail } from "../email";
import { addDays, Fail, isProduction, newId, randomToken, sha256 } from "../lib";
import { schoolSettings, toStaffUser } from "../mappers";
import { emailSchema, tokenSchema } from "../schemas";

const LINK_TTL_MS = 15 * 60_000;
const SESSION_DAYS = 30;

export async function meResponse(db: Db, user: UserRow): Promise<MeResponse> {
  const school = user.school_id ? await schoolById(db, user.school_id) : null;
  return { user: toStaffUser(user), school: school ? await schoolSettings(db, school) : null };
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function appOrigin(c: Ctx): string {
  const { env } = depsOf(c);
  if (env.APP_URL) return env.APP_URL;
  const requestOrigin = new URL(c.req.url).origin;
  if (!isProduction(env)) {
    // Dev: the browser's origin (Vite, e.g. localhost:5173) even if the proxy rewrote Host.
    const origin = c.req.header("origin");
    try {
      if (origin && LOCAL_HOSTS.has(new URL(origin).hostname)) return new URL(origin).origin;
    } catch {
      // ignore malformed Origin
    }
  }
  // Host-derived fallback. Set APP_URL in production so links can't be steered by a Host header.
  return requestOrigin;
}

function secureCookie(c: Ctx): boolean {
  return isProduction(depsOf(c).env) || new URL(c.req.url).protocol === "https:" || c.req.header("x-forwarded-proto") === "https";
}

export const authRoutes = new Hono<HonoEnv>();

authRoutes.post("/auth/request-link", async (c) => {
  rateLimit(c, "requestLink");
  const { email } = await readBody(c, emailSchema);
  rateLimit(c, "requestLink", email);
  const deps = depsOf(c);
  const db = dbOf(c);
  const now = nowOf(c);

  let [user] = await db.query<UserRow>(`SELECT * FROM users WHERE email = $1`, [email]);
  if (!user && deps.env.SUPER_ADMIN_EMAIL && email === deps.env.SUPER_ADMIN_EMAIL) {
    // Bootstrap the first super admin on first use.
    const rows = await db.query<UserRow>(
      `INSERT INTO users (id, email, name, role, school_id, branch_id, created_at)
       VALUES ($1, $2, $3, 'super_admin', NULL, NULL, $4)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING *`,
      [newId(), email, email.split("@")[0] ?? "Admin", now.toISOString()]
    );
    user = rows[0];
  }

  const response: RequestLinkResponse = { ok: true };
  if (!user) return c.json(response);

  const token = randomToken(32);
  await db.query(
    `INSERT INTO login_tokens (id, user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [newId(), user.id, sha256(token), new Date(now.getTime() + LINK_TTL_MS).toISOString(), now.toISOString()]
  );
  const link = `${appOrigin(c)}/staff/verify?token=${encodeURIComponent(token)}`;

  if (deps.sendEmail) {
    try {
      await deps.sendEmail(magicLinkEmail(user.email, link));
    } catch (error) {
      // Still 200: a different status would reveal that the account exists.
      console.error("[auth] email send failed", error);
    }
  } else if (!isProduction(deps.env)) {
    console.log(`[auth] dev sign-in link for ${user.email}: ${link}`);
    response.devLink = link;
  } else {
    console.error("[auth] no email provider configured (RESEND_API_KEY / EMAIL_FROM)");
  }
  return c.json(response);
});

authRoutes.post("/auth/verify", async (c) => {
  rateLimit(c, "verify");
  const { token } = await readBody(c, tokenSchema);
  const db = dbOf(c);
  const now = nowOf(c);
  const [row] = await db.query<{ id: string; user_id: string; expires_at: unknown; used_at: unknown }>(
    `SELECT id, user_id, expires_at, used_at FROM login_tokens WHERE token_hash = $1`,
    [sha256(token)]
  );
  if (!row || row.used_at) throw new Fail("invalid_code");
  if (new Date(isoRequired(row.expires_at)) <= now) {
    throw new Fail("expired");
  }
  // Single use: only the first concurrent verify wins.
  const claimed = await db.query(
    `UPDATE login_tokens SET used_at = $2 WHERE id = $1 AND used_at IS NULL RETURNING id`,
    [row.id, now.toISOString()]
  );
  if (!claimed.length) throw new Fail("invalid_code");

  const [user] = await db.query<UserRow>(
    `UPDATE users SET last_login_at = $2 WHERE id = $1 RETURNING *`,
    [row.user_id, now.toISOString()]
  );
  if (!user) throw new Fail("invalid_code");

  const sessionToken = randomToken(32);
  await db.query(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [newId(), user.id, sha256(sessionToken), addDays(now, SESSION_DAYS).toISOString(), now.toISOString()]
  );
  // Housekeeping: drop expired tokens/sessions for this user.
  await db.query(`DELETE FROM login_tokens WHERE user_id = $1 AND expires_at < $2`, [user.id, now.toISOString()]);
  await db.query(`DELETE FROM sessions WHERE user_id = $1 AND expires_at < $2`, [user.id, now.toISOString()]);

  setCookie(c, SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: secureCookie(c),
    maxAge: SESSION_DAYS * 86_400
  });
  await audit(c, "staff.login", { schoolId: user.school_id, target: user.id, actorEmail: user.email });
  return c.json(await meResponse(db, user));
});

authRoutes.get("/auth/me", async (c) => {
  const user = await loadStaff(c);
  if (!user) throw new Fail("unauthorized");
  return c.json(await meResponse(dbOf(c), user));
});

authRoutes.post("/auth/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await dbOf(c).query(`DELETE FROM sessions WHERE token_hash = $1`, [sha256(token)]);
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: secureCookie(c) });
  return c.json({ ok: true });
});
