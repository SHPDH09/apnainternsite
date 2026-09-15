-- Staff salary: payment setup, monthly generation, and payout status (admin).

CREATE TABLE IF NOT EXISTS public.staff_salary_setup (
  employee_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  basic_salary numeric(12, 2) NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
  hra numeric(12, 2) NOT NULL DEFAULT 0 CHECK (hra >= 0),
  special_allowance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (special_allowance >= 0),
  other_allowances numeric(12, 2) NOT NULL DEFAULT 0 CHECK (other_allowances >= 0),
  pf_deduction numeric(12, 2) NOT NULL DEFAULT 0 CHECK (pf_deduction >= 0),
  tax_deduction numeric(12, 2) NOT NULL DEFAULT 0 CHECK (tax_deduction >= 0),
  other_deductions numeric(12, 2) NOT NULL DEFAULT 0 CHECK (other_deductions >= 0),
  working_days_per_month integer NOT NULL DEFAULT 26 CHECK (working_days_per_month BETWEEN 1 AND 31),
  payment_mode text NOT NULL DEFAULT 'bank_transfer'
    CHECK (payment_mode IN ('bank_transfer', 'upi', 'cash')),
  payment_notes text,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.staff_salary_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  salary_month date NOT NULL,
  present_days numeric(6, 2) NOT NULL DEFAULT 0,
  absent_days numeric(6, 2) NOT NULL DEFAULT 0,
  leave_days numeric(6, 2) NOT NULL DEFAULT 0,
  half_days numeric(6, 2) NOT NULL DEFAULT 0,
  gross_amount numeric(12, 2) NOT NULL DEFAULT 0,
  attendance_deduction numeric(12, 2) NOT NULL DEFAULT 0,
  total_deductions numeric(12, 2) NOT NULL DEFAULT 0,
  net_amount numeric(12, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'generated'
    CHECK (status IN ('draft', 'generated', 'paid', 'cancelled')),
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_reference text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at timestamptz,
  paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, salary_month)
);

CREATE INDEX IF NOT EXISTS idx_staff_salary_slips_month
  ON public.staff_salary_slips (salary_month DESC);
CREATE INDEX IF NOT EXISTS idx_staff_salary_slips_status
  ON public.staff_salary_slips (status);

ALTER TABLE public.staff_salary_setup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_salary_slips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage staff_salary_setup" ON public.staff_salary_setup;
CREATE POLICY "Admins manage staff_salary_setup" ON public.staff_salary_setup
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Staff read own salary slips" ON public.staff_salary_slips;
CREATE POLICY "Staff read own salary slips" ON public.staff_salary_slips
FOR SELECT TO authenticated
USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage staff_salary_slips" ON public.staff_salary_slips;
CREATE POLICY "Admins manage staff_salary_slips" ON public.staff_salary_slips
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_salary_setup TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_salary_slips TO authenticated;

CREATE OR REPLACE FUNCTION public._admin_assert_salary_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_generate_staff_salary(
  p_employee_id uuid,
  p_salary_month date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_salary_month)::date;
  v_month_end date := (date_trunc('month', p_salary_month) + interval '1 month - 1 day')::date;
  v_setup public.staff_salary_setup%ROWTYPE;
  v_present numeric := 0;
  v_absent numeric := 0;
  v_leave numeric := 0;
  v_half numeric := 0;
  v_gross numeric;
  v_fixed_deductions numeric;
  v_per_day numeric;
  v_attendance_deduction numeric;
  v_net numeric;
  v_breakdown jsonb;
  v_slip_id uuid;
