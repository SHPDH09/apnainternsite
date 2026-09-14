#!/usr/bin/env node
/**
 * During Cloudflare Workers Git build: sync SMTP_PASS into Worker secrets when the
 * build environment provides it (Cloudflare dashboard → Builds → Variables).
 * No secrets are read from the repository.
 */
import { execSync } from "node:child_process";

const pass =
  process.env.SMTP_PASS?.trim() ||
  process.env.HOSTINGER_SMTP_PASS?.trim() ||
  process.env.MAIL_SMTP_PASS?.trim();

const hasCfAuth =
  Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim()) ||
  Boolean(process.env.WRANGLER_API_TOKEN?.trim());

if (!pass || !hasCfAuth) {
  console.log(
    "[cloudflare-sync-mail-secrets] skip — need SMTP_PASS + Cloudflare API token in build env"
  );
  process.exit(0);
}

try {
  execSync("npx wrangler secret put SMTP_PASS", {
    input: pass,
    stdio: ["pipe", "inherit", "inherit"],
    env: process.env,
  });
  console.log("[cloudflare-sync-mail-secrets] SMTP_PASS synced to Worker secret");
} catch (e) {
  console.warn("[cloudflare-sync-mail-secrets] secret sync failed:", e instanceof Error ? e.message : e);
}
