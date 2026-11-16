/**
 * Local API server: `npm run dev:api` (or `npm run dev:all` with Vite).
 * Uses PGlite at .data/pglite unless DATABASE_URL is set. Vite proxies /api here.
 */
import { serve } from "@hono/node-server";
import app from "./app.js";

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  const where = process.env.DATABASE_URL ? "Postgres (DATABASE_URL)" : `PGlite (${process.env.PGLITE_DIR ?? ".data/pglite"})`;
  console.log(`[api] http://localhost:${info.port}/api  ·  db: ${where}`);
});
