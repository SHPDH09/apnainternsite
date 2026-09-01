import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { query } from "../../aws/server/db.js";

export type GrantAdminRole = "admin" | "super_admin" | "staff";

export async function grantAdminByEmail(
  rawEmail: string,
  password: string,
  role: GrantAdminRole = "admin",
): Promise<{ userId: string; email: string; roles: string[] }> {
  const email = rawEmail.trim().toLowerCase();
  if (!email.includes("@")) {
    throw new Error("Invalid email");
  }
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const hash = await bcrypt.hash(password, 10);

  const existing = await query<{ id: string }>(
    `SELECT id FROM auth.users WHERE lower(trim(email)) = lower(trim($1)) LIMIT 1`,
    [email],
  );

  let userId = existing.rows[0]?.id;

  if (!userId) {
    userId = randomUUID();
    await query(
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

    const identities = await query(`SELECT to_regclass('auth.identities') AS t`);
    if (identities.rows[0]?.t) {
      await query(
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
  } else {
    await query(
      `UPDATE auth.users SET
        encrypted_password = $2,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
      WHERE id = $1::uuid`,
      [userId, hash],
    );
  }

  await query(
    `INSERT INTO public.user_roles (user_id, role)
     VALUES ($1::uuid, $2::public.app_role)
     ON CONFLICT (user_id, role) DO NOTHING`,
    [userId, role],
  );

  await query(
    `INSERT INTO public.admin_permissions (user_id) VALUES ($1::uuid)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );

  await query(
    `INSERT INTO public.profiles (id, full_name, email)
     VALUES ($1::uuid, 'Apna Intern Admin', $2)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now()`,
    [userId, email],
  );

  const roles = await query<{ role: string }>(
    `SELECT role::text FROM public.user_roles WHERE user_id = $1::uuid ORDER BY role`,
    [userId],
  );

  return {
    userId,
    email,
    roles: roles.rows.map((r) => r.role),
  };
}
