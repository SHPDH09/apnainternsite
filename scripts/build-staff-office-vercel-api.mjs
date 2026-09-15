#!/usr/bin/env node
/** Regenerate Vercel-safe self-contained staff office API files from bundled SQL. */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const bundledPath = path.join(root, "api/lib/staffOfficeSqlBundled.ts");
const bundled = fs.readFileSync(bundledPath, "utf8");
const sqlMatch = bundled.match(/export const STAFF_OFFICE_BOOTSTRAP_SQL = ([\s\S]+);\s*$/);
if (!sqlMatch) {
  console.error("Could not parse STAFF_OFFICE_BOOTSTRAP_SQL from", bundledPath);
  process.exit(1);
}
const sqlConst = sqlMatch[1];

const rpcHandler = fs.readFileSync(path.join(root, "api/staff-office-rpc.ts"), "utf8");
if (!rpcHandler.includes("Self-contained for Vercel")) {
  console.error("api/staff-office-rpc.ts template changed — update build-staff-office-vercel-api.mjs");
  process.exit(1);
}

// Replace SQL constant in both files
for (const file of ["api/staff-office-rpc.ts", "api/ensure-staff-attendance-offices.ts"]) {
  const fp = path.join(root, file);
  let src = fs.readFileSync(fp, "utf8");
  src = src.replace(
    /const STAFF_OFFICE_BOOTSTRAP_SQL = [\s\S]+?;\n\n/,
    `const STAFF_OFFICE_BOOTSTRAP_SQL = ${sqlConst};\n\n`
  );
  fs.writeFileSync(fp, src);
  console.log("Updated", file);
}
