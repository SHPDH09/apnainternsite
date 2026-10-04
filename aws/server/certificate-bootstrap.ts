import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, query } from "./db.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const CERT_SQL = "aws/scripts/27-rds-certificates-issue-and-directory-fix.sql";
const MARKER = "apna_cert_issue_v27";

function resolveSqlPath(rel: string): string {
  const bundled = path.join(moduleDir, "sql", path.basename(rel));
  if (fs.existsSync(bundled)) return bundled;
  const root = path.resolve(moduleDir, "../..");
  return path.join(root, rel);
}

async function runSqlFile(rel: string): Promise<void> {
  const fp = resolveSqlPath(rel);
  if (!fs.existsSync(fp)) {
    throw new Error(`Certificate bootstrap SQL missing: ${rel} (looked at ${fp})`);
  }
  const sql = fs.readFileSync(fp, "utf8");
  const client = await getPool().connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

async function certificatesNeedFix(): Promise<boolean> {
  const { rows: fnRows } = await query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'admin_bulk_issue_certificates'
     LIMIT 1`
  );
  if (!fnRows[0]?.def?.includes(MARKER)) return true;

  const { rows: listRows } = await query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'admin_list_certificates_directory'
     ORDER BY p.oid DESC
     LIMIT 1`
  );
  const listDef = String(listRows[0]?.def || "");
  if (!listDef) return true;
  if (!listDef.includes("s.id::text = c.user_id::text")) return true;
  if (listDef.includes("ON s.id = c.user_id")) return true;
  return false;
}

export async function ensureCertificateIssueRpc(): Promise<{ ok: true; applied: boolean }> {
  const needsFix = await certificatesNeedFix();
  if (!needsFix) {
    return { ok: true, applied: false };
  }
  await runSqlFile(CERT_SQL);
  console.log("[certificate-bootstrap] certificate issue + directory RPCs ready");
  return { ok: true, applied: true };
}
