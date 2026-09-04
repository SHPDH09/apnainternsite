-- Global certificate / offer-letter templates + per-student document overrides

CREATE TABLE IF NOT EXISTS public.document_templates (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  certificate jsonb NOT NULL DEFAULT '{}'::jsonb,
  offer_letter jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.document_templates (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS document_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read document templates" ON public.document_templates;
CREATE POLICY "Public read document templates"
  ON public.document_templates
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage document templates" ON public.document_templates;
CREATE POLICY "Admins manage document templates"
  ON public.document_templates
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

GRANT SELECT ON public.document_templates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
