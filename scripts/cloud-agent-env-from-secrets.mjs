#!/usr/bin/env node
/**
 * Write .env.awsrds.local from Cursor Environment secrets (injected as env vars).
 * Called from .cursor/environment.json install hook.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".env.awsrds.local");

const url =
  process.env.DATABASE_URL?.trim() ||
  process.env.AWS_RDS_DATABASE_URL?.trim() ||
  process.env.AWS_RDS_URL?.trim();

if (!url) {
  const host = process.env.AWS_RDS_HOST?.trim();
  const user = process.env.AWS_RDS_USER?.trim();
  const pass = process.env.AWS_RDS_PASSWORD?.trim();
  const db = process.env.AWS_RDS_DATABASE?.trim() || "postgres";
  const port = process.env.AWS_RDS_PORT?.trim() || "5432";
  if (host && user && pass) {
    const encUser = encodeURIComponent(user);
    const encPass = encodeURIComponent(pass);
    const built = `postgresql://${encUser}:${encPass}@${host}:${port}/${db}?sslmode=require`;
    writeEnv(built);
    process.exit(0);
  }
  console.log("[cloud-agent-env] No DATABASE_URL / AWS_RDS_* secrets — skip .env.awsrds.local");
  process.exit(0);
}

writeEnv(url.replace(/^["']|["']$/g, ""));

function writeEnv(databaseUrl) {
  const lines = [
    "# Auto-generated from Cursor Environment secrets — do not commit",
    `DATABASE_URL=${databaseUrl}`,
    "LOCAL_SUPABASE=true",
    "LOCAL_JWT_SECRET=" + (process.env.LOCAL_JWT_SECRET || "change-me-local-secret"),
    "VITE_SUPABASE_URL=http://localhost:8080",
    "VITE_SUPABASE_PUBLISHABLE_KEY=local-anon-key",
    "RDS_RPC_OPEN=true",
  ];
  fs.writeFileSync(out, lines.join("\n") + "\n", { mode: 0o600 });
  console.log("[cloud-agent-env] Wrote .env.awsrds.local from environment secrets");
}
