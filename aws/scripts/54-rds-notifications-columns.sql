-- Add missing notification columns on RDS (partial fresh-schema installs).
-- Safe to re-run.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS target_universities text[],
  ADD COLUMN IF NOT EXISTS target_colleges text[],
  ADD COLUMN IF NOT EXISTS target_domains text[],
  ADD COLUMN IF NOT EXISTS recipient_count integer,
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.notifications SET status = 'published' WHERE status IS NULL;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_target_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_target_type_check
  CHECK (target_type IN ('all', 'specific', 'filtered'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_status_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_status_check
  CHECK (status IN ('draft', 'published'));
