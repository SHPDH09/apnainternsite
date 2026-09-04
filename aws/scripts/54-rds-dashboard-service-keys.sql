-- Global dashboard service lock/fee config (singleton) — run on RDS after deploy

CREATE TABLE IF NOT EXISTS public.dashboard_service_keys (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  services jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.dashboard_service_keys (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

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

GRANT SELECT ON public.dashboard_service_keys TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_service_keys TO authenticated;
