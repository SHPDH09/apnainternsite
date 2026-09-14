import { query } from "./db.js";

let bootstrapped = false;

export function isProjectReportTable(table: string): boolean {
  return table === "project_report_domain_templates";
}

async function tableExists(): Promise<boolean> {
  const { rows } = await query<{ exists: boolean }>(
    `SELECT to_regclass('public.project_report_domain_templates') IS NOT NULL AS exists`
  );
  return Boolean(rows[0]?.exists);
}

/** Idempotent RDS bootstrap for domain-wise project report templates. */
export async function ensureProjectReportSchema(): Promise<{ ok: true; applied: boolean }> {
  if (bootstrapped && (await tableExists())) {
    return { ok: true, applied: false };
  }

  await query(`
    CREATE TABLE IF NOT EXISTS public.project_report_domain_templates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      domain_name text NOT NULL,
      domain_key text NOT NULL UNIQUE,
      template_pdf_path text,
      template_pdf_url text,
      template_file_name text,
      field_layout jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_project_report_domain_templates_name
      ON public.project_report_domain_templates (domain_name);
  `);

  try {
    await query(`
      ALTER TABLE public.project_report_domain_templates ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Public read project report domain templates" ON public.project_report_domain_templates;
      CREATE POLICY "Public read project report domain templates"
        ON public.project_report_domain_templates
        FOR SELECT
        TO anon, authenticated
        USING (true);
      DROP POLICY IF EXISTS "Admins manage project report domain templates" ON public.project_report_domain_templates;
      CREATE POLICY "Admins manage project report domain templates"
        ON public.project_report_domain_templates
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
    await query(`ALTER TABLE public.project_report_domain_templates DISABLE ROW LEVEL SECURITY`);
  }

  await query(`
    GRANT SELECT ON public.project_report_domain_templates TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_report_domain_templates TO authenticated;
  `);

  await query(`DROP TABLE IF EXISTS public.project_report_settings`);

  bootstrapped = true;
  console.log("[project-report-bootstrap] project_report_domain_templates ready");
  return { ok: true, applied: true };
}
