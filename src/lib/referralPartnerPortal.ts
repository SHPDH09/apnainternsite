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

function partnerFromRpcPayload(raw: unknown): ReferralPartnerSelf | null {
  const row = raw as {
    id?: string;
    auth_user_id?: string | null;
    referral_code?: string;
    full_name?: string;
    email?: string;
    active?: boolean;
    profile_image_url?: string | null;
  } | null;
  if (!row?.id || !row.referral_code) return null;
  return {
    id: String(row.id),
    auth_user_id: row.auth_user_id ? String(row.auth_user_id) : null,
    referral_code: String(row.referral_code),
    full_name: String(row.full_name || ""),
    email: String(row.email || ""),
    active: row.active !== false,
    profile_image_url: row.profile_image_url ?? null,
  };
}

/** Load partner via SECURITY DEFINER RPC (works even when RLS blocks table reads). */
export async function fetchReferralPartnerForSession(
  client: SupabaseClient
): Promise<ReferralPartnerSelf | null> {
  try {
    const { data, error } = await client.rpc("get_referral_partner_for_session");
    if (error) {
      const msg = error.message || "";
      if (/get_referral_partner_for_session|does not exist|42883/i.test(msg)) {
        return null;
      }
      console.warn("get_referral_partner_for_session:", msg);
      return null;
    }
    const payload = data as { ok?: boolean; partner?: unknown; reason?: string } | null;
    if (payload?.ok !== true) return null;
    return partnerFromRpcPayload(payload.partner);
  } catch {
    return null;
  }
}

/** Best-effort self-heal when partner row exists but portal role/link is missing. */
export async function syncReferralPartnerPortalForSession(
  client: SupabaseClient
): Promise<{ ok: boolean; referralCode?: string; partner?: ReferralPartnerSelf | null }> {
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
    const row = data as {
      ok?: boolean;
      referral_code?: string;
      partner?: unknown;
    } | null;
    if (row?.ok === true) {
      const partner = partnerFromRpcPayload(row.partner);
      return {
        ok: true,
        referralCode: partner?.referral_code || (row.referral_code ? String(row.referral_code) : undefined),
        partner,
      };
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
  const fromSessionRpc = await fetchReferralPartnerForSession(client);
  if (fromSessionRpc?.referral_code) return fromSessionRpc;

  let partner = await fetchReferralPartnerSelf(client, userId, email);
  if (partner?.referral_code) return partner;

  const synced = await syncReferralPartnerPortalForSession(client);
  if (synced.partner?.referral_code) return synced.partner;

  partner = await fetchReferralPartnerSelf(client, userId, email);
  if (partner?.referral_code) return partner;

  return fetchReferralPartnerForSession(client);
}
