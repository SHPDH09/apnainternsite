#!/usr/bin/env node
/**
 * Grant admin portal access on AWS RDS (see api/lib/grantAdminByEmail.ts for Lambda bootstrap).
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";
import { loadAwsRdsDatabaseUrl, pgClientConfig } from "./aws-rds-url.mjs";

const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const role = String(process.env.ADMIN_ROLE || "admin").trim();

const ALLOWED_ROLES = new Set(["admin", "super_admin", "staff"]);

async function main() {
  if (!email) {
    console.error("Missing ADMIN_EMAIL");
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error("Missing ADMIN_PASSWORD (min 8 chars)");
    process.exit(1);
  }
  if (!ALLOWED_ROLES.has(role)) {
    console.error(`ADMIN_ROLE must be one of: ${[...ALLOWED_ROLES].join(", ")}`);
    process.exit(1);
  }

  const client = new pg.Client(pgClientConfig(loadAwsRdsDatabaseUrl()));
  await client.connect();

  const info = await client.query(
    "SELECT current_database() AS db, inet_server_addr()::text AS host",
  );
  console.log(`Connected: ${info.rows[0].db} @ ${info.rows[0].host}`);

  const hash = await bcrypt.hash(password, 10);

  const existing = await client.query(
    `SELECT id FROM auth.users WHERE lower(trim(email)) = lower(trim($1)) LIMIT 1`,
    [email],
  );

  let userId = existing.rows[0]?.id;

  await client.query("BEGIN");

  try {
    if (!userId) {
      userId = randomUUID();
      await client.query(
        `INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at, is_sso_user, is_anonymous
        ) VALUES (
          '00000000-0000-0000-0000-000000000000', $1::uuid,
          'authenticated', 'authenticated', $2, $3,
          now(), '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', 'Apna Intern Admin'),
          now(), now(), false, false
        )`,
        [userId, email, hash],
      );

      const identities = await client.query(
        `SELECT to_regclass('auth.identities') AS t`,
      );
      if (identities.rows[0]?.t) {
        await client.query(
          `INSERT INTO auth.identities (
            id, provider_id, user_id, identity_data, provider,
            last_sign_in_at, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1::text, $1::uuid,
            jsonb_build_object('sub', $1::text, 'email', $2, 'email_verified', true),
            'email', now(), now(), now()
          )`,
          [userId, email],
        );
      }

      console.log(`Created auth user ${userId}`);
    } else {
      await client.query(
        `UPDATE auth.users SET
          encrypted_password = $2,
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
        WHERE id = $1::uuid`,
        [userId, hash],
      );
      console.log(`Updated password for existing user ${userId}`);
    }

    await client.query(
      `INSERT INTO public.user_roles (user_id, role)
       VALUES ($1::uuid, $2::public.app_role)
       ON CONFLICT (user_id, role) DO NOTHING`,
      [userId, role],
    );

    await client.query(
      `INSERT INTO public.admin_permissions (user_id)
       VALUES ($1::uuid)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );

    await client.query(
      `INSERT INTO public.profiles (id, full_name, email)
       VALUES ($1::uuid, 'Apna Intern Admin', $2)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now()`,
      [userId, email],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }

  const roles = await client.query(
    `SELECT role FROM public.user_roles WHERE user_id = $1::uuid ORDER BY role`,
    [userId],
  );

  console.log("\n✅ Admin access granted");
  console.log(`   email: ${email}`);
  console.log(`   user_id: ${userId}`);
  console.log(`   roles: ${roles.rows.map((r) => r.role).join(", ") || "(none)"}`);
  console.log("\nLogin at /admin/login (email OTP required after password).");

  await client.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
