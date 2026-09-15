-- Shared helpers for staff geo/face self attendance RPCs (script 88+).
-- Idempotent — safe to run before staff_self_attendance_status on RDS.

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

GRANT EXECUTE ON FUNCTION public._haversine_meters(double precision, double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public._ist_minutes_now() TO authenticated;
