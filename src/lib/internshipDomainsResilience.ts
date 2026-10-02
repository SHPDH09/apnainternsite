import type { SupabaseClient } from "@supabase/supabase-js";
import { NON_TECHNICAL_INTERNSHIP_DOMAINS } from "@/lib/nonTechnicalInternshipDomains";
import { TECHNICAL_INTERNSHIP_DOMAINS } from "@/lib/technicalInternshipDomains";

export type InternshipDomainRow = { id: string; name: string };

function staticInternshipDomainCatalog(): InternshipDomainRow[] {
  const names = new Set<string>();
  for (const n of [...NON_TECHNICAL_INTERNSHIP_DOMAINS, ...TECHNICAL_INTERNSHIP_DOMAINS]) {
    const t = String(n || "").trim();
    if (t) names.add(t);
  }
  return [...names].sort((a, b) => a.localeCompare(b)).map((name, index) => ({
    id: `catalog-${index}-${name.slice(0, 24).replace(/\W+/g, "-")}`,
    name,
  }));
}

/** Load internship domains with REST fallbacks so admin uploads keep working when RDS hiccups. */
export async function fetchInternshipDomainsResilient(
  client: SupabaseClient
): Promise<InternshipDomainRow[]> {
  const simple = await client
    .from("internship_domains")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(3000);

  if (!simple.error && simple.data?.length) {
    return simple.data as InternshipDomainRow[];
  }

  const retry = await client.from("internship_domains").select("id, name").limit(3000);
  if (!retry.error && retry.data?.length) {
    return (retry.data as InternshipDomainRow[]).sort((a, b) =>
      String(a.name).localeCompare(String(b.name))
    );
  }

  console.warn(
    "[internship_domains] REST failed, using static catalog:",
    simple.error?.message || retry.error?.message
  );
  return staticInternshipDomainCatalog();
}
