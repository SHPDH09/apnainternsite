import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, query } from "./db.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const CERT_ISSUE_SQL = "aws/scripts/27-rds-certificates-issue-and-directory-fix.sql";
const CERT_VERIFY_SQL = "aws/scripts/38-rds-verify-certificate-public.sql";
const COURSE_CERT_VERIFY_SQL = "aws/scripts/47-rds-verify-course-certificate-public.sql";
const ISSUE_MARKER = "apna_cert_issue_v27";
const VERIFY_MARKER = "apna_cert_verify_v38";
const COURSE_VERIFY_MARKER = "apna_course_cert_verify_v47";

const PUBLIC_VERIFY_RPC = new Set([
  "verify_certificate_public",
  "verify_course_certificate_public",
]);

export function isPublicCertificateVerifyRpc(name: string): boolean {
  return PUBLIC_VERIFY_RPC.has(name);
}

export function isPublicCertificateVerifyMissingError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || "");
  const msg = err instanceof Error ? err.message : String(err);
  return (
    code === "42883" ||
    /function public\.verify_(course_)?certificate_public does not exist/i.test(msg) ||
    /could not find the function/i.test(msg)
  );
}

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

async function certificatesIssueNeedsFix(): Promise<boolean> {
  const { rows: fnRows } = await query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'admin_bulk_issue_certificates'
     LIMIT 1`
  );
  if (!fnRows[0]?.def?.includes(ISSUE_MARKER)) return true;

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

async function internshipVerifyNeedsFix(): Promise<boolean> {
  const { rows } = await query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'verify_certificate_public'
     LIMIT 1`
  );
  const def = String(rows[0]?.def || "");
  return !def.includes(VERIFY_MARKER);
}

async function courseVerifyNeedsFix(): Promise<boolean> {
  const { rows: tableRows } = await query<{ reg: string | null }>(
    `SELECT to_regclass('public.course_certificates')::text AS reg`
  );
  if (!tableRows[0]?.reg) return false;

  const { rows } = await query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'verify_course_certificate_public'
     LIMIT 1`
  );
  const def = String(rows[0]?.def || "");
  return !def.includes(COURSE_VERIFY_MARKER);
}

export async function ensureCertificateIssueRpc(): Promise<{ ok: true; applied: boolean }> {
  let applied = false;
  if (await certificatesIssueNeedsFix()) {
    await runSqlFile(CERT_ISSUE_SQL);
    applied = true;
    console.log("[certificate-bootstrap] certificate issue + directory RPCs ready");
  }
  if (await internshipVerifyNeedsFix()) {
    await runSqlFile(CERT_VERIFY_SQL);
    applied = true;
    console.log("[certificate-bootstrap] internship public verify RPC ready");
  }
  if (await courseVerifyNeedsFix()) {
    await runSqlFile(COURSE_CERT_VERIFY_SQL);
    applied = true;
    console.log("[certificate-bootstrap] course public verify RPC ready");
  }
  return { ok: true, applied };
}
