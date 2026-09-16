#!/usr/bin/env node
/** Regenerate api/staffOfficeSqlChunks.ts from aws/scripts office + salary SQL files. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "api/staffOfficeSqlChunks.ts");

function readSql(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").trim();
}

function chunkSql(sql, size = 7500) {
  if (sql.length <= size) return [sql];
  const parts = sql.split(
    /\n(?=CREATE OR REPLACE FUNCTION |DROP FUNCTION IF EXISTS |ALTER TABLE public\.|CREATE TABLE IF NOT EXISTS |GRANT EXECUTE ON FUNCTION )/
  );
  const chunks = [];
  let buf = "";
  for (const part of parts) {
    const piece = part.startsWith("\n") ? part.slice(1) : part;
    if (!piece) continue;
    if ((buf + piece).length > size && buf) {
      chunks.push(buf);
      buf = piece;
    } else {
      buf += (buf ? "\n" : "") + piece;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [sql];
}

function emitChunks(constName, fnName, sql) {
  const chunks = chunkSql(sql);
  return `export const ${constName} = ${JSON.stringify(chunks, null, 0)};\nexport function ${fnName}(): string {\n  return ${constName}.join("");\n}\n`;
}

const ensureSql = readSql("aws/scripts/85-rds-staff-attendance-offices-ensure-schema.sql");
const adminSql = readSql("aws/scripts/83-rds-staff-attendance-offices-admin-rpc.sql");
const selfSql =
  readSql("aws/scripts/84-rds-staff-attendance-helpers.sql") +
  "\n\n" +
  readSql("aws/scripts/88-rds-staff-office-self-attendance-rpc.sql") +
  "\n\n" +
  readSql("aws/scripts/89-rds-staff-office-employee-id-resolve.sql") +
  "\n\n" +
  readSql("aws/scripts/90-rds-staff-face-register.sql");
const salaryBaseSql = readSql("aws/scripts/81-rds-staff-salary-account.sql");
const salaryAdvancedSql = readSql("aws/scripts/86-rds-staff-salary-advanced.sql");

const body = `/** Bundled staff office + salary SQL for Vercel (generated — run scripts/bundle-staff-office-sql-chunks.mjs). */
${emitChunks("STAFF_OFFICE_ENSURE_SCHEMA_CHUNKS", "staffOfficeEnsureSchemaSql", ensureSql)}
${emitChunks("STAFF_OFFICE_ADMIN_RPC_CHUNKS", "staffOfficeAdminRpcSql", adminSql)}
${emitChunks("STAFF_OFFICE_SELF_RPC_CHUNKS", "staffOfficeSelfAttendanceRpcSql", selfSql)}
${emitChunks("STAFF_SALARY_BASE_CHUNKS", "staffSalaryBaseSql", salaryBaseSql)}
${emitChunks("STAFF_SALARY_ADVANCED_CHUNKS", "staffSalaryAdvancedSql", salaryAdvancedSql)}
/** @deprecated Use ensure + call ensure() + admin RPCs instead of one-shot apply. */
export function staffOfficeBootstrapSql(): string {
  return staffOfficeEnsureSchemaSql() + staffOfficeAdminRpcSql() + staffOfficeSelfAttendanceRpcSql();
}
export const STAFF_OFFICE_REQUIRED_RPCS = [
  "admin_list_staff_attendance_offices",
  "admin_upsert_staff_attendance_office",
  "admin_delete_staff_attendance_office",
  "admin_assign_staff_office",
  "admin_remove_staff_office_assignment",
  "admin_list_staff_office_assignments",
];
export const STAFF_SELF_OFFICE_REQUIRED_RPCS = [
  "_haversine_meters",
  "_ist_minutes_now",
  "_staff_office_for_employee",
  "_staff_attendance_employee_id",
  "_staff_row_for_attendance",
  "staff_register_face",
  "staff_self_attendance_status",
  "staff_self_check_in",
  "staff_self_check_out",
];
export const STAFF_SALARY_REQUIRED_RPCS = [
  "admin_list_staff_salary_holidays",
  "admin_upsert_staff_salary_holiday",
  "admin_delete_staff_salary_holiday",
  "admin_list_staff_paid_leave_grants",
  "admin_upsert_staff_paid_leave_grant",
  "admin_generate_staff_salary",
  "admin_mark_staff_salary_paid",
];
`;

fs.writeFileSync(out, body);
console.log("Wrote", out);
