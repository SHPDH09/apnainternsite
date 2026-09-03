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

// Copy registration bootstrap SQL for Lambda cold-start auto-fix
const sqlDir = path.join(outDir, "sql");
fs.mkdirSync(sqlDir, { recursive: true });
for (const rel of [
  "aws/scripts/12-rds-safe-metadata-json.sql",
  "aws/scripts/18-rds-fix-payment-enrollment.sql",
  "aws/scripts/19-rds-fix-password-text-id.sql",
  "aws/scripts/20-rds-fix-admin-create-registration-text-meta.sql",
]) {
  fs.copyFileSync(path.join(root, rel), path.join(sqlDir, path.basename(rel)));
}

console.log("✅ Lambda bundle → aws/lambda/dist/handler.mjs");
