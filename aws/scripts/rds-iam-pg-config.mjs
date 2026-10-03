#!/usr/bin/env node
/**
 * RDS IAM auth token for node-pg (Postgres user, ap-south-2 Hyderabad, etc.).
 * Set RDS_IAM_AUTH=true and DATABASE_URL without password.
 */
import { Signer } from "@aws-sdk/rds-signer";

export function rdsIamAuthEnabled() {
  return /^(1|true|yes)$/i.test(String(process.env.RDS_IAM_AUTH || "").trim());
}

export function parsePostgresUrl(raw) {
  const u = new URL(raw.replace(/^postgresql:/, "http:"));
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: decodeURIComponent(u.username || "postgres"),
    database: u.pathname.replace(/^\//, "") || "postgres",
  };
}

export async function getRdsIamAuthToken(rawUrl) {
  const { host, port, user } = parsePostgresUrl(rawUrl);
  const region =
    process.env.AWS_RDS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "ap-south-2";
  const signer = new Signer({
    hostname: host,
    port,
    username: user,
    region,
  });
  return signer.getAuthToken();
}
