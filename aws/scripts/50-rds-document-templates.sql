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
