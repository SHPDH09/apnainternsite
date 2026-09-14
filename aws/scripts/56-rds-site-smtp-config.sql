-- Server-only SMTP config for Vercel/Lambda mail when env vars are missing.
-- Not exposed via PostgREST (no anon/authenticated grants).

CREATE TABLE IF NOT EXISTS public.site_smtp_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  smtp_host text NOT NULL,
  smtp_port text NOT NULL DEFAULT '587',
  smtp_user text NOT NULL,
  smtp_pass text NOT NULL,
  mail_from_address text NOT NULL DEFAULT 'info@apnaintern.in',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_smtp_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.site_smtp_config FROM PUBLIC;
REVOKE ALL ON public.site_smtp_config FROM anon, authenticated;
