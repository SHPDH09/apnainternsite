-- Half-day leave: staff apply; admin sets approved check-in window (IST).

ALTER TABLE public.staff_leave_requests
  ADD COLUMN IF NOT EXISTS half_day_check_in_from time without time zone,
  ADD COLUMN IF NOT EXISTS half_day_check_in_until time without time zone;

ALTER TABLE public.staff_leave_requests
  DROP CONSTRAINT IF EXISTS staff_leave_requests_leave_type_check;

ALTER TABLE public.staff_leave_requests
  ADD CONSTRAINT staff_leave_requests_leave_type_check
  CHECK (leave_type IN ('casual', 'sick', 'earned', 'unpaid', 'other', 'half_day'));
