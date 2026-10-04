import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, query } from "./db.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const CLASS_LINK_SQL = "aws/scripts/29-rds-admin-class-link-rpc.sql";
const MARKER = "apna_class_link_v29";

const CLASS_LINK_RPC_NAMES = new Set([
  "admin_insert_class_link",
  "admin_update_class_link",
  "admin_insert_class_link_minimal",
]);

export function isClassLinkRpc(name: string): boolean {
  return CLASS_LINK_RPC_NAMES.has(name);
}

export function isClassLinkRpcMissingError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || "");
  const msg = err instanceof Error ? err.message : String(err);
  return (
    code === "42883" ||
    /function public\.admin_(insert|update)_class_link/i.test(msg) ||
    /could not find the function/i.test(msg) ||
    /does not exist/i.test(msg)
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
    throw new Error(`Class link bootstrap SQL missing: ${rel} (looked at ${fp})`);
  }
  const sql = fs.readFileSync(fp, "utf8");
  const client = await getPool().connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

async function classLinkRpcsNeedFix(): Promise<boolean> {
  const { rows: fnRows } = await query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'admin_insert_class_link'
     LIMIT 1`
  );
  if (!fnRows[0]?.def?.includes(MARKER)) return true;

  const { rows: minimalRows } = await query<{ cnt: string }>(
    `SELECT count(*)::text AS cnt
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'admin_insert_class_link_minimal'`
  );
  if (Number(minimalRows[0]?.cnt || 0) < 1) return true;

  const { rows: updateRows } = await query<{ cnt: string }>(
    `SELECT count(*)::text AS cnt
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'admin_update_class_link'`
  );
  if (Number(updateRows[0]?.cnt || 0) < 1) return true;

  return false;
}

export async function ensureClassLinkRpc(): Promise<{ ok: true; applied: boolean }> {
  const needsFix = await classLinkRpcsNeedFix();
  if (!needsFix) {
    return { ok: true, applied: false };
  }
  await runSqlFile(CLASS_LINK_SQL);
  console.log("[class-link-bootstrap] live class admin RPCs ready");
  return { ok: true, applied: true };
}
