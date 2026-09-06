import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "./db.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const PARTNER_SQL = "aws/scripts/60-rds-partner-applications-coupons.sql";

const PARTNER_TABLES = new Set([
  "partner_applications",
  "referral_coupons",
  "referral_coupon_clicks",
]);

let bootstrapped = false;

export function isPartnerApplicationsTable(table: string): boolean {
  return PARTNER_TABLES.has(table);
}

function resolveSqlPath(rel: string): string {
  const bundled = path.join(moduleDir, "sql", path.basename(rel));
  if (fs.existsSync(bundled)) return bundled;
  return path.resolve(moduleDir, "../..", rel);
}

async function runPartnerApplicationsSqlFile(): Promise<void> {
  const fp = resolveSqlPath(PARTNER_SQL);
  if (!fs.existsSync(fp)) {
    throw new Error(`Partner applications bootstrap SQL missing: ${PARTNER_SQL}`);
  }
  const sql = fs.readFileSync(fp, "utf8");
  await query(sql);
}

async function partnerApplicationsTableExists(): Promise<boolean> {
  const { rows } = await query<{ reg: string | null }>(
    `SELECT to_regclass('public.partner_applications')::text AS reg`
  );
  return Boolean(rows[0]?.reg);
}

/** Idempotent RDS bootstrap for partner_applications + referral coupon tables. */
export async function ensurePartnerApplicationsTables(): Promise<{ ok: true }> {
  if (bootstrapped) return { ok: true };

  try {
    await runPartnerApplicationsSqlFile();
  } catch (err) {
    const msg = String((err as { message?: string })?.message || err || "");
    const exists = await partnerApplicationsTableExists();
    if (exists) {
      console.warn("[partner-applications-bootstrap] partial apply (coupons may need referral_partners):", msg.slice(0, 200));
    } else if (/referral_partners|does not exist/i.test(msg)) {
      await query(`
        CREATE TABLE IF NOT EXISTS public.partner_applications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          partner_kind text NOT NULL CHECK (partner_kind IN ('cyber_cafe', 'referral', 'coupon')),
          status text NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'approved', 'rejected')),
          full_name text NOT NULL,
          email text NOT NULL,
          contact_number text,
          payload jsonb NOT NULL DEFAULT '{}'::jsonb,
          rejection_reason text,
          reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
          reviewed_at timestamptz,
          approved_record_id uuid,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON public.partner_applications (status, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_partner_applications_auth_user ON public.partner_applications (auth_user_id);
        CREATE INDEX IF NOT EXISTS idx_partner_applications_email_lower ON public.partner_applications (lower(email));
      `);
      try {
        await query(`
          ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
          DROP POLICY IF EXISTS "Users read own partner applications" ON public.partner_applications;
          CREATE POLICY "Users read own partner applications" ON public.partner_applications
            FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
          DROP POLICY IF EXISTS "Users insert own partner applications" ON public.partner_applications;
          CREATE POLICY "Users insert own partner applications" ON public.partner_applications
            FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
          DROP POLICY IF EXISTS "Admins manage partner applications" ON public.partner_applications;
          CREATE POLICY "Admins manage partner applications" ON public.partner_applications
            FOR ALL TO authenticated
            USING (
              public.has_role(auth.uid(), 'admin'::public.app_role)
              OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
              OR public.has_role(auth.uid(), 'staff'::public.app_role)
            )
            WITH CHECK (
              public.has_role(auth.uid(), 'admin'::public.app_role)
              OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
              OR public.has_role(auth.uid(), 'staff'::public.app_role)
            );
        `);
      } catch {
        await query(`ALTER TABLE public.partner_applications DISABLE ROW LEVEL SECURITY`);
      }
      await query(`
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_applications TO authenticated;
      `);
    } else {
      throw err;
    }
  }

  if (!(await partnerApplicationsTableExists())) {
    throw new Error("partner_applications table could not be created");
  }

  bootstrapped = true;
  return { ok: true };
}
