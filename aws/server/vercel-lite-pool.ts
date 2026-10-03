/**
 * Single shared pg pool for Vercel lite handlers (auth-portal + rds-portal REST/RPC).
 * Uses Supavisor transaction mode (:6543) — session mode (:5432) exhausts pool_size on serverless.
 */
import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;

export function normalizeVercelDatabaseUrl(raw: string): string {
  let url = raw
    .replace(/([?&])sslmode=[^&]*/gi, "$1")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?");

  if (/pooler\.supabase\.com/i.test(url) && /:5432(\/|\?|$)/.test(url)) {
    url = url.replace(/:5432(\/|\?)/, ":6543$1");
  }

  return url;
}

export function getVercelLitePool(): Pool {
  if (pool) return pool;

  const raw = String(process.env.DATABASE_URL || "").trim();
  if (!raw) throw new Error("DATABASE_URL missing");

  pool = new Pool({
    connectionString: normalizeVercelDatabaseUrl(raw),
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 12_000,
    allowExitOnIdle: true,
    ssl: { rejectUnauthorized: false },
  });

  return pool;
}

export async function vercelLiteQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return getVercelLitePool().query<T>(text, params);
}
