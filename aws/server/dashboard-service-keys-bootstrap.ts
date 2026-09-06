import { query } from "./db.js";

let bootstrapped = false;

/** Idempotent RDS bootstrap for dashboard_service_keys singleton (student lock/fee config). */
export async function ensureDashboardServiceKeysTable(): Promise<{ ok: true }> {
  if (bootstrapped) return { ok: true };

  await query(`
    CREATE TABLE IF NOT EXISTS public.dashboard_service_keys (
      id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      services jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_by uuid,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await query(`
    INSERT INTO public.dashboard_service_keys (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING;
  `);

  try {
    await query(`
      ALTER TABLE public.dashboard_service_keys ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Public read dashboard service keys" ON public.dashboard_service_keys;
      CREATE POLICY "Public read dashboard service keys"
        ON public.dashboard_service_keys
        FOR SELECT
        TO anon, authenticated
        USING (true);
      DROP POLICY IF EXISTS "Admins manage dashboard service keys" ON public.dashboard_service_keys;
      CREATE POLICY "Admins manage dashboard service keys"
        ON public.dashboard_service_keys
        FOR ALL
        TO authenticated
        USING (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        )
        WITH CHECK (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        );
    `);
  } catch {
    await query(`ALTER TABLE public.dashboard_service_keys DISABLE ROW LEVEL SECURITY`);
  }

  await query(`
    GRANT SELECT ON public.dashboard_service_keys TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_service_keys TO authenticated;
  `);

  bootstrapped = true;
  return { ok: true };
}
