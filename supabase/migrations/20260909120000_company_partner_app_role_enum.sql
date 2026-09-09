-- Must run in its own migration transaction (Postgres 55P04).

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'company_partner';
