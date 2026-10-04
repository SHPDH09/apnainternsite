#!/usr/bin/env node
/**
 * Copy RDS bootstrap SQL into aws/server/sql for Vercel serverless (rds-portal reads via fs).
 * Mirrors aws/scripts/bundle-lambda.mjs SQL staging; run during vercel-build only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptsDir = path.join(root, "aws/scripts");
const outDir = path.join(root, "aws/server/sql");

fs.mkdirSync(outDir, { recursive: true });

let count = 0;
for (const name of fs.readdirSync(scriptsDir)) {
  if (!name.endsWith(".sql")) continue;
  fs.copyFileSync(path.join(scriptsDir, name), path.join(outDir, name));
  count += 1;
}

console.log(`✅ Vercel bootstrap SQL → aws/server/sql (${count} files)`);
