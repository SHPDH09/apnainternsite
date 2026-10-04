#!/usr/bin/env node
/** Embed admin registration bootstrap SQL for Vercel (no fs dependency at runtime). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "aws/server/registration-bootstrap-sql.ts");

const files = {
  SQL_12: "aws/scripts/12-rds-safe-metadata-json.sql",
  SQL_18: "aws/scripts/18-rds-fix-payment-enrollment.sql",
  SQL_19: "aws/scripts/19-rds-fix-password-text-id.sql",
  SQL_20: "aws/scripts/20-rds-fix-admin-create-registration-text-meta.sql",
  SQL_21: "aws/scripts/21-rds-admin-create-registration-uuid-id.sql",
};

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const lines = [
  "/** Generated — run scripts/bundle-registration-bootstrap-sql.mjs */",
  "",
];

for (const [exportName, rel] of Object.entries(files)) {
  const sql = read(rel).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  lines.push(`export const ${exportName} = \`${sql}\`;`, "");
}

lines.push(
  "export const REGISTRATION_BOOTSTRAP_SQL_BY_BASENAME: Record<string, string> = {",
  ...Object.entries(files).map(([exportName, rel]) => {
    const base = path.basename(rel);
    return `  ${JSON.stringify(base)}: ${exportName},`;
  }),
  "};",
  ""
);

fs.writeFileSync(out, lines.join("\n"));
console.log(`✅ Registration bootstrap SQL → ${path.relative(root, out)}`);
