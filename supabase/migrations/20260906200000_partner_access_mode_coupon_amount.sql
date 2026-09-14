-- Partner access mode + coupon amount (mirrors aws/scripts/64-rds-partner-access-mode-coupon-amount.sql)

ALTER TABLE public.referral_partners
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'both';

ALTER TABLE public.referral_partners
  DROP CONSTRAINT IF EXISTS referral_partners_access_mode_check;

ALTER TABLE public.referral_partners
  ADD CONSTRAINT referral_partners_access_mode_check
  CHECK (access_mode IN ('referral_only', 'coupon_only', 'both'));

ALTER TABLE public.referral_coupons
  ADD COLUMN IF NOT EXISTS coupon_amount numeric(10, 2);
