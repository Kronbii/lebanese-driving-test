import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import type { ErrorCode } from "../src/api/types.js";

// ---------- env ----------

export interface Env {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  APP_URL?: string;
  SUPER_ADMIN_EMAIL?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  CRON_SECRET?: string;
}

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  const pick = (key: keyof Env) => {
    const value = source[key]?.trim();
    return value ? value : undefined;
  };
  return {
    NODE_ENV: pick("NODE_ENV"),
    DATABASE_URL: pick("DATABASE_URL"),
    APP_URL: pick("APP_URL")?.replace(/\/+$/, ""),
    SUPER_ADMIN_EMAIL: pick("SUPER_ADMIN_EMAIL")?.toLowerCase(),
    RESEND_API_KEY: pick("RESEND_API_KEY"),
    EMAIL_FROM: pick("EMAIL_FROM"),
    ANTHROPIC_API_KEY: pick("ANTHROPIC_API_KEY"),
    ANTHROPIC_MODEL: pick("ANTHROPIC_MODEL"),
    CRON_SECRET: pick("CRON_SECRET")
  };
}

export const isProduction = (env: Env) => env.NODE_ENV === "production";

// ---------- errors ----------

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  feature_disabled: 403,
  limit_reached: 403,
  school_suspended: 403,
  consent_required: 400,
  invalid_code: 400,
  expired: 410,
  ai_unavailable: 503,
  server_error: 500
};

/** Throw anywhere in a handler; the app's onError turns it into `{ error, message? }`. */
export class Fail extends Error {
  code: ErrorCode;
  status: number;
  detail?: string;

  constructor(code: ErrorCode, detail?: string, status?: number) {
    super(detail ?? code);
    this.code = code;
    this.detail = detail;
    this.status = status ?? STATUS[code];
  }
}

// ---------- crypto ----------

export const newId = () => randomUUID();

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** No 0/O, 1/I/L, 2/Z, 5/S, 8/B — easy to read aloud and type on a phone. */
const UNAMBIGUOUS = "ACDEFGHJKMNPQRTUVWXY34679";

export function randomCode(length: number, alphabet = UNAMBIGUOUS): string {
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

/** Login codes are shown as XXXXX-XXXXX; accept any spacing/dashes/case. */
export function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatLoginCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

// ---------- rate limiting ----------

export interface RateRule {
  limit: number;
  windowMs: number;
}

/** Simple in-memory sliding window per key. Per-instance only (best effort on serverless). */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private lastSweep = 0;

  check(key: string, rule: RateRule, now = Date.now()): boolean {
    this.sweep(now);
    const since = now - rule.windowMs;
    const list = (this.hits.get(key) ?? []).filter((at) => at > since);
    if (list.length >= rule.limit) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }

  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, list] of this.hits) {
      const fresh = list.filter((at) => at > now - 3_600_000);
      if (fresh.length) this.hits.set(key, fresh);
      else this.hits.delete(key);
    }
  }
}

export const RATE_RULES = {
  requestLink: { limit: 5, windowMs: 10 * 60_000 },
  verify: { limit: 20, windowMs: 10 * 60_000 },
  join: { limit: 20, windowMs: 10 * 60_000 },
  login: { limit: 10, windowMs: 10 * 60_000 },
  leads: { limit: 5, windowMs: 10 * 60_000 },
  appointments: { limit: 5, windowMs: 10 * 60_000 },
  events: { limit: 120, windowMs: 60_000 },
  errors: { limit: 30, windowMs: 60_000 },
  ai: { limit: 20, windowMs: 10 * 60_000 },
  liveJoin: { limit: 30, windowMs: 60_000 }
} satisfies Record<string, RateRule>;

export type RateRuleName = keyof typeof RATE_RULES;

// ---------- dates ----------

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function lastDays(now: Date, count: number): string[] {
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) days.push(dayKey(addDays(now, -i)));
  return days;
}

// ---------- CSV ----------

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 with BOM and CRLF so Excel opens Arabic text correctly. */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

// ---------- misc ----------

export function clampText(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Referral refs: short, lowercase slug characters only. */
export function cleanRef(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 48);
  return cleaned || null;
}
