-- Staff self check-in/out with geo + face score validation (IST windows: 10:00 check-in, 18:00 check-out).

CREATE TABLE IF NOT EXISTS public.staff_attendance_office (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_meters integer NOT NULL DEFAULT 200,
  label text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.staff_attendance_office (id, latitude, longitude, radius_meters, label)
VALUES (1, 25.6093, 85.1376, 200, 'Apna Intern Office')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.employee_attendance
  ADD COLUMN IF NOT EXISTS check_in_latitude double precision,
  ADD COLUMN IF NOT EXISTS check_in_longitude double precision,
  ADD COLUMN IF NOT EXISTS check_out_latitude double precision,
  ADD COLUMN IF NOT EXISTS check_out_longitude double precision,
  ADD COLUMN IF NOT EXISTS check_in_face_score numeric,
  ADD COLUMN IF NOT EXISTS check_out_face_score numeric,
  ADD COLUMN IF NOT EXISTS check_in_method text,
  ADD COLUMN IF NOT EXISTS check_out_method text;

ALTER TABLE public.admin_staff
  ADD COLUMN IF NOT EXISTS face_descriptor jsonb;

CREATE OR REPLACE FUNCTION public._haversine_meters(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371000.0 * 2 * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public._ist_minutes_now()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT (
    EXTRACT(hour FROM timezone('Asia/Kolkata', now()))::integer * 60
    + EXTRACT(minute FROM timezone('Asia/Kolkata', now()))::integer
  );
$$;

CREATE OR REPLACE FUNCTION public._staff_attendance_office_config()
RETURNS TABLE (
  latitude double precision,
  longitude double precision,
  radius_meters integer,
  label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.latitude, o.longitude, o.radius_meters, o.label
  FROM public.staff_attendance_office o
  WHERE o.id = 1
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.staff_self_attendance_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (timezone('Asia/Kolkata', now()))::date;
  v_row public.employee_attendance%ROWTYPE;
  v_minutes integer := public._ist_minutes_now();
  v_check_in_start constant integer := 600;  -- 10:00 IST
  v_check_out_start constant integer := 1080; -- 18:00 IST
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(v_uid, 'staff'::public.app_role) THEN
    RAISE EXCEPTION 'Staff role required' USING ERRCODE = '42501';
  END IF;

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
      v_row.check_in_at IS NULL
      AND v_minutes >= v_check_in_start
      AND v_minutes < v_check_out_start,
    'can_check_out',
      v_row.check_in_at IS NOT NULL
      AND v_row.check_out_at IS NULL
      AND v_minutes >= v_check_out_start,
    'check_in_opens_at', '10:00',
    'check_out_opens_at', '18:00',
    'office', (
      SELECT jsonb_build_object(
        'latitude', c.latitude,
        'longitude', c.longitude,
        'radius_meters', c.radius_meters,
        'label', c.label
      )
      FROM public._staff_attendance_office_config() c
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_self_check_in(
  p_latitude double precision,
  p_longitude double precision,
  p_face_score numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (timezone('Asia/Kolkata', now()))::date;
  v_minutes integer := public._ist_minutes_now();
  v_office record;
  v_distance double precision;
  v_profile_image text;
  v_check_in_start constant integer := 600;
  v_check_out_start constant integer := 1080;
  v_min_face_score constant numeric := 0.55;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(v_uid, 'staff'::public.app_role) THEN
    RAISE EXCEPTION 'Staff role required' USING ERRCODE = '42501';
  END IF;

  IF v_minutes < v_check_in_start OR v_minutes >= v_check_out_start THEN
    RAISE EXCEPTION 'Check-in is only available from 10:00 AM to 6:00 PM IST';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.employee_attendance ea
    WHERE ea.employee_id = v_uid
      AND ea.attendance_date = v_today
      AND ea.check_in_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Already checked in for today';
  END IF;

  SELECT profile_image_url INTO v_profile_image
  FROM public.admin_staff
  WHERE id = v_uid OR user_id = v_uid
  LIMIT 1;

  IF v_profile_image IS NULL OR trim(v_profile_image) = '' THEN
    RAISE EXCEPTION 'Upload a profile photo before using face attendance';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RAISE EXCEPTION 'Location is required';
  END IF;

  IF p_face_score IS NULL OR p_face_score < v_min_face_score THEN
    RAISE EXCEPTION 'Face verification failed. Align your face with the camera.';
  END IF;

  SELECT * INTO v_office FROM public._staff_attendance_office_config() LIMIT 1;
  IF v_office IS NULL THEN
    RAISE EXCEPTION 'Office location is not configured';
  END IF;

  v_distance := public._haversine_meters(p_latitude, p_longitude, v_office.latitude, v_office.longitude);
  IF v_distance > v_office.radius_meters THEN
    RAISE EXCEPTION '%', format(
      'You are %s m away from office (max %s m)',
      round(v_distance::numeric, 0),
      v_office.radius_meters
    );
  END IF;

  INSERT INTO public.employee_attendance (
    employee_id,
    attendance_date,
    status,
    check_in_at,
    check_in_latitude,
    check_in_longitude,
    check_in_face_score,
    check_in_method,
    marked_by,
    updated_at
  )
  VALUES (
    v_uid,
    v_today,
    'present',
    now(),
    p_latitude,
    p_longitude,
    p_face_score,
    'geo_face',
    v_uid,
    now()
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
      updated_at = now()
    WHERE employee_id = v_uid
      AND attendance_date = v_today
      AND check_in_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Already checked in for today';
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', 'check_in', 'attendance_date', v_today);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_self_check_out(
  p_latitude double precision,
  p_longitude double precision,
  p_face_score numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (timezone('Asia/Kolkata', now()))::date;
  v_minutes integer := public._ist_minutes_now();
  v_office record;
  v_distance double precision;
  v_profile_image text;
  v_check_out_start constant integer := 1080;
  v_min_face_score constant numeric := 0.55;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(v_uid, 'staff'::public.app_role) THEN
    RAISE EXCEPTION 'Staff role required' USING ERRCODE = '42501';
  END IF;

  IF v_minutes < v_check_out_start THEN
    RAISE EXCEPTION 'Check-out opens at 6:00 PM IST';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employee_attendance ea
    WHERE ea.employee_id = v_uid
      AND ea.attendance_date = v_today
      AND ea.check_in_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Check in first before checking out';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.employee_attendance ea
    WHERE ea.employee_id = v_uid
      AND ea.attendance_date = v_today
      AND ea.check_out_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Already checked out for today';
  END IF;

  SELECT profile_image_url INTO v_profile_image
  FROM public.admin_staff
  WHERE id = v_uid OR user_id = v_uid
  LIMIT 1;

  IF v_profile_image IS NULL OR trim(v_profile_image) = '' THEN
    RAISE EXCEPTION 'Upload a profile photo before using face attendance';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RAISE EXCEPTION 'Location is required';
  END IF;

  IF p_face_score IS NULL OR p_face_score < v_min_face_score THEN
    RAISE EXCEPTION 'Face verification failed. Align your face with the camera.';
  END IF;

  SELECT * INTO v_office FROM public._staff_attendance_office_config() LIMIT 1;
  IF v_office IS NULL THEN
    RAISE EXCEPTION 'Office location is not configured';
  END IF;

  v_distance := public._haversine_meters(p_latitude, p_longitude, v_office.latitude, v_office.longitude);
  IF v_distance > v_office.radius_meters THEN
    RAISE EXCEPTION '%', format(
      'You are %s m away from office (max %s m)',
      round(v_distance::numeric, 0),
      v_office.radius_meters
    );
  END IF;

  UPDATE public.employee_attendance
  SET
    check_out_at = now(),
    check_out_latitude = p_latitude,
    check_out_longitude = p_longitude,
    check_out_face_score = p_face_score,
    check_out_method = 'geo_face',
    updated_at = now()
  WHERE employee_id = v_uid
    AND attendance_date = v_today
    AND check_out_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not check out — already checked out or no check-in today';
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', 'check_out', 'attendance_date', v_today);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_self_attendance_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_self_check_in(double precision, double precision, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_self_check_out(double precision, double precision, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_self_attendance_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_self_check_in(double precision, double precision, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_self_check_out(double precision, double precision, numeric) TO authenticated;

GRANT SELECT ON public.staff_attendance_office TO authenticated;
