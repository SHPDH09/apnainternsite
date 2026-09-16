-- Advanced automated salary: festivals, paid leave grants, half-day, overtime, approved leaves.

ALTER TABLE public.staff_salary_setup
  ADD COLUMN IF NOT EXISTS paid_leaves_per_month integer NOT NULL DEFAULT 1
    CHECK (paid_leaves_per_month >= 0),
  ADD COLUMN IF NOT EXISTS standard_hours_per_day numeric NOT NULL DEFAULT 8
    CHECK (standard_hours_per_day > 0),
  ADD COLUMN IF NOT EXISTS overtime_multiplier numeric NOT NULL DEFAULT 1.5
    CHECK (overtime_multiplier >= 1);

ALTER TABLE public.staff_salary_slips
  ADD COLUMN IF NOT EXISTS overtime_hours numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS festival_days numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unpaid_leave_days numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS half_day_deduction numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.staff_salary_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  name text NOT NULL,
  is_paid boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_salary_holidays_date
  ON public.staff_salary_holidays (holiday_date);

CREATE TABLE IF NOT EXISTS public.staff_paid_leave_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  salary_month date NOT NULL,
  extra_paid_days numeric NOT NULL DEFAULT 0 CHECK (extra_paid_days >= 0),
  reason text,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, salary_month)
);

