-- Admin RPCs for office CRUD (SECURITY DEFINER — reliable save even when RLS/session edge cases).

CREATE OR REPLACE FUNCTION public._assert_admin_attendance_offices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_staff_attendance_office(
  p_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_radius_meters integer DEFAULT 200,
  p_max_gps_accuracy_m numeric DEFAULT 100,
  p_require_face boolean DEFAULT true,
  p_require_geo boolean DEFAULT true,
  p_is_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.staff_attendance_offices%ROWTYPE;
BEGIN
  PERFORM public._assert_admin_attendance_offices();

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Office name is required';
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RAISE EXCEPTION 'Latitude and longitude are required';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.staff_attendance_offices (
      name, address, latitude, longitude, radius_meters,
      max_gps_accuracy_m, require_face, require_geo, is_active, updated_at
    )
    VALUES (
      trim(p_name),
      nullif(trim(coalesce(p_address, '')), ''),
      p_latitude,
      p_longitude,
      coalesce(p_radius_meters, 200),
      p_max_gps_accuracy_m,
      coalesce(p_require_face, true),
      coalesce(p_require_geo, true),
      coalesce(p_is_active, true),
      now()
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.staff_attendance_offices
    SET
      name = trim(p_name),
      address = nullif(trim(coalesce(p_address, '')), ''),
      latitude = p_latitude,
      longitude = p_longitude,
      radius_meters = coalesce(p_radius_meters, 200),
      max_gps_accuracy_m = p_max_gps_accuracy_m,
      require_face = coalesce(p_require_face, true),
      require_geo = coalesce(p_require_geo, true),
      is_active = coalesce(p_is_active, true),
      updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Office not found';
    END IF;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_staff_attendance_office(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin_attendance_offices();

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Office id is required';
  END IF;

  DELETE FROM public.staff_attendance_offices WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Office not found or still assigned to employees';
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_staff_office(
  p_employee_id uuid,
  p_office_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.staff_office_assignments%ROWTYPE;
BEGIN
  PERFORM public._assert_admin_attendance_offices();

  IF p_employee_id IS NULL OR p_office_id IS NULL THEN
    RAISE EXCEPTION 'Employee and office are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.staff_attendance_offices o
    WHERE o.id = p_office_id AND o.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Office not found or inactive';
  END IF;

  INSERT INTO public.staff_office_assignments (employee_id, office_id, assigned_by, assigned_at)
  VALUES (p_employee_id, p_office_id, auth.uid(), now())
  ON CONFLICT (employee_id) DO UPDATE
  SET office_id = EXCLUDED.office_id,
      assigned_by = auth.uid(),
      assigned_at = now()
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_staff_office_assignment(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin_attendance_offices();

  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee id is required';
  END IF;

  DELETE FROM public.staff_office_assignments WHERE employee_id = p_employee_id;

  RETURN jsonb_build_object('ok', true, 'employee_id', p_employee_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_staff_attendance_office(
  uuid, text, text, double precision, double precision, integer, numeric, boolean, boolean, boolean
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_staff_attendance_office(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_staff_office(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_staff_office_assignment(uuid) TO authenticated;
