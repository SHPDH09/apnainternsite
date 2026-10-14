-- Food + accommodation allowances (see aws/scripts/86-rds-staff-salary-advanced.sql)

ALTER TABLE public.staff_salary_setup
  ADD COLUMN IF NOT EXISTS food_allowance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (food_allowance >= 0),
  ADD COLUMN IF NOT EXISTS accommodation_allowance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (accommodation_allowance >= 0);

UPDATE public.staff_salary_setup
SET
  food_allowance = CASE WHEN food_allowance = 0 THEN COALESCE(special_allowance, 0) ELSE food_allowance END,
  accommodation_allowance = CASE
    WHEN accommodation_allowance = 0 THEN COALESCE(other_allowances, 0)
    ELSE accommodation_allowance
  END
WHERE food_allowance = 0 OR accommodation_allowance = 0;
