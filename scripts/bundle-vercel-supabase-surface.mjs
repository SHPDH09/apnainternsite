#!/usr/bin/env node
/** Bundle auth/rest/storage for one Vercel serverless function (Hyderabad RDS + IAM). */
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "api/.bundled");
const outfile = path.join(outDir, "supabase-surface.mjs");

fs.mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, "scripts/vercel-supabase-surface-entry.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile,
  sourcemap: true,
  packages: "bundle",
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

console.log(`✅ Vercel supabase surface → ${path.relative(root, outfile)}`);
