-- Staff block/unblock + employee attendance RPCs (see aws/scripts/66-rds-staff-block-employee-attendance-rpc.sql)

CREATE OR REPLACE FUNCTION public.assert_may_manage_staff()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  ) THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.admin_permissions ap
    WHERE ap.user_id = auth.uid()
      AND (
        COALESCE(ap.can_manage_staff, false)
        OR COALESCE(ap.can_manage_employee_attendance, false)
      )
  ) THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'Access denied';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_staff_blocked(
  p_staff_id uuid,
  p_is_blocked boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_may_manage_staff();
  IF p_staff_id IS NULL THEN
    RAISE EXCEPTION 'staff_id required';
  END IF;
  UPDATE public.admin_staff
  SET is_blocked = COALESCE(p_is_blocked, false), updated_at = now()
  WHERE id = p_staff_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found';
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', p_staff_id, 'is_blocked', COALESCE(p_is_blocked, false));
END;
$$;

CREATE OR REPLACE FUNCTION public._normalize_employee_attendance_status(p_status text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text := lower(trim(COALESCE(p_status, 'present')));
BEGIN
  IF s IN ('present', 'absent', 'half_day', 'leave', 'holiday', 'overtime') THEN
    RETURN s;
  END IF;
  IF s IN ('p', 'presente', 'yes', '1') THEN RETURN 'present'; END IF;
  IF s IN ('a', 'no', '0') THEN RETURN 'absent'; END IF;
  IF s IN ('half', 'halfday', 'half-day') THEN RETURN 'half_day'; END IF;
  IF s IN ('l', 'on leave') THEN RETURN 'leave'; END IF;
  RETURN 'present';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_employee_attendance(
  p_employee_id uuid,
  p_attendance_date date,
  p_status text DEFAULT 'present',
  p_notes text DEFAULT NULL,
  p_check_in_at timestamptz DEFAULT NULL,
  p_check_out_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := public._normalize_employee_attendance_status(p_status);
  v_row public.employee_attendance%ROWTYPE;
BEGIN
  PERFORM public.assert_may_manage_staff();
  IF p_employee_id IS NULL OR p_attendance_date IS NULL THEN
    RAISE EXCEPTION 'employee_id and attendance_date required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_staff s WHERE s.id = p_employee_id) THEN
    RAISE EXCEPTION 'Employee not found in staff directory';
  END IF;

  INSERT INTO public.employee_attendance (
    employee_id,
    attendance_date,
    status,
    notes,
    marked_by,
    check_in_at,
    check_out_at,
    updated_at
  )
  VALUES (
    p_employee_id,
    p_attendance_date,
    v_status,
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    auth.uid(),
    p_check_in_at,
    p_check_out_at,
    now()
  )
  ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
    status = EXCLUDED.status,
    notes = EXCLUDED.notes,
    marked_by = EXCLUDED.marked_by,
    check_in_at = EXCLUDED.check_in_at,
    check_out_at = EXCLUDED.check_out_at,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'row', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_employee_attendance(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_may_manage_staff();
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'id required';
  END IF;
  DELETE FROM public.employee_attendance WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance record not found';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_employee_attendance(
  p_employee_id uuid DEFAULT NULL,
  p_from_date date DEFAULT NULL,
  p_to_date date DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS SETOF public.employee_attendance
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 5000);
  v_status text;
BEGIN
  PERFORM public.assert_may_manage_staff();
  v_status := NULLIF(lower(trim(COALESCE(p_status, ''))), '');
  IF v_status = 'all' THEN v_status := NULL; END IF;

  RETURN QUERY
  SELECT ea.*
  FROM public.employee_attendance ea
  WHERE (p_employee_id IS NULL OR ea.employee_id = p_employee_id)
    AND (p_from_date IS NULL OR ea.attendance_date >= p_from_date)
    AND (p_to_date IS NULL OR ea.attendance_date <= p_to_date)
    AND (v_status IS NULL OR ea.status = v_status)
  ORDER BY ea.attendance_date DESC, ea.created_at DESC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_import_employee_attendance_rows(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_email text;
  v_employee_id uuid;
  v_date date;
  v_status text;
  v_notes text;
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_check_in_raw text;
  v_check_out_raw text;
  v_imported int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_err text;
BEGIN
  PERFORM public.assert_may_manage_staff();
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    BEGIN
      v_employee_id := NULL;
      IF (v_item ? 'employee_id') AND NULLIF(trim(v_item->>'employee_id'), '') IS NOT NULL THEN
        v_employee_id := (v_item->>'employee_id')::uuid;
      END IF;
      IF v_employee_id IS NULL THEN
        v_email := lower(trim(COALESCE(v_item->>'employee_email', v_item->>'email', '')));
        IF v_email = '' THEN
          RAISE EXCEPTION 'employee_email or employee_id required';
        END IF;
        SELECT s.id INTO v_employee_id FROM public.admin_staff s WHERE lower(s.email) = v_email LIMIT 1;
        IF v_employee_id IS NULL THEN
          RAISE EXCEPTION 'No staff with email %', v_email;
        END IF;
      END IF;

      v_date := (v_item->>'attendance_date')::date;
      IF v_date IS NULL THEN
        RAISE EXCEPTION 'attendance_date required (YYYY-MM-DD)';
      END IF;

      v_status := public._normalize_employee_attendance_status(v_item->>'status');
      v_notes := NULLIF(trim(COALESCE(v_item->>'notes', '')), '');

      v_check_in := NULL;
      v_check_out := NULL;
      v_check_in_raw := NULLIF(trim(COALESCE(v_item->>'check_in', v_item->>'check_in_at', '')), '');
      v_check_out_raw := NULLIF(trim(COALESCE(v_item->>'check_out', v_item->>'check_out_at', '')), '');
      IF v_check_in_raw IS NOT NULL THEN
        IF v_check_in_raw ~ '^\d{1,2}:\d{2}' THEN
          v_check_in := (v_date::text || 'T' || v_check_in_raw)::timestamptz;
        ELSE
          v_check_in := v_check_in_raw::timestamptz;
        END IF;
      END IF;
      IF v_check_out_raw IS NOT NULL THEN
        IF v_check_out_raw ~ '^\d{1,2}:\d{2}' THEN
          v_check_out := (v_date::text || 'T' || v_check_out_raw)::timestamptz;
        ELSE
          v_check_out := v_check_out_raw::timestamptz;
        END IF;
      END IF;

      PERFORM public.admin_upsert_employee_attendance(
        v_employee_id,
        v_date,
        v_status,
        v_notes,
        v_check_in,
        v_check_out
      );
      v_imported := v_imported + 1;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
      v_err := SQLERRM;
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object(
          'row', v_item,
          'error', v_err
        )
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'imported', v_imported,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assert_may_manage_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_staff_blocked(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_upsert_employee_attendance(uuid, date, text, text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_employee_attendance(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_employee_attendance(uuid, date, date, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_import_employee_attendance_rows(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_set_staff_blocked(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_employee_attendance(uuid, date, text, text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_employee_attendance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_employee_attendance(uuid, date, date, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_employee_attendance_rows(jsonb) TO authenticated;
