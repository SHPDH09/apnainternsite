-- Admin-managed contact details and WhatsApp group/channel links for the public site.

CREATE TABLE IF NOT EXISTS public.site_contact_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_type text NOT NULL CHECK (contact_type IN ('phone', 'email', 'address', 'social', 'other')),
  label text NOT NULL DEFAULT '',
  value text NOT NULL DEFAULT '',
  href text,
  icon text,
  display_contexts jsonb NOT NULL DEFAULT '["footer"]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_contact_details_active_sort
  ON public.site_contact_details (is_active, sort_order ASC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.site_whatsapp_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  link_type text NOT NULL DEFAULT 'channel' CHECK (link_type IN ('group', 'channel', 'number')),
  url text NOT NULL DEFAULT '',
  description text,
  display_contexts jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_whatsapp_links_active_sort
  ON public.site_whatsapp_links (is_active, sort_order ASC, created_at DESC);

ALTER TABLE public.site_contact_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_whatsapp_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active site_contact_details" ON public.site_contact_details;
CREATE POLICY "Public read active site_contact_details"
  ON public.site_contact_details
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage site_contact_details" ON public.site_contact_details;
CREATE POLICY "Admins manage site_contact_details"
  ON public.site_contact_details
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Public read active site_whatsapp_links" ON public.site_whatsapp_links;
CREATE POLICY "Public read active site_whatsapp_links"
  ON public.site_whatsapp_links
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage site_whatsapp_links" ON public.site_whatsapp_links;
CREATE POLICY "Admins manage site_whatsapp_links"
  ON public.site_whatsapp_links
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

GRANT SELECT ON public.site_contact_details TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_contact_details TO authenticated;
GRANT SELECT ON public.site_whatsapp_links TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_whatsapp_links TO authenticated;

-- Seed footer contact details (matches previous hardcoded footer).
INSERT INTO public.site_contact_details (contact_type, label, value, href, display_contexts, is_active, sort_order)
SELECT * FROM (VALUES
  (
    'address'::text,
    'Office Address'::text,
    'Arfabad Colony, East Nahar Road, Bajrangpuri, Patna - 800007, Bihar'::text,
    NULL::text,
    '["footer"]'::jsonb,
    true,
    0
  ),
  (
    'phone'::text,
    'Phone'::text,
    '+91 70509 36593'::text,
    'tel:+917050936593'::text,
    '["footer"]'::jsonb,
    true,
    1
  ),
  (
    'email'::text,
    'Contact'::text,
    'contact@ezyintern.in'::text,
    'mailto:contact@ezyintern.in'::text,
    '["footer"]'::jsonb,
    true,
    2
  ),
  (
    'email'::text,
    'Support'::text,
    'support@ezyintern.in'::text,
    'mailto:support@ezyintern.in'::text,
    '["footer"]'::jsonb,
    true,
    3
  ),
  (
    'social'::text,
    'YouTube'::text,
    'YouTube'::text,
    'https://www.youtube.com/@Ezyintern_Internship'::text,
    '["footer"]'::jsonb,
    true,
    10
  ),
  (
    'social'::text,
    'LinkedIn'::text,
    'LinkedIn'::text,
    'https://www.linkedin.com/company/ezyintern1/'::text,
    '["footer"]'::jsonb,
    true,
    11
  )
) AS seed(contact_type, label, value, href, display_contexts, is_active, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.site_contact_details LIMIT 1);

-- Seed WhatsApp channel (disabled by default — admin can enable when ready).
INSERT INTO public.site_whatsapp_links (title, link_type, url, description, display_contexts, is_active, sort_order)
SELECT
  'Registration updates channel',
  'channel',
  'https://whatsapp.com/channel/0029VbC9lvi3bbV8TS7TbB00',
  'Updates, deadlines & certificate info',
  '["registration"]'::jsonb,
  false,
  0
WHERE NOT EXISTS (SELECT 1 FROM public.site_whatsapp_links LIMIT 1);