ALTER TABLE public.staff_salary_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_paid_leave_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage staff_salary_holidays" ON public.staff_salary_holidays;
CREATE POLICY "Admins manage staff_salary_holidays" ON public.staff_salary_holidays
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Authenticated read staff_salary_holidays" ON public.staff_salary_holidays;
CREATE POLICY "Authenticated read staff_salary_holidays" ON public.staff_salary_holidays
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage staff_paid_leave_grants" ON public.staff_paid_leave_grants;
CREATE POLICY "Admins manage staff_paid_leave_grants" ON public.staff_paid_leave_grants
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Staff read own paid leave grants" ON public.staff_paid_leave_grants;
CREATE POLICY "Staff read own paid leave grants" ON public.staff_paid_leave_grants
FOR SELECT TO authenticated
USING (employee_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_salary_holidays TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_paid_leave_grants TO authenticated;

CREATE OR REPLACE FUNCTION public._staff_salary_worked_hours(
  p_check_in timestamptz,
  p_check_out timestamptz
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_check_in IS NULL OR p_check_out IS NULL THEN 0::numeric
    WHEN p_check_out <= p_check_in THEN 0::numeric
    ELSE round((EXTRACT(EPOCH FROM (p_check_out - p_check_in)) / 3600.0)::numeric, 2)
  END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_staff_salary_holidays(p_salary_month date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date;
  v_end date;
BEGIN
  PERFORM public._admin_assert_salary_access();

  IF p_salary_month IS NULL THEN
    RETURN coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.holiday_date)
      FROM public.staff_salary_holidays h), '[]'::jsonb);
  END IF;

  v_start := date_trunc('month', p_salary_month)::date;
  v_end := (date_trunc('month', p_salary_month) + interval '1 month - 1 day')::date;

  RETURN coalesce(
    (SELECT jsonb_agg(to_jsonb(h) ORDER BY h.holiday_date)
     FROM public.staff_salary_holidays h
     WHERE h.holiday_date >= v_start AND h.holiday_date <= v_end),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_staff_salary_holiday(
  p_holiday_date date,
  p_name text,
  p_is_paid boolean DEFAULT true,
  p_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.staff_salary_holidays%ROWTYPE;
BEGIN
  PERFORM public._admin_assert_salary_access();

  IF p_holiday_date IS NULL OR p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Holiday date and name are required';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.staff_salary_holidays (holiday_date, name, is_paid, created_by)
    VALUES (p_holiday_date, trim(p_name), coalesce(p_is_paid, true), auth.uid())
    ON CONFLICT (holiday_date) DO UPDATE
    SET name = EXCLUDED.name, is_paid = EXCLUDED.is_paid
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.staff_salary_holidays
    SET holiday_date = p_holiday_date,
        name = trim(p_name),
        is_paid = coalesce(p_is_paid, true)
    WHERE id = p_id
    RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'Holiday not found'; END IF;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_staff_salary_holiday(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._admin_assert_salary_access();
  DELETE FROM public.staff_salary_holidays WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Holiday not found'; END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_staff_paid_leave_grant(
  p_employee_id uuid,
  p_salary_month date,
  p_extra_paid_days numeric,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_salary_month)::date;
  v_row public.staff_paid_leave_grants%ROWTYPE;
BEGIN
  PERFORM public._admin_assert_salary_access();

  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee is required';
  END IF;

  INSERT INTO public.staff_paid_leave_grants (
    employee_id, salary_month, extra_paid_days, reason, granted_by, updated_at
  )
  VALUES (
    p_employee_id,
    v_month,
    greatest(coalesce(p_extra_paid_days, 0), 0),
    nullif(trim(coalesce(p_reason, '')), ''),
    auth.uid(),
    now()
  )
  ON CONFLICT (employee_id, salary_month) DO UPDATE
  SET extra_paid_days = EXCLUDED.extra_paid_days,
      reason = EXCLUDED.reason,
      granted_by = auth.uid(),
      updated_at = now()
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_staff_paid_leave_grants(p_salary_month date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_salary_month)::date;
BEGIN
  PERFORM public._admin_assert_salary_access();
  RETURN coalesce(
    (SELECT jsonb_agg(to_jsonb(g) ORDER BY g.created_at DESC)
     FROM public.staff_paid_leave_grants g
     WHERE g.salary_month = v_month),
    '[]'::jsonb
  );
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
  v_leave_paid numeric := 0;
  v_leave_unpaid numeric := 0;
  v_half numeric := 0;
  v_holiday_att numeric := 0;
  v_festival numeric := 0;
  v_festival_paid numeric := 0;
  v_overtime_hours numeric := 0;
  v_overtime_amount numeric := 0;
  v_gross numeric;
  v_fixed_deductions numeric;
  v_per_day numeric;
  v_hourly numeric;
  v_std_hours numeric;
  v_ot_mult numeric;
  v_paid_quota numeric;
  v_extra_grant numeric := 0;
  v_paid_pool numeric;
  v_paid_used numeric := 0;
  v_half_deduction numeric := 0;
  v_absent_deduction numeric := 0;
  v_unpaid_leave_deduction numeric := 0;
  v_attendance_deduction numeric;
  v_net numeric;
  v_breakdown jsonb;
  v_slip_id uuid;
  v_leave_req record;
  v_d date;
  v_days_in_range numeric;
  v_has_att boolean;
  v_is_festival boolean;
  v_leave_needs_paid numeric;
  v_leave_overflow numeric;
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
      AND ss.status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Salary already paid for this month — cannot regenerate';
  END IF;

  v_std_hours := greatest(coalesce(v_setup.standard_hours_per_day, 8), 1);
  v_ot_mult := greatest(coalesce(v_setup.overtime_multiplier, 1.5), 1);

  -- Attendance aggregates
  SELECT
    coalesce(sum(CASE WHEN ea.status IN ('present', 'overtime') THEN 1 ELSE 0 END), 0),
    coalesce(sum(CASE WHEN ea.status = 'absent' THEN 1 ELSE 0 END), 0),
    coalesce(sum(CASE WHEN ea.status = 'leave' THEN 1 ELSE 0 END), 0),
    coalesce(sum(CASE WHEN ea.status = 'half_day' THEN 1 ELSE 0 END), 0),
    coalesce(sum(CASE WHEN ea.status = 'holiday' THEN 1 ELSE 0 END), 0),
    0::numeric
  INTO v_present, v_absent, v_leave_paid, v_half, v_holiday_att, v_overtime_hours
  FROM public.employee_attendance ea
  WHERE ea.employee_id = p_employee_id
    AND ea.attendance_date >= v_month
    AND ea.attendance_date <= v_month_end;

  -- Recompute overtime hours correctly (second pass for OT only)
  SELECT coalesce(sum(
    GREATEST(
      0,
      CASE
        WHEN ea.status = 'overtime' THEN v_std_hours
        ELSE public._staff_salary_worked_hours(ea.check_in_at, ea.check_out_at)
      END - v_std_hours
    )
  ), 0)
  INTO v_overtime_hours
  FROM public.employee_attendance ea
  WHERE ea.employee_id = p_employee_id
    AND ea.attendance_date >= v_month
    AND ea.attendance_date <= v_month_end
    AND ea.status IN ('present', 'overtime', 'half_day');

  -- Paid festival / company holidays (not already marked in attendance)
  SELECT coalesce(count(*), 0),
         coalesce(count(*) FILTER (WHERE h.is_paid IS TRUE), 0)
  INTO v_festival, v_festival_paid
  FROM public.staff_salary_holidays h
  WHERE h.holiday_date >= v_month AND h.holiday_date <= v_month_end
    AND NOT EXISTS (
      SELECT 1 FROM public.employee_attendance ea
      WHERE ea.employee_id = p_employee_id
        AND ea.attendance_date = h.holiday_date
    );

  -- Extra paid leave grant for this employee + month
  SELECT coalesce(g.extra_paid_days, 0) INTO v_extra_grant
  FROM public.staff_paid_leave_grants g
  WHERE g.employee_id = p_employee_id AND g.salary_month = v_month;

  v_paid_quota := coalesce(v_setup.paid_leaves_per_month, 0) + coalesce(v_extra_grant, 0);
  v_paid_pool := v_paid_quota;

  -- Approved leave requests: fill days without attendance rows
  FOR v_leave_req IN
    SELECT lr.leave_type, lr.from_date, lr.to_date
    FROM public.staff_leave_requests lr
    WHERE lr.staff_id = p_employee_id
      AND lr.status = 'approved'
      AND lr.to_date >= v_month
      AND lr.from_date <= v_month_end
  LOOP
    v_d := greatest(v_leave_req.from_date, v_month);
    WHILE v_d <= least(v_leave_req.to_date, v_month_end) LOOP
      SELECT EXISTS (
        SELECT 1 FROM public.employee_attendance ea
        WHERE ea.employee_id = p_employee_id AND ea.attendance_date = v_d
      ) INTO v_has_att;

      IF NOT v_has_att THEN
        SELECT EXISTS (
          SELECT 1 FROM public.staff_salary_holidays h
          WHERE h.holiday_date = v_d AND h.is_paid IS TRUE
        ) INTO v_is_festival;

        IF v_is_festival THEN
          NULL; -- festival already counted
        ELSIF v_leave_req.leave_type = 'unpaid' THEN
          v_leave_unpaid := v_leave_unpaid + 1;
        ELSE
          v_leave_paid := v_leave_paid + 1;
        END IF;
      END IF;
      v_d := v_d + 1;
    END LOOP;
  END LOOP;

  -- Split attendance 'leave' into paid vs unpaid using pool
  v_leave_needs_paid := v_leave_paid;
  v_paid_used := least(v_leave_needs_paid, v_paid_pool);
  v_leave_overflow := greatest(0, v_leave_needs_paid - v_paid_used);
  v_leave_unpaid := v_leave_unpaid + v_leave_overflow;
  v_leave_paid := v_paid_used;

  v_gross :=
    coalesce(v_setup.basic_salary, 0)
    + coalesce(v_setup.hra, 0)
    + coalesce(v_setup.special_allowance, 0)
    + coalesce(v_setup.other_allowances, 0);

  v_fixed_deductions :=
    coalesce(v_setup.pf_deduction, 0)
    + coalesce(v_setup.tax_deduction, 0)
    + coalesce(v_setup.other_deductions, 0);

  -- Per-day / hourly rates always use calendar-month divisor (30), not working_days_per_month.
  -- working_days_per_month (default 26) is kept for attendance / leave policy reference only.
  v_per_day := CASE WHEN v_gross > 0 THEN v_gross / 30 ELSE 0 END;

  v_hourly := CASE
    WHEN v_gross > 0 THEN v_gross / (30 * v_std_hours)
    ELSE 0
  END;

  -- Deductions: absent (full), unpaid leave (full), half-day (50% each)
  v_absent_deduction := round((v_absent * v_per_day)::numeric, 2);
  v_unpaid_leave_deduction := round((v_leave_unpaid * v_per_day)::numeric, 2);
  v_half_deduction := round((v_half * v_per_day * 0.5)::numeric, 2);

  v_attendance_deduction := v_absent_deduction + v_unpaid_leave_deduction + v_half_deduction;

  v_overtime_amount := round((v_overtime_hours * v_hourly * v_ot_mult)::numeric, 2);

  v_net := greatest(
    0,
    round((v_gross - v_fixed_deductions - v_attendance_deduction + v_overtime_amount)::numeric, 2)
  );

  v_breakdown := jsonb_build_object(
    'basic_salary', v_setup.basic_salary,
    'hra', v_setup.hra,
    'special_allowance', v_setup.special_allowance,
    'other_allowances', v_setup.other_allowances,
    'pf_deduction', v_setup.pf_deduction,
    'tax_deduction', v_setup.tax_deduction,
    'other_deductions', v_setup.other_deductions,
    'working_days_per_month', v_setup.working_days_per_month,
    'salary_divisor_days', 30,
    'paid_leaves_per_month', v_setup.paid_leaves_per_month,
    'extra_paid_leave_grant', v_extra_grant,
    'paid_leave_quota_total', v_paid_quota,
    'standard_hours_per_day', v_std_hours,
    'overtime_multiplier', v_ot_mult,
    'per_day_rate', round(v_per_day::numeric, 2),
    'hourly_rate', round(v_hourly::numeric, 2),
    'festival_holidays_count', v_festival_paid + v_holiday_att,
    'festival_from_calendar', v_festival_paid,
    'holiday_attendance_marked', v_holiday_att,
    'paid_leave_days_used', v_leave_paid,
    'unpaid_leave_days', v_leave_unpaid,
    'half_days', v_half,
    'absent_deduction', v_absent_deduction,
    'unpaid_leave_deduction', v_unpaid_leave_deduction,
    'half_day_deduction', v_half_deduction,
    'overtime_hours', round(v_overtime_hours::numeric, 2),
    'overtime_amount', v_overtime_amount,
    'payment_mode', v_setup.payment_mode
  );

  INSERT INTO public.staff_salary_slips (
    employee_id, salary_month,
    present_days, absent_days, leave_days, half_days,
    gross_amount, attendance_deduction, total_deductions, net_amount,
    overtime_hours, overtime_amount, festival_days, unpaid_leave_days, half_day_deduction,
    status, breakdown, generated_by, updated_at
  )
  VALUES (
    p_employee_id, v_month,
    round((v_present + v_half * 0.5 + v_festival_paid + v_holiday_att + v_leave_paid)::numeric, 2),
    v_absent,
    v_leave_paid,
    v_half,
    round(v_gross::numeric, 2),
    v_attendance_deduction,
    round((v_fixed_deductions + v_attendance_deduction)::numeric, 2),
    v_net,
    round(v_overtime_hours::numeric, 2),
    v_overtime_amount,
    v_festival_paid + v_holiday_att,
    v_leave_unpaid,
    v_half_deduction,
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
    overtime_hours = EXCLUDED.overtime_hours,
    overtime_amount = EXCLUDED.overtime_amount,
    festival_days = EXCLUDED.festival_days,
    unpaid_leave_days = EXCLUDED.unpaid_leave_days,
    half_day_deduction = EXCLUDED.half_day_deduction,
    status = CASE WHEN public.staff_salary_slips.status = 'paid' THEN 'paid' ELSE 'generated' END,
    breakdown = EXCLUDED.breakdown,
    generated_at = now(),
    generated_by = auth.uid(),
    updated_at = now()
  WHERE public.staff_salary_slips.status <> 'paid'
  RETURNING id INTO v_slip_id;

  RETURN jsonb_build_object(
    'ok', true,
    'slip_id', v_slip_id,
    'employee_id', p_employee_id,
    'salary_month', v_month,
    'net_amount', v_net,
    'overtime_amount', v_overtime_amount,
    'attendance_deduction', v_attendance_deduction,
    'status', 'generated',
    'breakdown', v_breakdown
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_staff_salary_holidays(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_staff_salary_holiday(date, text, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_staff_salary_holiday(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_staff_paid_leave_grant(uuid, date, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_staff_paid_leave_grants(date) TO authenticated;
