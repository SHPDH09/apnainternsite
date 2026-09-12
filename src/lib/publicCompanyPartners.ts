import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicCompanyPartner = {
  id: string;
  company_name: string;
  contact_name: string;
  designation: string | null;
  company_address: string | null;
};

export async function fetchPublicCompanyPartners(
  client: SupabaseClient
): Promise<PublicCompanyPartner[]> {
  try {
    const { data, error } = await client.rpc("list_public_company_partners");
    if (error) {
      if (/list_public_company_partners|42P01|does not exist|42883/i.test(error.message || "")) {
        return [];
      }
      throw error;
    }
    if (!Array.isArray(data)) return [];
    return data as PublicCompanyPartner[];
  } catch {
    return [];
  }
}
