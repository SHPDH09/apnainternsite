-- Project report template settings (singleton) for Admin Auto Generate Project Report

CREATE TABLE IF NOT EXISTS public.project_report_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  template_pdf_path text,
  template_pdf_url text,
  template_file_name text,
  field_layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.project_report_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.project_report_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read project report settings" ON public.project_report_settings;
CREATE POLICY "Public read project report settings"
  ON public.project_report_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage project report settings" ON public.project_report_settings;
CREATE POLICY "Admins manage project report settings"
  ON public.project_report_settings
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

GRANT SELECT ON public.project_report_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_report_settings TO authenticated;
