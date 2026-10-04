-- Platform-wide service toggles (admin shell + student dashboard).
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT true,
  label text,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.system_settings (key, is_enabled) VALUES
  ('live_classes', true),
  ('certificates', true),
  ('bulk_certification', true),
  ('internship_registration', true)
ON CONFLICT (key) DO NOTHING;

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

GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
