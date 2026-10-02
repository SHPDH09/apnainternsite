#!/usr/bin/env node
/**
 * Vercel runs `npm run vercel-build` before compiling each serverless function.
 * The static app is already built via vercel.json `buildCommand` — skip repeat Vite builds.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const marker = "dist/index.html";
if (existsSync(marker)) {
  process.exit(0);
}

const result = spawnSync("vite", ["build"], {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
