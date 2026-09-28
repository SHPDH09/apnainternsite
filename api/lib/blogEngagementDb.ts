/** Self-contained RDS access for blog views/leads (Vercel-safe — no aws/server imports). */
import type { QueryResultRow } from "pg";
import { BLOG_ENGAGEMENT_BOOTSTRAP_SQL } from "./blogEngagementBootstrap.js";

let pool: import("pg").Pool | null = null;
let engagementReady: Promise<void> | null = null;

function pgPoolConfig(databaseUrl: string) {
  return {
    connectionString: databaseUrl
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/[?&]$/, ""),
    ssl: /rds\.amazonaws\.com/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: 1,
    connectionTimeoutMillis: 20000,
  };
}

async function getPool(): Promise<import("pg").Pool> {
  if (pool) return pool;
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured on this deployment");
  }
  const pg = await import("pg");
  pool = new pg.default.Pool(pgPoolConfig(databaseUrl));
  return pool;
}

export async function ensureBlogEngagementSchema(): Promise<void> {
  if (!engagementReady) {
    engagementReady = (async () => {
      const p = await getPool();
      await p.query(BLOG_ENGAGEMENT_BOOTSTRAP_SQL);
    })();
  }
  await engagementReady;
}

export async function blogEngagementQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  await ensureBlogEngagementSchema();
  const p = await getPool();
  return p.query<T>(text, params);
}
