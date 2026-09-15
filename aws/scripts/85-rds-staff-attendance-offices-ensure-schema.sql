-- Idempotent schema ensure — called by admin RPCs so tables exist before any read/write.

CREATE OR REPLACE FUNCTION public._ensure_staff_attendance_office_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.staff_attendance_offices') IS NULL THEN
    CREATE TABLE public.staff_attendance_offices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      address text,
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      radius_meters integer NOT NULL DEFAULT 200 CHECK (radius_meters BETWEEN 25 AND 5000),
      max_gps_accuracy_m numeric DEFAULT 100 CHECK (max_gps_accuracy_m IS NULL OR max_gps_accuracy_m > 0),
      require_face boolean NOT NULL DEFAULT true,
      require_geo boolean NOT NULL DEFAULT true,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;

  IF to_regclass('public.staff_office_assignments') IS NULL THEN
    CREATE TABLE public.staff_office_assignments (
      employee_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      office_id uuid NOT NULL REFERENCES public.staff_attendance_offices(id) ON DELETE RESTRICT,
      assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      assigned_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_staff_office_assignments_office
      ON public.staff_office_assignments (office_id);
  END IF;

  ALTER TABLE public.staff_attendance_offices ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.staff_office_assignments ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Admins manage staff_attendance_offices" ON public.staff_attendance_offices;
  CREATE POLICY "Admins manage staff_attendance_offices" ON public.staff_attendance_offices
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

  DROP POLICY IF EXISTS "Staff read assigned office" ON public.staff_attendance_offices;
  CREATE POLICY "Staff read assigned office" ON public.staff_attendance_offices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_office_assignments a
      WHERE a.employee_id = auth.uid() AND a.office_id = staff_attendance_offices.id
    )
  );

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

  GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_attendance_offices TO authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_office_assignments TO authenticated;

  IF to_regclass('public.employee_attendance') IS NOT NULL THEN
    ALTER TABLE public.employee_attendance
      ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.staff_attendance_offices(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS check_in_distance_m numeric,
      ADD COLUMN IF NOT EXISTS check_out_distance_m numeric,
      ADD COLUMN IF NOT EXISTS check_in_gps_accuracy_m numeric,
      ADD COLUMN IF NOT EXISTS check_out_gps_accuracy_m numeric,
      ADD COLUMN IF NOT EXISTS verification_flags jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public._ensure_staff_attendance_office_schema() TO authenticated;
