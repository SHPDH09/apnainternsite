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
  const chunks = [];
  for (let i = 0; i < sql.length; i += size) {
    chunks.push(sql.slice(i, i + size));
  }
  return chunks;
}

function emitChunks(constName, fnName, sql) {
  const chunks = chunkSql(sql);
  return `export const ${constName} = ${JSON.stringify(chunks, null, 0)};\nexport function ${fnName}(): string {\n  return ${constName}.join("");\n}\n`;
}

const ensureSql = readSql("aws/scripts/85-rds-staff-attendance-offices-ensure-schema.sql");
const adminSql = readSql("aws/scripts/83-rds-staff-attendance-offices-admin-rpc.sql");

const body = `/** Bundled staff office SQL for Vercel (generated — run scripts/bundle-staff-office-sql-chunks.mjs). */
${emitChunks("STAFF_OFFICE_ENSURE_SCHEMA_CHUNKS", "staffOfficeEnsureSchemaSql", ensureSql)}
${emitChunks("STAFF_OFFICE_ADMIN_RPC_CHUNKS", "staffOfficeAdminRpcSql", adminSql)}
/** @deprecated Use ensure + call ensure() + admin RPCs instead of one-shot apply. */
export function staffOfficeBootstrapSql(): string {
  return staffOfficeEnsureSchemaSql() + staffOfficeAdminRpcSql();
}
export const STAFF_OFFICE_REQUIRED_RPCS = [
  "admin_list_staff_attendance_offices",
  "admin_upsert_staff_attendance_office",
  "admin_delete_staff_attendance_office",
  "admin_assign_staff_office",
  "admin_remove_staff_office_assignment",
  "admin_list_staff_office_assignments",
];
`;

fs.writeFileSync(out, body);
console.log("Wrote", out);
