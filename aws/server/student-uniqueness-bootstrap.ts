import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "./db.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const GLOBAL_SQL = "aws/scripts/77-rds-global-student-uniqueness.sql";
const HOTFIX_SQL = "aws/scripts/94-rds-validate-student-uniqueness-id-text.sql";

function resolveSqlPath(rel: string): string {
  const bundled = path.join(moduleDir, "sql", path.basename(rel));
  if (fs.existsSync(bundled)) return bundled;
  return path.resolve(moduleDir, "../..", rel);
}

async function functionExists(fn: string): Promise<boolean> {
  const { rows } = await query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = $1
     ) AS ok`,
    [fn]
  );
  return Boolean(rows[0]?.ok);
}

async function runSqlFile(rel: string): Promise<void> {
  const fp = resolveSqlPath(rel);
  if (!fs.existsSync(fp)) {
    throw new Error(`Student uniqueness SQL bundle missing: ${rel}`);
  }
  await query(fs.readFileSync(fp, "utf8"));
}

export function isValidateStudentUniquenessRpc(name: string): boolean {
  return name === "validate_student_uniqueness";
}

export function isValidateStudentUniquenessMissingError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || "");
  const code = String((err as { code?: string })?.code || "");
  return (
    code === "42883" ||
    /validate_student_uniqueness does not exist/i.test(msg) ||
    /function public\.validate_student_uniqueness does not exist/i.test(msg) ||
    /could not find the function/i.test(msg) ||
    /normalize_student_email does not exist/i.test(msg)
  );
}

/** Idempotent RDS bootstrap for validate_student_uniqueness (+ normalize helpers). */
export async function ensureStudentUniquenessSchema(): Promise<{ ok: true; applied: boolean }> {
  if (await functionExists("validate_student_uniqueness")) {
    try {
      await runSqlFile(HOTFIX_SQL);
    } catch {
      /* hotfix is best-effort when already present */
    }
    return { ok: true, applied: false };
  }

  await runSqlFile(GLOBAL_SQL);
  if (fs.existsSync(resolveSqlPath(HOTFIX_SQL))) {
    await runSqlFile(HOTFIX_SQL);
  }

  if (!(await functionExists("validate_student_uniqueness"))) {
    throw new Error("validate_student_uniqueness still missing after bootstrap SQL");
  }

  console.log("[student-uniqueness-bootstrap] validate_student_uniqueness ready");
  return { ok: true, applied: true };
}
