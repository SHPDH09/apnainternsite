#!/usr/bin/env node
/**
 * Build AWS RDS Postgres connection URL from env.
 * AWS RDS (PostgreSQL engine) uses the standard postgres wire protocol — the URL scheme is still postgresql://
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = val;
  }
  return out;
}

function isPlaceholderDatabaseUrl(url) {
  if (!url || typeof url !== "string") return true;
  const u = url.trim();
  if (!u) return true;
  if (/:(PASSWORD|YOUR_PASSWORD|changeme|change-me)@/i.test(u)) return true;
  if (/postgresql:\/\/postgres:PASSWORD@/i.test(u)) return true;
  return false;
}

/** Load DATABASE_URL for AWS RDS (Postgres engine). */
export function loadAwsRdsDatabaseUrl() {
  const fileEnv = {
    ...parseEnvFile(path.join(root, ".env")),
    ...parseEnvFile(path.join(root, ".env.awsrds")),
    ...parseEnvFile(path.join(root, ".env.awsrds.local")),
  };

  const directCandidates = [
    process.env.DATABASE_URL?.trim(),
    process.env.AWS_RDS_DATABASE_URL?.trim(),
    process.env.AWS_RDS_URL?.trim(),
    fileEnv.DATABASE_URL,
    fileEnv.AWS_RDS_DATABASE_URL,
    fileEnv.AWS_RDS_URL,
  ].filter(Boolean);

  for (const raw of directCandidates) {
    const direct = String(raw).replace(/^["']|["']$/g, "");
    if (/127\.0\.0\.1|localhost/.test(direct)) continue;
    if (!isPlaceholderDatabaseUrl(direct)) return direct;
  }

  const host =
    process.env.AWS_RDS_HOST ||
    fileEnv.AWS_RDS_HOST ||
    "ezyintern-staging-db.c5makww6eq8y.ap-south-1.rds.amazonaws.com";
  const user = process.env.AWS_RDS_USER || fileEnv.AWS_RDS_USER || "ezyintern";
  const pass = process.env.AWS_RDS_PASSWORD || fileEnv.AWS_RDS_PASSWORD;
  const db = process.env.AWS_RDS_DATABASE || fileEnv.AWS_RDS_DATABASE || "ezyintern";
  const port = process.env.AWS_RDS_PORT || fileEnv.AWS_RDS_PORT || "5432";

  if (user && pass && !/^(PASSWORD|YOUR_PASSWORD)$/i.test(pass)) {
    const encUser = encodeURIComponent(user);
    const encPass = encodeURIComponent(pass);
    return `postgresql://${encUser}:${encPass}@${host}:${port}/${db}?sslmode=require`;
  }

  throw new Error(
    "AWS RDS credentials missing or still using placeholder PASSWORD.\n" +
      "Set DATABASE_URL (real password) in Cursor Environment secrets, OR set:\n" +
      "  AWS_RDS_HOST, AWS_RDS_USER, AWS_RDS_PASSWORD, AWS_RDS_DATABASE\n" +
      "Staging host: ezyintern-staging-db.c5makww6eq8y.ap-south-1.rds.amazonaws.com (user ezyintern)\n" +
      "Alternate: database-1-instance-1.cgve8kwacke8.us-east-1.rds.amazonaws.com (user postgres)"
  );
}

export function pgClientConfig(url) {
  const useSsl = /sslmode=require/i.test(url) || /rds\.amazonaws\.com/i.test(url);
  return {
    connectionString: url
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/[?&]$/, ""),
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  };
}
