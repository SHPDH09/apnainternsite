-- Fix staff_update_profile_image when admin_staff.id differs from auth.users id (user_id column).

CREATE OR REPLACE FUNCTION public.staff_update_profile_image(p_profile_image_url text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_staff_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT s.id INTO v_staff_id
  FROM public.admin_staff s
  WHERE s.id = v_uid OR s.user_id = v_uid
  ORDER BY CASE WHEN s.user_id = v_uid THEN 0 WHEN s.id = v_uid THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Staff profile not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.admin_staff
  SET
    profile_image_url = NULLIF(trim(COALESCE(p_profile_image_url, '')), ''),
    updated_at = now()
  WHERE id = v_staff_id;

  RETURN json_build_object('ok', true, 'profile_image_url', p_profile_image_url);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_update_profile_image(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_update_profile_image(text) TO authenticated;
