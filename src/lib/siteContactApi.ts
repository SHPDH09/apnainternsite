import type { SupabaseClient } from "@supabase/supabase-js";
import {
  matchesDisplayContext,
  normalizeDisplayContexts,
  type DisplayContext,
  type SiteContactDetail,
  type SiteWhatsAppLink,
} from "@/lib/siteContacts";

function mapContactRow(row: SiteContactDetail): SiteContactDetail {
  return {
    ...row,
    contact_type: row.contact_type || "other",
    label: row.label || "",
    value: row.value || "",
    href: row.href ?? null,
    icon: row.icon ?? null,
    display_contexts: normalizeDisplayContexts(row.display_contexts),
    is_active: row.is_active !== false,
    sort_order: Number(row.sort_order) || 0,
  };
}

function mapWhatsAppRow(row: SiteWhatsAppLink): SiteWhatsAppLink {
  return {
    ...row,
    title: row.title || "",
    link_type: row.link_type || "channel",
    url: row.url || "",
    description: row.description ?? null,
    display_contexts: normalizeDisplayContexts(row.display_contexts),
    is_active: row.is_active === true,
    sort_order: Number(row.sort_order) || 0,
  };
}

export type SiteContactWrite = {
  contact_type: SiteContactDetail["contact_type"];
  label: string;
  value: string;
  href?: string | null;
  icon?: string | null;
  display_contexts: string[];
  is_active: boolean;
  sort_order: number;
};

export type SiteWhatsAppWrite = {
  title: string;
  link_type: SiteWhatsAppLink["link_type"];
  url: string;
  description?: string | null;
  display_contexts: string[];
  is_active: boolean;
  sort_order: number;
};

export async function fetchPublicSiteContacts(
  client: SupabaseClient,
  context?: DisplayContext
): Promise<SiteContactDetail[]> {
  const { data, error } = await client
    .from("site_contact_details")
    .select(
      "id, contact_type, label, value, href, icon, display_contexts, is_active, sort_order, created_at, updated_at"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = ((data || []) as SiteContactDetail[]).map(mapContactRow);
  if (!context) return rows;
  return rows.filter((r) => matchesDisplayContext(r.display_contexts, context));
}

export async function fetchAdminSiteContacts(client: SupabaseClient): Promise<SiteContactDetail[]> {
  const { data, error } = await client.from("site_contact_details").select("*").order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data || []) as SiteContactDetail[]).map(mapContactRow);
}

export async function createSiteContact(
  client: SupabaseClient,
  payload: SiteContactWrite
): Promise<SiteContactDetail> {
  const { data, error } = await client
    .from("site_contact_details")
    .insert({ ...payload, updated_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw error;
  return mapContactRow(data as SiteContactDetail);
}

export async function updateSiteContact(
  client: SupabaseClient,
  id: string,
  payload: Partial<SiteContactWrite>
): Promise<void> {
  const { error } = await client
    .from("site_contact_details")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSiteContact(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("site_contact_details").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPublicWhatsAppLinks(
  client: SupabaseClient,
  context?: DisplayContext
): Promise<SiteWhatsAppLink[]> {
  const { data, error } = await client
    .from("site_whatsapp_links")
    .select(
      "id, title, link_type, url, description, display_contexts, is_active, sort_order, created_at, updated_at"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = ((data || []) as SiteWhatsAppLink[]).map(mapWhatsAppRow);
  if (!context) return rows;
  return rows.filter((r) => matchesDisplayContext(r.display_contexts, context));
}

export async function fetchAdminWhatsAppLinks(client: SupabaseClient): Promise<SiteWhatsAppLink[]> {
  const { data, error } = await client.from("site_whatsapp_links").select("*").order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data || []) as SiteWhatsAppLink[]).map(mapWhatsAppRow);
}

export async function createWhatsAppLink(
  client: SupabaseClient,
  payload: SiteWhatsAppWrite
): Promise<SiteWhatsAppLink> {
  const { data, error } = await client
    .from("site_whatsapp_links")
    .insert({ ...payload, updated_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw error;
  return mapWhatsAppRow(data as SiteWhatsAppLink);
}

export async function updateWhatsAppLink(
  client: SupabaseClient,
  id: string,
  payload: Partial<SiteWhatsAppWrite>
): Promise<void> {
  const { error } = await client
    .from("site_whatsapp_links")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteWhatsAppLink(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("site_whatsapp_links").delete().eq("id", id);
  if (error) throw error;
}
