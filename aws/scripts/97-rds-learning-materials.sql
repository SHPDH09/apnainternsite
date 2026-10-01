-- learning_materials table for admin uploads + student dashboard (RDS; no Supabase storage policies).

CREATE TABLE IF NOT EXISTS public.learning_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  material_type text NOT NULL DEFAULT 'learning_material'
    CHECK (material_type IN ('learning_material', 'project_report')),
  file_path text,
  file_url text,
  file_name text,
  mime_type text,
  target_universities text[] DEFAULT '{}',
  target_colleges text[] DEFAULT '{}',
  target_domains text[] DEFAULT '{}',
  target_modes text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_materials_type_active
  ON public.learning_materials (material_type, is_active, created_at DESC);

ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage learning materials" ON public.learning_materials;
CREATE POLICY "Admins manage learning materials"
  ON public.learning_materials
  FOR ALL
  TO authenticated
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

DROP POLICY IF EXISTS "Students read active learning materials" ON public.learning_materials;
CREATE POLICY "Students read active learning materials"
  ON public.learning_materials
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_materials TO authenticated;
GRANT SELECT ON public.learning_materials TO anon;
