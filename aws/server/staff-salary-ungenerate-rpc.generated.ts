/** Idempotent RPC only — safe to apply when other staff salary functions already exist. */
export const ADMIN_UNGENERATE_STAFF_SALARY_RPC_SQL = `
CREATE OR REPLACE FUNCTION public.admin_ungenerate_staff_salary(p_slip_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.staff_salary_slips%ROWTYPE;
BEGIN
  PERFORM public._admin_assert_salary_access();

  DELETE FROM public.staff_salary_slips
  WHERE id = p_slip_id
    AND status IN ('generated', 'draft', 'paid')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Salary slip not found or cannot be removed';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'slip_id', p_slip_id,
    'employee_id', v_row.employee_id,
    'salary_month', v_row.salary_month
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ungenerate_staff_salary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_ungenerate_staff_salary(uuid) TO authenticated;
`.trim();
