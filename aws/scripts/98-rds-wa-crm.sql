-- WA CRM (WhatsApp Business Platform CRM) — official Cloud API only.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.wa_crm_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  role_id uuid REFERENCES public.wa_crm_roles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.wa_crm_teams(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline', 'busy')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  whatsapp_number text NOT NULL,
  email text,
  company text,
  location text,
  source text,
  lead_status text NOT NULL DEFAULT 'new',
  assigned_agent_id uuid REFERENCES public.wa_crm_agents(id) ON DELETE SET NULL,
  opt_in boolean NOT NULL DEFAULT false,
  opt_out boolean NOT NULL DEFAULT false,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_contacted_at timestamptz,
  last_message_preview text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_crm_contacts_phone ON public.wa_crm_contacts (whatsapp_number) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.wa_crm_contact_tags (
  contact_id uuid NOT NULL REFERENCES public.wa_crm_contacts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.wa_crm_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.wa_crm_lead_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.wa_crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.wa_crm_contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  stage_slug text NOT NULL DEFAULT 'new',
  source text,
  assigned_agent_id uuid REFERENCES public.wa_crm_agents(id) ON DELETE SET NULL,
  value_amount numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.wa_crm_contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved')),
  assignment_status text NOT NULL DEFAULT 'unassigned',
  assigned_agent_id uuid REFERENCES public.wa_crm_agents(id) ON DELETE SET NULL,
  assigned_team_id uuid REFERENCES public.wa_crm_teams(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  is_ai_handling boolean NOT NULL DEFAULT false,
  unread_count int NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_crm_conversations_agent ON public.wa_crm_conversations (assigned_agent_id, status);

CREATE TABLE IF NOT EXISTS public.wa_crm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.wa_crm_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound', 'internal_note')),
  body text,
  message_type text NOT NULL DEFAULT 'text',
  wa_message_id text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed')),
  sender_agent_id uuid REFERENCES public.wa_crm_agents(id) ON DELETE SET NULL,
  is_ai boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_crm_messages_conversation ON public.wa_crm_messages (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.wa_crm_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('marketing', 'utility', 'authentication')),
  language text NOT NULL DEFAULT 'en',
  header text,
  body text NOT NULL,
  footer text,
  buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  wa_template_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_id uuid REFERENCES public.wa_crm_templates(id) ON DELETE SET NULL,
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  compliance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.wa_crm_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.wa_crm_contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  wa_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, contact_id)
);

CREATE TABLE IF NOT EXISTS public.wa_crm_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  trigger_type text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  auto_reply boolean NOT NULL DEFAULT false,
  handover_enabled boolean NOT NULL DEFAULT true,
  confidence_threshold numeric NOT NULL DEFAULT 0.65,
  system_instructions text,
  fallback_message text,
  business_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_ai_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  source_type text NOT NULL DEFAULT 'faq',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.wa_crm_contacts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.wa_crm_conversations(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.wa_crm_agents(id) ON DELETE SET NULL,
  due_at timestamptz NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text,
  waba_id text,
  phone_number_id text,
  display_phone text,
  api_version text NOT NULL DEFAULT 'v21.0',
  webhook_verify_token text,
  configured boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number text NOT NULL UNIQUE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.wa_crm_contacts(id) ON DELETE CASCADE,
  opt_in boolean NOT NULL,
  source text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_crm_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut text NOT NULL UNIQUE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.wa_crm_lead_stages (slug, name, sort_order) VALUES
  ('new', 'New', 1),
  ('contacted', 'Contacted', 2),
  ('qualified', 'Qualified', 3),
  ('interested', 'Interested', 4),
  ('follow_up', 'Follow-up', 5),
  ('converted', 'Converted', 6),
  ('lost', 'Lost', 7)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.wa_crm_ai_settings (enabled, auto_reply, system_instructions)
SELECT false, false, 'Answer only from approved knowledge base. Offer human handover when unsure.'
WHERE NOT EXISTS (SELECT 1 FROM public.wa_crm_ai_settings LIMIT 1);
