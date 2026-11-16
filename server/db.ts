/**
 * Tiny database abstraction so the same SQL runs on hosted Postgres (via `postgres`)
 * and on embedded PGlite (local dev + tests). Use $1-style params and portable SQL.
 *
 * Portability notes:
 *  - Pass JSON as `JSON.stringify(value)` and cast with `$n::text::jsonb`.
 *  - Cast aggregates to int (`count(*)::int`) — postgres.js returns int8 as strings.
 *  - Timestamps are timestamptz; pass ISO strings, read back Date objects (see `iso()`).
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dataDir, { recursive: true });
  }
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await pg.query<T>(sql, params);
      return result.rows;
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
    async close() {
      await pg.close();
    }
  };
}

export async function createPostgresDb(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    // Serverless-friendly: small pool, short idle timeout, no prepared statements (PgBouncer/Neon pooler).
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    prepare: false,
    onnotice: () => undefined
  });
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const rows = await sql.unsafe(text, params as never[]);
      return rows as unknown as T[];
    },
    async exec(text: string) {
      await sql.unsafe(text).simple();
    },
    async close() {
      await sql.end({ timeout: 5 });
    }
  };
}

/** DATABASE_URL -> Postgres; otherwise PGlite at `pgliteDir` (in-memory when undefined). */
export function createDbFromEnv(env: { DATABASE_URL?: string }, pgliteDir?: string): Promise<Db> {
  if (env.DATABASE_URL) return createPostgresDb(env.DATABASE_URL);
  return createPgliteDb(pgliteDir);
}

/** Normalises a timestamp column value (Date or string) to an ISO string. */
export function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

export function isoRequired(value: unknown): string {
  return iso(value) ?? new Date(0).toISOString();
}

/** JSON param helper: use together with `$n::text::jsonb`. */
export function json(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

/** First row or null. */
export async function one<T>(rows: Promise<T[]>): Promise<T | null> {
  const list = await rows;
  return list[0] ?? null;
}
