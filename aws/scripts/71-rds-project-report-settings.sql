-- Domain-wise project report PDF templates for Admin Auto Generate Project Report

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

CREATE INDEX IF NOT EXISTS idx_project_report_domain_templates_name
  ON public.project_report_domain_templates (domain_name);

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

GRANT SELECT ON public.project_report_domain_templates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_report_domain_templates TO authenticated;

-- Drop legacy singleton table if an earlier draft was applied
DROP TABLE IF EXISTS public.project_report_settings;
