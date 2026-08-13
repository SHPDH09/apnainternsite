import type { SupabaseClient } from "@supabase/supabase-js";
import { publicStorageObjectUrl, resolveStorageUrl } from "@/lib/storageUrl";
import {
  normalizePopupPages,
  type SitePopup,
  type SitePopupType,
} from "@/lib/sitePopups";

const POPUP_BUCKET = "logos";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function mapRow(row: SitePopup): SitePopup {
  const fromPath =
    row.image_path != null && String(row.image_path).trim() !== ""
      ? publicStorageObjectUrl(POPUP_BUCKET, String(row.image_path))
      : null;
  return {
    ...row,
    popup_type: row.popup_type === "image" ? "image" : "text",
    pages: normalizePopupPages(row.pages),
    is_active: row.is_active !== false,
    sort_order: Number(row.sort_order) || 0,
    image_url: fromPath || (row.image_url ? resolveStorageUrl(row.image_url) || row.image_url : row.image_url),
  };
}

export type SitePopupWrite = {
  title: string;
  popup_type: SitePopupType;
  message?: string | null;
  image_url?: string | null;
  image_path?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  pages: string[];
  start_at?: string | null;
  end_at?: string | null;
  is_active: boolean;
  sort_order: number;
};

export async function fetchPublicSitePopups(client: SupabaseClient): Promise<SitePopup[]> {
  const { data, error } = await client
    .from("site_popups")
    .select(
      "id, title, popup_type, message, image_url, image_path, cta_label, cta_url, pages, start_at, end_at, is_active, sort_order, created_at, updated_at"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as SitePopup[]).map(mapRow);
}

export async function fetchAdminSitePopups(client: SupabaseClient): Promise<SitePopup[]> {
  const { data, error } = await client
    .from("site_popups")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as SitePopup[]).map(mapRow);
}

export async function createSitePopup(
  client: SupabaseClient,
  payload: SitePopupWrite,
  createdBy?: string | null
): Promise<SitePopup> {
  const { data, error } = await client
    .from("site_popups")
    .insert({
      ...payload,
      created_by: createdBy && /^[0-9a-f-]{36}$/i.test(createdBy) ? createdBy : null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data as SitePopup);
}

export async function updateSitePopup(
  client: SupabaseClient,
  id: string,
  payload: Partial<SitePopupWrite>
): Promise<void> {
  const { error } = await client
    .from("site_popups")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSitePopup(client: SupabaseClient, row: SitePopup): Promise<void> {
  if (row.image_path) {
    await client.storage.from(POPUP_BUCKET).remove([row.image_path]);
  }
  const { error } = await client.from("site_popups").delete().eq("id", row.id);
  if (error) throw error;
}

export async function uploadPopupImage(
  client: SupabaseClient,
  file: File,
  createdBy: string
): Promise<{ image_url: string; image_path: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file (JPG, PNG, WebP, or GIF).");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 8 MB or smaller.");
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `popups/${createdBy || "admin"}/${Date.now()}-${safeName}`;
  const { error: upErr } = await client.storage.from(POPUP_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upErr) {
    if (/bucket not found/i.test(upErr.message)) {
      throw new Error('Storage bucket "logos" is missing. Run npm run aws:s3:provision.');
    }
    throw upErr;
  }
  const { data: pub } = client.storage.from(POPUP_BUCKET).getPublicUrl(path);
  const imageUrl =
    publicStorageObjectUrl(POPUP_BUCKET, path) ||
    resolveStorageUrl(pub.publicUrl) ||
    pub.publicUrl;
  return { image_url: imageUrl, image_path: path };
}
