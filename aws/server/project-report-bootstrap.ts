import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, query } from "./db.js";

const SQL_REL = "aws/scripts/71-rds-project-report-settings.sql";
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

let bootstrapped = false;

function resolveSqlPath(): string {
  const bundled = path.join(moduleDir, "sql", path.basename(SQL_REL));
  if (fs.existsSync(bundled)) return bundled;
  return path.resolve(moduleDir, "../..", SQL_REL);
}

export function isProjectReportTable(table: string): boolean {
  return table === "project_report_domain_templates";
}

async function tableExists(): Promise<boolean> {
  const { rows } = await query<{ exists: boolean }>(
    `SELECT to_regclass('public.project_report_domain_templates') IS NOT NULL AS exists`
  );
  return Boolean(rows[0]?.exists);
}

/** Idempotent RDS bootstrap for domain-wise project report templates. */
export async function ensureProjectReportSchema(): Promise<{ ok: true; applied: boolean }> {
  if (bootstrapped && (await tableExists())) {
    return { ok: true, applied: false };
  }

  const fp = resolveSqlPath();
  if (!fs.existsSync(fp)) {
    throw new Error(`Project report bootstrap SQL missing: ${SQL_REL} (looked at ${fp})`);
  }

  const sql = fs.readFileSync(fp, "utf8");
  const client = await getPool().connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }

  bootstrapped = true;
  console.log("[project-report-bootstrap] project_report_domain_templates ready");
  return { ok: true, applied: true };
}
