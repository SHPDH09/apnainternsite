-- Hotfix: create staff_office_assignments when only staff_attendance_offices exists (partial 82 apply).

CREATE TABLE IF NOT EXISTS public.staff_office_assignments (
  employee_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id uuid NOT NULL REFERENCES public.staff_attendance_offices(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_office_assignments_office
  ON public.staff_office_assignments (office_id);

ALTER TABLE public.staff_office_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage staff_office_assignments" ON public.staff_office_assignments;
CREATE POLICY "Admins manage staff_office_assignments" ON public.staff_office_assignments
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Staff read own office assignment" ON public.staff_office_assignments;
CREATE POLICY "Staff read own office assignment" ON public.staff_office_assignments
FOR SELECT TO authenticated
USING (employee_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_office_assignments TO authenticated;
