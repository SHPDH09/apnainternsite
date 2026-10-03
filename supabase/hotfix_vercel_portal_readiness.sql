-- Idempotent fixes for Vercel lite REST / payment gate (run on Supabase after apply-all).
ALTER TABLE public.payment_success ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';

ALTER TABLE public.site_contact_details
  ADD COLUMN IF NOT EXISTS display_contexts jsonb NOT NULL DEFAULT '["footer"]'::jsonb;
ALTER TABLE public.site_contact_details
  ADD COLUMN IF NOT EXISTS href text;
ALTER TABLE public.site_contact_details
  ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE public.site_contact_details
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.site_whatsapp_links
  ADD COLUMN IF NOT EXISTS display_contexts jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.site_whatsapp_links
  ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.site_whatsapp_links
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
