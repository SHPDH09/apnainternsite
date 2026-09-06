import type { SupabaseClient } from "@supabase/supabase-js";

export type ReferralPartnerSelf = {
  id: string;
  auth_user_id: string | null;
  referral_code: string;
  full_name: string;
  email: string;
  active: boolean;
  profile_image_url?: string | null;
};

const PARTNER_SELF_SELECT =
  "id, auth_user_id, referral_code, full_name, email, active, profile_image_url";

/** Best-effort self-heal when partner row exists but portal role/link is missing. */
export async function syncReferralPartnerPortalForSession(
  client: SupabaseClient
): Promise<{ ok: boolean; referralCode?: string }> {
  try {
    const { data, error } = await client.rpc("sync_referral_partner_portal_for_session");
    if (error) {
      const msg = error.message || "";
      if (/sync_referral_partner_portal_for_session|does not exist|42883/i.test(msg)) {
        return { ok: false };
      }
      console.warn("sync_referral_partner_portal_for_session:", msg);
      return { ok: false };
    }
    const row = data as { ok?: boolean; referral_code?: string } | null;
    if (row?.ok === true && row.referral_code) {
      return { ok: true, referralCode: String(row.referral_code) };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function fetchReferralPartnerSelf(
  client: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<ReferralPartnerSelf | null> {
  const { data: byAuth, error: authErr } = await client
    .from("referral_partners")
    .select(PARTNER_SELF_SELECT)
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (!authErr && byAuth?.referral_code) {
    return byAuth as ReferralPartnerSelf;
  }

  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) return null;

  const { data: byEmail, error: emailErr } = await client
    .from("referral_partners")
    .select(PARTNER_SELF_SELECT)
    .ilike("email", normalizedEmail)
    .eq("active", true)
    .maybeSingle();

  if (emailErr || !byEmail?.referral_code) return null;
  return byEmail as ReferralPartnerSelf;
}

export async function loadReferralPartnerSelf(
  client: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<ReferralPartnerSelf | null> {
  let partner = await fetchReferralPartnerSelf(client, userId, email);
  if (partner?.referral_code) return partner;

  await syncReferralPartnerPortalForSession(client);
  partner = await fetchReferralPartnerSelf(client, userId, email);
  return partner?.referral_code ? partner : null;
}
