import { query } from "./db.js";

let ready = false;

/** Minimal idempotent bootstrap so company dashboard REST reads work before full migration is applied. */
export async function ensureCompanyProfilesTable(): Promise<void> {
  if (ready) return;
  await query(`
    CREATE TABLE IF NOT EXISTS public.company_profiles (
      id uuid PRIMARY KEY,
      contact_name text NOT NULL DEFAULT '',
      designation text,
      email text NOT NULL DEFAULT '',
      phone text,
      company_name text NOT NULL DEFAULT '',
      gst_number text,
      company_address text,
      status text NOT NULL DEFAULT 'pending_approval',
      rejection_reason text,
      email_verified_at timestamptz,
      approved_at timestamptz,
      approved_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS company_profiles_email_lower_idx
      ON public.company_profiles (lower(trim(email)));
  `);
  ready = true;
}

export function isCompanyProfilesTable(table: string): boolean {
  return table === "company_profiles";
}
