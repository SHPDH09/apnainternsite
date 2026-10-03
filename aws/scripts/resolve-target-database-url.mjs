#!/usr/bin/env node
/**
 * Print TARGET_DATABASE_URL to stdout for CI (no secrets logged).
 * Priority: TARGET_DATABASE_URL / HYDERABAD_DATABASE_URL env → build from parts → IAM (Hyderabad).
 */
import { execFileSync } from "node:child_process";

const host =
  process.env.AWS_RDS_TARGET_HOST?.trim() ||
  "ezyintern.cpy4aaca6mfv.ap-south-2.rds.amazonaws.com";
const user = process.env.AWS_RDS_TARGET_USER?.trim() || "postgres";
const db = process.env.AWS_RDS_TARGET_DATABASE?.trim() || "ezyintern";
const port = process.env.AWS_RDS_TARGET_PORT?.trim() || "5432";
const region = process.env.AWS_RDS_TARGET_REGION?.trim() || "ap-south-2";

const direct =
  process.env.TARGET_DATABASE_URL?.trim() ||
  process.env.HYDERABAD_DATABASE_URL?.trim();
if (direct) {
  process.stdout.write(direct);
  process.exit(0);
}

const pass = process.env.AWS_RDS_TARGET_PASSWORD?.trim() || process.env.RDS_MASTER_PASSWORD?.trim();
if (pass) {
  const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}?sslmode=require`;
  process.stdout.write(url);
  process.exit(0);
}

if (process.env.USE_RDS_IAM_TARGET === "true") {
  try {
    const token = execFileSync(
      "aws",
      ["rds", "generate-db-auth-token", "--hostname", host, "--port", "5432", "--username", user, "--region", region],
      { encoding: "utf8" }
    ).trim();
    const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(token)}@${host}:${port}/${db}?sslmode=require`;
    process.stdout.write(url);
    process.exit(0);
  } catch {
    console.error("IAM token for target failed (need AWS creds + rds-db:connect)");
    process.exit(1);
  }
}

console.error(
  "Set TARGET_DATABASE_URL, HYDERABAD_DATABASE_URL, AWS_RDS_TARGET_PASSWORD, or USE_RDS_IAM_TARGET=true with AWS keys"
);
process.exit(1);
