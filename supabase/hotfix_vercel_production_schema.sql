-- Production fixes for apnaintern.in Vercel lite REST (run idempotently on Supabase Postgres).

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS joining_date TEXT,
  ADD COLUMN IF NOT EXISTS completion_date TEXT,
  ADD COLUMN IF NOT EXISTS internship_duration TEXT;

ALTER TABLE public.registration_leads
  ADD COLUMN IF NOT EXISTS cart_stage TEXT;

CREATE TABLE IF NOT EXISTS public.attendance_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_percentage NUMERIC DEFAULT 75,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.attendance_settings (id, min_percentage)
VALUES (1, 75)
ON CONFLICT (id) DO NOTHING;
