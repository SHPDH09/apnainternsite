import type { SupabaseClient } from "@supabase/supabase-js";
import { coalesce } from "@/lib/requestCoalesce";

/** Coalesced role list for post-login routing (single round-trip via local REST → RDS). */
export async function fetchRolesForUser(
  client: SupabaseClient,
  userId: string
): Promise<string[]> {
  return coalesce(`roles:${userId}`, async () => {
    const { data, error } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) throw error;
    return (data || []).map((r) => r.role);
  });
}

export async function fetchCybercafeExists(
  client: SupabaseClient,
  userId: string
): Promise<boolean> {
  return coalesce(`cybercafe:${userId}`, async () => {
    const { data, error } = await client
      .from("cybercafe_profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data?.id);
  });
}

export async function fetchCompanyPartnerExists(
  client: SupabaseClient,
  userId: string
): Promise<boolean> {
  return coalesce(`company:${userId}`, async () => {
    const { data, error } = await client
      .from("company_profiles")
      .select("id, status")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      if (/42P01|does not exist/i.test(error.message || "")) return false;
      throw error;
    }
    return Boolean(data?.id);
  });
}
