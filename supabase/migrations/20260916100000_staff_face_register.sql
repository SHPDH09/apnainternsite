-- One-time staff face registration: stores face_descriptor for attendance matching.
-- Profile photo is set on registration; later profile photo changes do not affect face_descriptor.

ALTER TABLE public.admin_staff
  ADD COLUMN IF NOT EXISTS face_descriptor jsonb,
  ADD COLUMN IF NOT EXISTS face_registered_at timestamptz;

CREATE OR REPLACE FUNCTION public._staff_row_for_attendance(p_employee_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.admin_staff s
  WHERE s.id = p_employee_id
     OR s.user_id = p_employee_id
  ORDER BY CASE WHEN s.id = p_employee_id THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.staff_register_face(
  p_face_descriptor jsonb,
  p_photo_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._staff_attendance_employee_id();
  v_staff_id uuid;
  v_existing jsonb;
  v_photo text := nullif(trim(coalesce(p_photo_url, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(auth.uid(), 'staff'::public.app_role) THEN
    RAISE EXCEPTION 'Staff role required' USING ERRCODE = '42501';
  END IF;

  IF p_face_descriptor IS NULL OR jsonb_typeof(p_face_descriptor) <> 'array' OR jsonb_array_length(p_face_descriptor) < 64 THEN
    RAISE EXCEPTION 'Invalid face data. Look at the camera and try again.';
  END IF;

  IF v_photo IS NULL THEN
    RAISE EXCEPTION 'Profile photo is required for face registration';
  END IF;

  v_staff_id := public._staff_row_for_attendance(v_uid);
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Staff profile not found';
  END IF;

  SELECT s.face_descriptor INTO v_existing
  FROM public.admin_staff s
  WHERE s.id = v_staff_id
  LIMIT 1;

  IF v_existing IS NOT NULL AND jsonb_typeof(v_existing) = 'array' AND jsonb_array_length(v_existing) >= 64 THEN
    RAISE EXCEPTION 'Face is already registered. Contact admin to reset if needed.';
  END IF;

  UPDATE public.admin_staff
  SET
    face_descriptor = p_face_descriptor,
    face_registered_at = now(),
    profile_image_url = v_photo,
    updated_at = now()
  WHERE id = v_staff_id;

  RETURN jsonb_build_object(
    'ok', true,
    'face_registered', true,
    'profile_image_url', v_photo,
    'face_registered_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_self_attendance_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._staff_attendance_employee_id();
  v_today date := (timezone('Asia/Kolkata', now()))::date;
  v_row public.employee_attendance%ROWTYPE;
  v_minutes integer := public._ist_minutes_now();
  v_office record;
  v_face_descriptor jsonb;
  v_check_in_start constant integer := 600;
  v_check_out_start constant integer := 1080;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(auth.uid(), 'staff'::public.app_role) THEN
    RAISE EXCEPTION 'Staff role required' USING ERRCODE = '42501';
  END IF;

  SELECT s.face_descriptor INTO v_face_descriptor
  FROM public.admin_staff s
  WHERE s.id = v_uid OR s.user_id = v_uid OR s.user_id = auth.uid() OR s.id = auth.uid()
  ORDER BY CASE WHEN s.id = v_uid THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT * INTO v_office FROM public._staff_office_for_employee(v_uid) LIMIT 1;

  SELECT * INTO v_row
  FROM public.employee_attendance ea
  WHERE ea.employee_id = v_uid AND ea.attendance_date = v_today
  LIMIT 1;

  RETURN jsonb_build_object(
    'attendance_date', v_today,
    'ist_minutes', v_minutes,
    'check_in_at', v_row.check_in_at,
    'check_out_at', v_row.check_out_at,
    'has_check_in', v_row.check_in_at IS NOT NULL,
    'has_check_out', v_row.check_out_at IS NOT NULL,
    'can_check_in',
      v_office.office_id IS NOT NULL
      AND v_face_descriptor IS NOT NULL
      AND jsonb_typeof(v_face_descriptor) = 'array'
      AND jsonb_array_length(v_face_descriptor) >= 64
      AND v_row.check_in_at IS NULL
      AND v_minutes >= v_check_in_start
      AND v_minutes < v_check_out_start,
    'can_check_out',
      v_office.office_id IS NOT NULL
      AND v_face_descriptor IS NOT NULL
      AND jsonb_typeof(v_face_descriptor) = 'array'
      AND jsonb_array_length(v_face_descriptor) >= 64
      AND v_row.check_in_at IS NOT NULL
      AND v_row.check_out_at IS NULL
      AND v_minutes >= v_check_out_start,
    'check_in_opens_at', '10:00',
    'check_out_opens_at', '18:00',
    'office_assigned', v_office.office_id IS NOT NULL,
    'face_registered',
      v_face_descriptor IS NOT NULL
      AND jsonb_typeof(v_face_descriptor) = 'array'
      AND jsonb_array_length(v_face_descriptor) >= 64,
    'face_descriptor', v_face_descriptor,
    'office', CASE WHEN v_office.office_id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_office.office_id,
      'name', v_office.name,
      'address', v_office.address,
      'latitude', v_office.latitude,
      'longitude', v_office.longitude,
      'radius_meters', v_office.radius_meters,
      'max_gps_accuracy_m', v_office.max_gps_accuracy_m,
      'require_face', v_office.require_face,
      'require_geo', v_office.require_geo
    ) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_self_check_in(
  p_latitude double precision,
  p_longitude double precision,
  p_face_score numeric,
  p_gps_accuracy_m numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._staff_attendance_employee_id();
  v_today date := (timezone('Asia/Kolkata', now()))::date;
  v_minutes integer := public._ist_minutes_now();
  v_office record;
  v_distance double precision;
  v_face_descriptor jsonb;
  v_flags jsonb;
  v_check_in_start constant integer := 600;
  v_check_out_start constant integer := 1080;
  v_min_face_score constant numeric := 0.55;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(auth.uid(), 'staff'::public.app_role) THEN
    RAISE EXCEPTION 'Staff role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_office FROM public._staff_office_for_employee(v_uid) LIMIT 1;
  IF v_office.office_id IS NULL THEN
    RAISE EXCEPTION 'No office location assigned. Contact admin.';
  END IF;

  IF v_minutes < v_check_in_start OR v_minutes >= v_check_out_start THEN
    RAISE EXCEPTION 'Check-in is only available from 10:00 AM to 6:00 PM IST';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.employee_attendance ea
    WHERE ea.employee_id = v_uid AND ea.attendance_date = v_today AND ea.check_in_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Already checked in for today';
  END IF;

  IF v_office.require_face THEN
    SELECT s.face_descriptor INTO v_face_descriptor
    FROM public.admin_staff s
    WHERE s.id = v_uid OR s.user_id = v_uid OR s.user_id = auth.uid() OR s.id = auth.uid()
    ORDER BY CASE WHEN s.id = v_uid THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_face_descriptor IS NULL
       OR jsonb_typeof(v_face_descriptor) <> 'array'
       OR jsonb_array_length(v_face_descriptor) < 64 THEN
      RAISE EXCEPTION 'Register your face first before marking attendance';
    END IF;

    IF p_face_score IS NULL OR p_face_score < v_min_face_score THEN
      RAISE EXCEPTION 'Face verification failed. Align your face with the camera.';
    END IF;
  END IF;

  IF v_office.require_geo THEN
    IF p_latitude IS NULL OR p_longitude IS NULL THEN
      RAISE EXCEPTION 'Location is required';
    END IF;
    IF v_office.max_gps_accuracy_m IS NOT NULL AND p_gps_accuracy_m IS NOT NULL
       AND p_gps_accuracy_m > v_office.max_gps_accuracy_m THEN
      RAISE EXCEPTION 'GPS signal too weak or unreliable (accuracy % m). Disable mock location and try again.', round(p_gps_accuracy_m::numeric, 0);
    END IF;
    v_distance := public._haversine_meters(p_latitude, p_longitude, v_office.latitude, v_office.longitude);
    IF v_distance > v_office.radius_meters THEN
      RAISE EXCEPTION '%', format(
        'You are %s m from %s (max %s m)',
        round(v_distance::numeric, 0),
        v_office.name,
        v_office.radius_meters
      );
    END IF;
  END IF;

  v_flags := jsonb_build_object(
    'check_in', jsonb_build_object(
      'distance_m', round(coalesce(v_distance, 0)::numeric, 2),
      'gps_accuracy_m', p_gps_accuracy_m,
      'face_score', p_face_score,
      'office_id', v_office.office_id,
      'office_name', v_office.name,
      'verified_at', now()
    )
  );

  INSERT INTO public.employee_attendance (
    employee_id, attendance_date, status, check_in_at,
    check_in_latitude, check_in_longitude, check_in_face_score, check_in_method,
    check_in_distance_m, check_in_gps_accuracy_m, office_id, verification_flags,
    marked_by, updated_at
  )
  VALUES (
    v_uid, v_today, 'present', now(),
    p_latitude, p_longitude, p_face_score, 'geo_face',
    round(coalesce(v_distance, 0)::numeric, 2), p_gps_accuracy_m, v_office.office_id, v_flags,
    auth.uid(), now()
  )
  ON CONFLICT (employee_id, attendance_date) DO NOTHING;

  IF NOT FOUND THEN
    UPDATE public.employee_attendance
    SET
      status = 'present',
      check_in_at = COALESCE(check_in_at, now()),
      check_in_latitude = COALESCE(check_in_latitude, p_latitude),
      check_in_longitude = COALESCE(check_in_longitude, p_longitude),
      check_in_face_score = COALESCE(check_in_face_score, p_face_score),
      check_in_method = COALESCE(check_in_method, 'geo_face'),
      check_in_distance_m = COALESCE(check_in_distance_m, round(coalesce(v_distance, 0)::numeric, 2)),
      check_in_gps_accuracy_m = COALESCE(check_in_gps_accuracy_m, p_gps_accuracy_m),
      office_id = COALESCE(office_id, v_office.office_id),
      verification_flags = verification_flags || v_flags,
      updated_at = now()
    WHERE employee_id = v_uid
      AND attendance_date = v_today
      AND check_in_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Already checked in for today';
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', 'check_in', 'office_id', v_office.office_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_self_check_out(
  p_latitude double precision,
  p_longitude double precision,
  p_face_score numeric,
  p_gps_accuracy_m numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._staff_attendance_employee_id();
  v_today date := (timezone('Asia/Kolkata', now()))::date;
  v_minutes integer := public._ist_minutes_now();
  v_office record;
  v_distance double precision;
  v_face_descriptor jsonb;
  v_flags jsonb;
  v_check_out_start constant integer := 1080;
  v_min_face_score constant numeric := 0.55;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(auth.uid(), 'staff'::public.app_role) THEN
    RAISE EXCEPTION 'Staff role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_office FROM public._staff_office_for_employee(v_uid) LIMIT 1;
  IF v_office.office_id IS NULL THEN
    RAISE EXCEPTION 'No office location assigned. Contact admin.';
  END IF;

  IF v_minutes < v_check_out_start THEN
    RAISE EXCEPTION 'Check-out opens at 6:00 PM IST';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employee_attendance ea
    WHERE ea.employee_id = v_uid AND ea.attendance_date = v_today AND ea.check_in_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Check in first before checking out';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.employee_attendance ea
    WHERE ea.employee_id = v_uid AND ea.attendance_date = v_today AND ea.check_out_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Already checked out for today';
  END IF;

  IF v_office.require_face THEN
    SELECT s.face_descriptor INTO v_face_descriptor
    FROM public.admin_staff s
    WHERE s.id = v_uid OR s.user_id = v_uid OR s.user_id = auth.uid() OR s.id = auth.uid()
    ORDER BY CASE WHEN s.id = v_uid THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_face_descriptor IS NULL
       OR jsonb_typeof(v_face_descriptor) <> 'array'
       OR jsonb_array_length(v_face_descriptor) < 64 THEN
      RAISE EXCEPTION 'Register your face first before marking attendance';
    END IF;

    IF p_face_score IS NULL OR p_face_score < v_min_face_score THEN
      RAISE EXCEPTION 'Face verification failed. Align your face with the camera.';
    END IF;
  END IF;

  IF v_office.require_geo THEN
    IF p_latitude IS NULL OR p_longitude IS NULL THEN
      RAISE EXCEPTION 'Location is required';
    END IF;
    IF v_office.max_gps_accuracy_m IS NOT NULL AND p_gps_accuracy_m IS NOT NULL
       AND p_gps_accuracy_m > v_office.max_gps_accuracy_m THEN
      RAISE EXCEPTION 'GPS signal too weak or unreliable (accuracy % m). Disable mock location and try again.', round(p_gps_accuracy_m::numeric, 0);
    END IF;
    v_distance := public._haversine_meters(p_latitude, p_longitude, v_office.latitude, v_office.longitude);
    IF v_distance > v_office.radius_meters THEN
      RAISE EXCEPTION '%', format(
        'You are %s m from %s (max %s m)',
        round(v_distance::numeric, 0),
        v_office.name,
        v_office.radius_meters
      );
    END IF;
  END IF;

  v_flags := jsonb_build_object(
    'check_out', jsonb_build_object(
      'distance_m', round(coalesce(v_distance, 0)::numeric, 2),
      'gps_accuracy_m', p_gps_accuracy_m,
      'face_score', p_face_score,
      'office_id', v_office.office_id,
      'office_name', v_office.name,
      'verified_at', now()
    )
  );

  UPDATE public.employee_attendance
  SET
    check_out_at = now(),
    check_out_latitude = p_latitude,
    check_out_longitude = p_longitude,
    check_out_face_score = p_face_score,
    check_out_method = 'geo_face',
    check_out_distance_m = round(coalesce(v_distance, 0)::numeric, 2),
    check_out_gps_accuracy_m = p_gps_accuracy_m,
    verification_flags = verification_flags || v_flags,
    updated_at = now()
  WHERE employee_id = v_uid AND attendance_date = v_today AND check_out_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not check out';
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', 'check_out');
END;
$$;

GRANT EXECUTE ON FUNCTION public._staff_row_for_attendance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_register_face(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_self_attendance_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_self_check_in(double precision, double precision, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_self_check_out(double precision, double precision, numeric, numeric) TO authenticated;
