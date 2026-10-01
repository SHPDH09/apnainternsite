-- Resolve admin_staff.id vs auth.users.id for salary setup, slips, and staff self-view.

CREATE OR REPLACE FUNCTION public._staff_salary_auth_user_id(p_ref uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT s.user_id FROM public.admin_staff s WHERE s.id = p_ref AND s.user_id IS NOT NULL LIMIT 1),
    (SELECT s.user_id FROM public.admin_staff s WHERE s.user_id = p_ref LIMIT 1),
    p_ref
  );
$$;

CREATE OR REPLACE FUNCTION public._staff_salary_row_ids(p_ref uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    array_agg(DISTINCT x),
    ARRAY[]::uuid[]
  )
  FROM (
    SELECT p_ref AS x
    UNION
    SELECT public._staff_salary_auth_user_id(p_ref)
    UNION
    SELECT s.id FROM public.admin_staff s WHERE s.id = p_ref OR s.user_id = p_ref
    UNION
    SELECT s.user_id FROM public.admin_staff s WHERE (s.id = p_ref OR s.user_id = p_ref) AND s.user_id IS NOT NULL
  ) t
  WHERE x IS NOT NULL;
$$;

DROP POLICY IF EXISTS "Staff read own salary slips" ON public.staff_salary_slips;
CREATE POLICY "Staff read own salary slips" ON public.staff_salary_slips
FOR SELECT TO authenticated
USING (
  employee_id = auth.uid()
  OR employee_id = ANY(public._staff_salary_row_ids(auth.uid()))
);

CREATE OR REPLACE FUNCTION public.staff_list_my_paid_salary_slips()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(auth.uid(), 'staff'::public.app_role) THEN
    RAISE EXCEPTION 'Staff role required' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(to_jsonb(ss) ORDER BY ss.salary_month DESC, ss.paid_at DESC NULLS LAST)
      FROM public.staff_salary_slips ss
      WHERE ss.status = 'paid'
        AND ss.employee_id = ANY(public._staff_salary_row_ids(auth.uid()))
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list_my_paid_salary_slips() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_my_paid_salary_slips() TO authenticated;
