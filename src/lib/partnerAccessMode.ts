import type { PartnerKind } from "@/lib/partnerApplications";

export type PartnerAccessMode = "referral_only" | "coupon_only" | "both";

export const PARTNER_ACCESS_MODE_OPTIONS: Array<{
  value: PartnerAccessMode;
  label: string;
  description: string;
}> = [
  {
    value: "referral_only",
    label: "Referral only",
    description: "Referral link + student signups. Coupons section stays locked.",
  },
  {
    value: "coupon_only",
    label: "Coupon only",
    description: "Coupon codes + redemptions. Referrals section stays locked.",
  },
  {
    value: "both",
    label: "Referral + Coupon",
    description: "Full access to referral link and coupon tools.",
  },
];

export function partnerAccessModeLabel(mode: unknown): string {
  const hit = PARTNER_ACCESS_MODE_OPTIONS.find((o) => o.value === mode);
  return hit?.label ?? "Referral + Coupon";
}

export function resolvePartnerAccessMode(
  partnerKind: PartnerKind,
  payload?: Record<string, unknown>,
  explicit?: PartnerAccessMode | null
): PartnerAccessMode {
  if (explicit === "referral_only" || explicit === "coupon_only" || explicit === "both") {
    return explicit;
  }
  if (partnerKind === "coupon") return "coupon_only";
  if (partnerKind === "referral") {
    const mode = String(payload?.referral_apply_mode || payload?.access_mode || "referral_only");
    if (mode === "coupon_only" || mode === "both") return mode;
    return "referral_only";
  }
  return "both";
}

export function canAccessReferralSection(mode: PartnerAccessMode | null | undefined): boolean {
  return mode === "referral_only" || mode === "both";
}

export function canAccessCouponSection(mode: PartnerAccessMode | null | undefined): boolean {
  return mode === "coupon_only" || mode === "both";
}

export function normalizePartnerAccessMode(raw: unknown): PartnerAccessMode {
  const mode = String(raw || "").trim();
  if (mode === "referral_only" || mode === "coupon_only" || mode === "both") return mode;
  return "both";
}
