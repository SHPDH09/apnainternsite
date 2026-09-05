#!/usr/bin/env node
/**
 * Upsert Mail Manager SMTP into RDS site_smtp_config (server-only table).
 * Usage: node scripts/seed-site-smtp-config.mjs
 * Requires DATABASE_URL and SMTP_PASS in environment.
 */
import pg from "pg";

const host =
  process.env.SMTP_HOST?.trim() ||
  "brua3gww2w8z.fips.wmjb.mail-manager-smtp.amazonaws.com";
const port = process.env.SMTP_PORT?.trim() || "587";
const user =
  process.env.SMTP_USER?.trim() || "inp-3u5sedrqj7kqwjazxwmph2th";
const pass = process.env.SMTP_PASS?.trim() || "";
const mailFrom = process.env.MAIL_FROM_ADDRESS?.trim() || "info@apnaintern.in";
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}
if (!pass) {
  console.error("SMTP_PASS missing");
  process.exit(1);
}

const sql = `
CREATE TABLE IF NOT EXISTS public.site_smtp_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  smtp_host text NOT NULL,
  smtp_port text NOT NULL DEFAULT '587',
  smtp_user text NOT NULL,
  smtp_pass text NOT NULL,
  mail_from_address text NOT NULL DEFAULT 'info@apnaintern.in',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_smtp_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_smtp_config FROM PUBLIC;
REVOKE ALL ON public.site_smtp_config FROM anon, authenticated;
INSERT INTO public.site_smtp_config (id, smtp_host, smtp_port, smtp_user, smtp_pass, mail_from_address, updated_at)
VALUES (1, $1, $2, $3, $4, $5, now())
ON CONFLICT (id) DO UPDATE SET
  smtp_host = EXCLUDED.smtp_host,
  smtp_port = EXCLUDED.smtp_port,
  smtp_user = EXCLUDED.smtp_user,
  smtp_pass = EXCLUDED.smtp_pass,
  mail_from_address = EXCLUDED.mail_from_address,
  updated_at = now();
`;

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: /rds\.amazonaws\.com/i.test(databaseUrl)
    ? { rejectUnauthorized: false }
    : undefined,
});

try {
  await pool.query(sql, [host, port, user, pass, mailFrom]);
  console.log("[seed-site-smtp-config] upserted site_smtp_config for", host);
} finally {
  await pool.end();
}
