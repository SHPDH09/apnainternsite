#!/usr/bin/env node
/** Regenerate api/staffOfficeSqlChunks.ts from aws/scripts/85 + 83 SQL files. */
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
  const parts = sql.split(/\n(?=CREATE OR REPLACE FUNCTION |DROP FUNCTION IF EXISTS |GRANT EXECUTE ON FUNCTION )/);
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
const selfSql = readSql("aws/scripts/88-rds-staff-office-self-attendance-rpc.sql");

const body = `/** Bundled staff office SQL for Vercel (generated — run scripts/bundle-staff-office-sql-chunks.mjs). */
${emitChunks("STAFF_OFFICE_ENSURE_SCHEMA_CHUNKS", "staffOfficeEnsureSchemaSql", ensureSql)}
${emitChunks("STAFF_OFFICE_ADMIN_RPC_CHUNKS", "staffOfficeAdminRpcSql", adminSql)}
${emitChunks("STAFF_OFFICE_SELF_RPC_CHUNKS", "staffOfficeSelfAttendanceRpcSql", selfSql)}
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
  "_staff_office_for_employee",
  "staff_self_attendance_status",
  "staff_self_check_in",
  "staff_self_check_out",
];
`;

fs.writeFileSync(out, body);
console.log("Wrote", out);
