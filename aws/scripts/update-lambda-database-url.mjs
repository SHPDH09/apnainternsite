#!/usr/bin/env node
/**
 * Set Lambda DATABASE_URL (and optional AWS_DEFAULT_REGION) without touching other env vars.
 * Used after Hyderabad RDS cutover (GitHub Actions).
 */
import { execFileSync } from "node:child_process";

const fn = process.env.LAMBDA_FUNCTION_NAME || "ezyintern-api-staging";
const region = process.env.AWS_DEFAULT_REGION || process.env.LAMBDA_AWS_REGION || "ap-south-1";
const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.TARGET_DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("DATABASE_URL or TARGET_DATABASE_URL is required");
  process.exit(1);
}

function awsJson(args) {
  const out = execFileSync("aws", args, { encoding: "utf8" });
  return JSON.parse(out);
}

const current = awsJson([
  "lambda",
  "get-function-configuration",
  "--function-name",
  fn,
  "--region",
  region,
  "--output",
  "json",
]);

const vars = { ...(current.Environment?.Variables || {}) };
vars.DATABASE_URL = databaseUrl;
vars.RDS_CANONICAL_DATABASE_URL = databaseUrl;
if (process.env.RDS_IAM_AUTH === "true") {
  vars.RDS_IAM_AUTH = "true";
  vars.AWS_RDS_REGION = process.env.AWS_RDS_REGION || "ap-south-2";
} else if (/:\/\/[^/@]+:[^/@]+@/.test(databaseUrl)) {
  vars.RDS_IAM_AUTH = "false";
}
if (process.env.SET_LAMBDA_REGION === "true" && process.env.LAMBDA_AWS_REGION) {
  vars.AWS_DEFAULT_REGION = process.env.LAMBDA_AWS_REGION;
}

const payload = JSON.stringify({ Variables: vars });
awsJson([
  "lambda",
  "update-function-configuration",
  "--function-name",
  fn,
  "--region",
  region,
  "--environment",
  payload,
  "--output",
  "json",
]);

console.log(`Updated DATABASE_URL on Lambda ${fn} (${region})`);
