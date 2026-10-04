import { query } from "./db.js";

let bootstrapped = false;

const DEFAULT_ROWS: Array<{ key: string; is_enabled: boolean }> = [
  { key: "live_classes", is_enabled: true },
  { key: "certificates", is_enabled: true },
  { key: "bulk_certification", is_enabled: true },
  { key: "internship_registration", is_enabled: true },
];

export function isSystemSettingsTable(table: string): boolean {
  return table === "system_settings";
}

export function isMissingSystemSettingsError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || "");
  const code = String((err as { code?: string })?.code || "");
  return (
    code === "42P01" ||
    /relation ["']?public\.system_settings["']? does not exist/i.test(msg) ||
    /relation ["']?system_settings["']? does not exist/i.test(msg)
  );
}

/** Platform-wide service toggles (admin + student dashboard). */
export async function ensureSystemSettingsSchema(): Promise<{ ok: true }> {
  if (bootstrapped) return { ok: true };

  await query(`
    CREATE TABLE IF NOT EXISTS public.system_settings (
      key text PRIMARY KEY,
      is_enabled boolean NOT NULL DEFAULT true,
      label text,
      description text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  for (const row of DEFAULT_ROWS) {
    await query(
      `
      INSERT INTO public.system_settings (key, is_enabled)
      VALUES ($1, $2)
      ON CONFLICT (key) DO NOTHING
    `,
      [row.key, row.is_enabled]
    );
  }

  try {
    await query(`
      ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Public read system_settings" ON public.system_settings;
      CREATE POLICY "Public read system_settings"
        ON public.system_settings FOR SELECT TO anon, authenticated
        USING (true);
      DROP POLICY IF EXISTS "Admins manage system_settings" ON public.system_settings;
      CREATE POLICY "Admins manage system_settings"
        ON public.system_settings FOR ALL TO authenticated
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
    await query(`ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY`);
  }

  await query(`
    GRANT SELECT ON public.system_settings TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
  `);

  bootstrapped = true;
  return { ok: true };
}
