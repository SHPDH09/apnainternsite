-- Partner self-apply queue + referral coupons (RDS)
-- Run after referral_partners exists.

CREATE TABLE IF NOT EXISTS public.partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_kind text NOT NULL CHECK (partner_kind IN ('cyber_cafe', 'referral', 'coupon')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  full_name text NOT NULL,
  email text NOT NULL,
  contact_number text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  rejection_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  approved_record_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON public.partner_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_applications_auth_user ON public.partner_applications (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_applications_email_lower ON public.partner_applications (lower(email));

CREATE TABLE IF NOT EXISTS public.referral_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_partner_id uuid NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  coupon_code text NOT NULL UNIQUE,
  university_name text,
  college_name text,
  internship_domain text,
  max_students integer,
  allowed_student_emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  valid_from timestamptz,
  valid_to timestamptz,
  active boolean NOT NULL DEFAULT true,
  application_id uuid REFERENCES public.partner_applications(id) ON DELETE SET NULL,
  click_count integer NOT NULL DEFAULT 0,
  redemption_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_coupons_partner ON public.referral_coupons (referral_partner_id, active);
CREATE INDEX IF NOT EXISTS idx_referral_coupons_code ON public.referral_coupons (lower(coupon_code));

CREATE TABLE IF NOT EXISTS public.referral_coupon_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.referral_coupons(id) ON DELETE CASCADE,
  referral_code text,
  session_id text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_coupon_clicks_coupon ON public.referral_coupon_clicks (coupon_id, clicked_at DESC);

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_coupon_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own partner applications" ON public.partner_applications;
CREATE POLICY "Users read own partner applications" ON public.partner_applications
  FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own partner applications" ON public.partner_applications;
CREATE POLICY "Users insert own partner applications" ON public.partner_applications
  FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage partner applications" ON public.partner_applications;
CREATE POLICY "Admins manage partner applications" ON public.partner_applications
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  );

DROP POLICY IF EXISTS "Public read active referral coupons" ON public.referral_coupons;
CREATE POLICY "Public read active referral coupons" ON public.referral_coupons
  FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "Referral partners manage own coupons" ON public.referral_coupons;
CREATE POLICY "Referral partners manage own coupons" ON public.referral_coupons
  FOR ALL TO authenticated
  USING (referral_partner_id IN (SELECT id FROM public.referral_partners WHERE auth_user_id = auth.uid()))
  WITH CHECK (referral_partner_id IN (SELECT id FROM public.referral_partners WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage referral coupons" ON public.referral_coupons;
CREATE POLICY "Admins manage referral coupons" ON public.referral_coupons
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  );

DROP POLICY IF EXISTS "Anyone log coupon clicks" ON public.referral_coupon_clicks;
CREATE POLICY "Anyone log coupon clicks" ON public.referral_coupon_clicks
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Partners read coupon clicks" ON public.referral_coupon_clicks;
CREATE POLICY "Partners read coupon clicks" ON public.referral_coupon_clicks
  FOR SELECT TO authenticated
  USING (
    coupon_id IN (
      SELECT c.id FROM public.referral_coupons c
      JOIN public.referral_partners p ON p.id = c.referral_partner_id
      WHERE p.auth_user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_coupons TO authenticated;
GRANT SELECT, INSERT ON public.referral_coupon_clicks TO anon, authenticated;
