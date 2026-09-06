-- referral_partners.profile_image_url — used by ReferralPartnerDashboard profile panel.
-- Without this column, partner self-load SELECT fails with 42703 on production RDS.

ALTER TABLE public.referral_partners
  ADD COLUMN IF NOT EXISTS profile_image_url text;

COMMENT ON COLUMN public.referral_partners.profile_image_url IS
  'Optional avatar URL for referral promoter portal profile panel.';