BEGIN
  PERFORM public._admin_assert_salary_access();

  IF p_employee_id IS NULL OR v_month IS NULL THEN
    RAISE EXCEPTION 'Employee and salary month are required';
  END IF;

  SELECT * INTO v_setup
  FROM public.staff_salary_setup s
  WHERE s.employee_id = p_employee_id AND s.is_active IS TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment setup missing for this staff member';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.staff_salary_slips ss
    WHERE ss.employee_id = p_employee_id
      AND ss.salary_month = v_month
      AND ss.status IN ('generated', 'paid')
  ) THEN
    RAISE EXCEPTION 'Salary already generated for this month';
  END IF;

  SELECT
    coalesce(sum(CASE WHEN ea.status = 'present' THEN 1 WHEN ea.status = 'half_day' THEN 0.5 ELSE 0 END), 0),
    coalesce(sum(CASE WHEN ea.status = 'absent' THEN 1 ELSE 0 END), 0),
    coalesce(sum(CASE WHEN ea.status = 'leave' THEN 1 ELSE 0 END), 0),
    coalesce(sum(CASE WHEN ea.status = 'half_day' THEN 0.5 ELSE 0 END), 0)
  INTO v_present, v_absent, v_leave, v_half
  FROM public.employee_attendance ea
  WHERE ea.employee_id = p_employee_id
    AND ea.attendance_date >= v_month
    AND ea.attendance_date <= v_month_end;

  v_gross :=
    coalesce(v_setup.basic_salary, 0)
    + coalesce(v_setup.hra, 0)
    + coalesce(v_setup.special_allowance, 0)
    + coalesce(v_setup.other_allowances, 0);

  v_fixed_deductions :=
    coalesce(v_setup.pf_deduction, 0)
    + coalesce(v_setup.tax_deduction, 0)
    + coalesce(v_setup.other_deductions, 0);

  v_per_day := CASE
    WHEN v_setup.working_days_per_month > 0 THEN v_gross / v_setup.working_days_per_month
    ELSE 0
  END;

  v_attendance_deduction := round((v_absent * v_per_day)::numeric, 2);
  v_net := greatest(0, round((v_gross - v_fixed_deductions - v_attendance_deduction)::numeric, 2));

  v_breakdown := jsonb_build_object(
    'basic_salary', v_setup.basic_salary,
    'hra', v_setup.hra,
    'special_allowance', v_setup.special_allowance,
    'other_allowances', v_setup.other_allowances,
    'pf_deduction', v_setup.pf_deduction,
    'tax_deduction', v_setup.tax_deduction,
    'other_deductions', v_setup.other_deductions,
    'working_days_per_month', v_setup.working_days_per_month,
    'per_day_rate', round(v_per_day::numeric, 2),
    'payment_mode', v_setup.payment_mode
  );

  INSERT INTO public.staff_salary_slips (
    employee_id,
    salary_month,
    present_days,
    absent_days,
    leave_days,
    half_days,
    gross_amount,
    attendance_deduction,
    total_deductions,
    net_amount,
    status,
    breakdown,
    generated_by,
    updated_at
  )
  VALUES (
    p_employee_id,
    v_month,
    v_present,
    v_absent,
    v_leave,
    v_half,
    round(v_gross::numeric, 2),
    v_attendance_deduction,
    round((v_fixed_deductions + v_attendance_deduction)::numeric, 2),
    v_net,
    'generated',
    v_breakdown,
    auth.uid(),
    now()
  )
  ON CONFLICT (employee_id, salary_month)
  DO UPDATE SET
    present_days = EXCLUDED.present_days,
    absent_days = EXCLUDED.absent_days,
    leave_days = EXCLUDED.leave_days,
    half_days = EXCLUDED.half_days,
    gross_amount = EXCLUDED.gross_amount,
    attendance_deduction = EXCLUDED.attendance_deduction,
    total_deductions = EXCLUDED.total_deductions,
    net_amount = EXCLUDED.net_amount,
    status = 'generated',
    breakdown = EXCLUDED.breakdown,
    generated_at = now(),
    generated_by = auth.uid(),
    updated_at = now()
  WHERE public.staff_salary_slips.status NOT IN ('paid')
  RETURNING id INTO v_slip_id;

  RETURN jsonb_build_object(
    'ok', true,
    'slip_id', v_slip_id,
    'employee_id', p_employee_id,
    'salary_month', v_month,
    'net_amount', v_net,
    'status', 'generated'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_staff_salary_paid(
  p_slip_id uuid,
  p_payment_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._admin_assert_salary_access();

  UPDATE public.staff_salary_slips
  SET
    status = 'paid',
    payment_reference = nullif(trim(p_payment_reference), ''),
    paid_at = now(),
    paid_by = auth.uid(),
    updated_at = now()
  WHERE id = p_slip_id
    AND status = 'generated';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Salary slip not found or not in generated status';
  END IF;

  RETURN jsonb_build_object('ok', true, 'slip_id', p_slip_id, 'status', 'paid');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_generate_staff_salary(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_mark_staff_salary_paid(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_generate_staff_salary(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_staff_salary_paid(uuid, text) TO authenticated;
