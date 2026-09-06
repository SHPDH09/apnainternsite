-- referral_partners.profile_image_url for promoter portal profile panel

ALTER TABLE public.referral_partners
  ADD COLUMN IF NOT EXISTS profile_image_url text;

COMMENT ON COLUMN public.referral_partners.profile_image_url IS
  'Optional avatar URL for referral promoter portal profile panel.';
