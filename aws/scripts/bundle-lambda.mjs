#!/usr/bin/env node
/** Bundle Lambda handler + api routes into aws/lambda/dist/ */
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "aws/lambda/dist");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, "aws/lambda/handler.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: path.join(outDir, "handler.mjs"),
  sourcemap: true,
  external: [],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

// Minimal package.json for Lambda ESM
fs.writeFileSync(
  path.join(outDir, "package.json"),
  JSON.stringify({ type: "module", name: "ezyintern-lambda", version: "1.0.0" }, null, 2)
);

// Copy SQL for Lambda bootstrap + rds-apply-all endpoint
const sqlDir = path.join(outDir, "sql");
fs.mkdirSync(sqlDir, { recursive: true });
const scriptsDir = path.join(root, "aws/scripts");
for (const f of fs.readdirSync(scriptsDir).filter((name) => name.endsWith(".sql"))) {
  fs.copyFileSync(path.join(scriptsDir, f), path.join(sqlDir, f));
}
for (const rel of [
  "supabase/update_payment_schema.sql",
  "supabase/migrations/20260709100000_engineering_university_configs.sql",
  "supabase/hotfix_internship_mode_filtering.sql",
  "supabase/migrations/20260605120000_notification_management.sql",
]) {
  const src = path.join(root, rel);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(sqlDir, path.basename(rel)));
  }
}

console.log("✅ Lambda bundle → aws/lambda/dist/handler.mjs");
