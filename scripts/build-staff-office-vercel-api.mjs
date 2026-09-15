#!/usr/bin/env node
/** Regenerate self-contained Vercel staff-office-rpc.ts from SQL script 87. */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const sql = fs.readFileSync(
  path.join(root, "aws/scripts/87-rds-staff-attendance-offices-all-admin-rpc-fix.sql"),
  "utf8"
);
const chunks = [];
for (let i = 0; i < sql.length; i += 1800) chunks.push(sql.slice(i, i + 1800));

const templatePath = path.join(root, "api/staff-office-rpc.ts");
const template = fs.readFileSync(templatePath, "utf8");
if (!template.includes("Fully self-contained for Vercel")) {
  console.error("api/staff-office-rpc.ts template changed — update build script manually");
  process.exit(1);
}

const chunksCode = `const SQL_CHUNKS = ${JSON.stringify(chunks)};\nfunction bootstrapSql() { return SQL_CHUNKS.join(""); }`;
const updated = template.replace(
  /const SQL_CHUNKS = \[[\s\S]*?\nfunction bootstrapSql\(\) \{ return SQL_CHUNKS\.join\(""\); \}/,
  chunksCode
);
fs.writeFileSync(templatePath, updated);
console.log("Updated api/staff-office-rpc.ts with", chunks.length, "SQL chunks");
