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

/** Install the public homepage RPC if production is missing its migration. */
export async function ensurePublicCompanyPartnersRpc(): Promise<void> {
  await ensureCompanyProfilesTable();
  await query(`
    CREATE OR REPLACE FUNCTION public.list_public_company_partners()
    RETURNS json
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id', cp.id,
            'company_name', cp.company_name,
            'contact_name', cp.contact_name,
            'designation', cp.designation,
            'company_address', cp.company_address
          )
          ORDER BY cp.company_name ASC
        ),
        '[]'::json
      )
      FROM public.company_profiles cp
      WHERE cp.status = 'approved';
    $$;
    REVOKE ALL ON FUNCTION public.list_public_company_partners() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.list_public_company_partners() TO anon, authenticated;
  `);
}

export function isCompanyProfilesTable(table: string): boolean {
  return table === "company_profiles";
}
