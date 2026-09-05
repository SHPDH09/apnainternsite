import type { SupabaseClient } from "@supabase/supabase-js";
import { publicStorageObjectUrl, resolveStorageUrl, storageObjectUrlCandidates } from "@/lib/storageUrl";
import {
  normalizePopupPages,
  type SitePopup,
  type SitePopupType,
} from "@/lib/sitePopups";
import {
  createFallbackPopup,
  deleteFallbackPopup,
  fallbackWriteToPopup,
  fetchFallbackAdminPopups,
  fetchFallbackPublicPopups,
  sitePopupsTableAvailable,
  updateFallbackPopup,
} from "@/lib/sitePopupsFallbackStorage";

const POPUP_BUCKET = "logos";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function popupErrorText(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { message?: string; details?: string; code?: string };
    return [e.message, e.details, e.code].filter(Boolean).join(" — ");
  }
  return error instanceof Error ? error.message : String(error ?? "");
}

export function isSitePopupsTableMissing(error: unknown): boolean {
  const msg = popupErrorText(error);
  return (
    /42P01|undefined_table/i.test(msg) ||
    /relation ["']?public\.site_popups["']? does not exist/i.test(msg) ||
    /Could not find the table ['"]public\.site_popups['"]/i.test(msg)
  );
}

export function formatSitePopupError(error: unknown): string {
  if (isSitePopupsTableMissing(error)) {
    return "Popup storage is initializing. Wait a moment and try Save again.";
  }
  const msg = popupErrorText(error);
  return msg || "Popup action failed.";
}

async function ensureSiteCmsTables(client: SupabaseClient): Promise<void> {
  try {
    await client.rpc("admin_ensure_site_cms_tables");
  } catch {
    // Older API builds may not expose this RPC yet; withCmsRetry on REST still applies.
  }
}

async function withPopupStorageRetry<T>(
  client: SupabaseClient,
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (!isSitePopupsTableMissing(err)) throw err;
    await ensureSiteCmsTables(client);
    await new Promise((r) => setTimeout(r, 600));
    return await run();
  }
}

function mapRow(row: SitePopup): SitePopup {
  const imagePath = row.image_path?.trim() || null;
  const candidates = storageObjectUrlCandidates(POPUP_BUCKET, imagePath, row.image_url);
  const image_url =
    candidates[0] ||
    (imagePath ? publicStorageObjectUrl(POPUP_BUCKET, imagePath) : null) ||
    (row.image_url ? resolveStorageUrl(row.image_url) || row.image_url : null);
  return {
    ...row,
    popup_type: row.popup_type === "image" ? "image" : "text",
    pages: normalizePopupPages(row.pages),
    is_active: row.is_active !== false,
    sort_order: Number(row.sort_order) || 0,
    image_path: imagePath,
    image_url: image_url || null,
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
  if (!(await sitePopupsTableAvailable(client))) {
    return (await fetchFallbackPublicPopups(client)).map(mapRow);
  }
  const { data, error } = await withPopupStorageRetry(client, () =>
    client
      .from("site_popups")
      .select(
        "id, title, popup_type, message, image_url, image_path, cta_label, cta_url, pages, start_at, end_at, is_active, sort_order, created_at, updated_at"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
  );
  if (error) {
    if (isSitePopupsTableMissing(error)) {
      return (await fetchFallbackPublicPopups(client)).map(mapRow);
    }
    throw error;
  }
  return ((data || []) as SitePopup[]).map(mapRow);
}

export async function fetchAdminSitePopups(client: SupabaseClient): Promise<SitePopup[]> {
  if (!(await sitePopupsTableAvailable(client))) {
    return (await fetchFallbackAdminPopups(client)).map(mapRow);
  }
  await ensureSiteCmsTables(client);
  const { data, error } = await withPopupStorageRetry(client, () =>
    client
      .from("site_popups")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
  );
  if (error) {
    if (isSitePopupsTableMissing(error)) {
      return (await fetchFallbackAdminPopups(client)).map(mapRow);
    }
    throw error;
  }
  return ((data || []) as SitePopup[]).map(mapRow);
}

export async function createSitePopup(
  client: SupabaseClient,
  payload: SitePopupWrite,
  createdBy?: string | null
): Promise<SitePopup> {
  if (!(await sitePopupsTableAvailable(client))) {
    const row = await createFallbackPopup(client, fallbackWriteToPopup(payload));
    return mapRow(row);
  }
  await ensureSiteCmsTables(client);
  const { data, error } = await withPopupStorageRetry(client, () =>
    client
      .from("site_popups")
      .insert({
        ...payload,
        created_by: createdBy && /^[0-9a-f-]{36}$/i.test(createdBy) ? createdBy : null,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single()
  );
  if (error) {
    if (isSitePopupsTableMissing(error)) {
      const row = await createFallbackPopup(client, fallbackWriteToPopup(payload));
      return mapRow(row);
    }
    throw error;
  }
  return mapRow(data as SitePopup);
}

export async function updateSitePopup(
  client: SupabaseClient,
  id: string,
  payload: Partial<SitePopupWrite>
): Promise<void> {
  if (!(await sitePopupsTableAvailable(client))) {
    await updateFallbackPopup(client, id, payload);
    return;
  }
  const { error } = await client
    .from("site_popups")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    if (isSitePopupsTableMissing(error)) {
      await updateFallbackPopup(client, id, payload);
      return;
    }
    throw error;
  }
}

export async function deleteSitePopup(client: SupabaseClient, row: SitePopup): Promise<void> {
  if (row.image_path) {
    await client.storage.from(POPUP_BUCKET).remove([row.image_path]);
  }
  if (!(await sitePopupsTableAvailable(client))) {
    await deleteFallbackPopup(client, row.id);
    return;
  }
  const { error } = await client.from("site_popups").delete().eq("id", row.id);
  if (error) {
    if (isSitePopupsTableMissing(error)) {
      await deleteFallbackPopup(client, row.id);
      return;
    }
    throw error;
  }
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
