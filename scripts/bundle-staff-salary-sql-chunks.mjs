#!/usr/bin/env node
/** Regenerate api/staffSalarySqlChunks.ts from aws/scripts/81 + 86 SQL files. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "api/staffSalarySqlChunks.ts");

function readSql(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8").trim();
}

function chunkSql(sql, size = 7500) {
  if (sql.length <= size) return [sql];
  const parts = sql.split(/\n(?=CREATE OR REPLACE FUNCTION |DROP FUNCTION IF EXISTS |ALTER TABLE public\.|CREATE TABLE IF NOT EXISTS |GRANT EXECUTE ON FUNCTION )/);
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

const baseSql = readSql("aws/scripts/81-rds-staff-salary-account.sql");
const advancedSql = readSql("aws/scripts/86-rds-staff-salary-advanced.sql");

const body = `/** Bundled staff salary SQL for Vercel (generated — run scripts/bundle-staff-salary-sql-chunks.mjs). */
${emitChunks("STAFF_SALARY_BASE_CHUNKS", "staffSalaryBaseSql", baseSql)}
${emitChunks("STAFF_SALARY_ADVANCED_CHUNKS", "staffSalaryAdvancedSql", advancedSql)}
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
