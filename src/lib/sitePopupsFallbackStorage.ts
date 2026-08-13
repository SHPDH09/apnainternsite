import type { SupabaseClient } from "@supabase/supabase-js";
import type { SitePopup, SitePopupType } from "@/lib/sitePopups";
import { normalizePopupPages } from "@/lib/sitePopups";

const FALLBACK_MARKER = "__apna_site_popups_v1__";
const SETTINGS_ROW_ID = 1;

function popupErrorText(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { message?: string; details?: string; code?: string };
    return [e.message, e.details, e.code].filter(Boolean).join(" — ");
  }
  return error instanceof Error ? error.message : String(error ?? "");
}

function isMissingTable(error: unknown): boolean {
  const msg = popupErrorText(error);
  return (
    /42P01|undefined_table/i.test(msg) ||
    /relation ["']?public\.site_popups["']? does not exist/i.test(msg) ||
    /Could not find the table ['"]public\.site_popups['"]/i.test(msg)
  );
}

type FallbackEnvelope = {
  [FALLBACK_MARKER]?: SitePopup[];
};

let tableAvailable: boolean | null = null;

export async function sitePopupsTableAvailable(client: SupabaseClient): Promise<boolean> {
  if (tableAvailable != null) return tableAvailable;
  const { error } = await client.from("site_popups").select("id").limit(1);
  if (!error) {
    tableAvailable = true;
    return true;
  }
  if (isMissingTable(error)) {
    tableAvailable = false;
    return false;
  }
  throw error;
}

function normalizePopup(raw: SitePopup): SitePopup {
  return {
    ...raw,
    popup_type: raw.popup_type === "image" ? "image" : "text",
    pages: normalizePopupPages(raw.pages),
    is_active: raw.is_active !== false,
    sort_order: Number(raw.sort_order) || 0,
  };
}

function parseEnvelope(noticeMessage: string | null | undefined): SitePopup[] {
  const raw = String(noticeMessage || "").trim();
  if (!raw.startsWith("{")) return [];
  try {
    const parsed = JSON.parse(raw) as FallbackEnvelope;
    const rows = parsed[FALLBACK_MARKER];
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => normalizePopup(row));
  } catch {
    return [];
  }
}

function toEnvelope(popups: SitePopup[]): string {
  const payload: FallbackEnvelope = { [FALLBACK_MARKER]: popups };
  return JSON.stringify(payload);
}

async function readEnvelope(client: SupabaseClient): Promise<SitePopup[]> {
  const { data, error } = await client
    .from("site_settings")
    .select("notice_message")
    .eq("id", SETTINGS_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return parseEnvelope((data as { notice_message?: string } | null)?.notice_message);
}

async function writeEnvelope(client: SupabaseClient, popups: SitePopup[]): Promise<void> {
  const { error } = await client
    .from("site_settings")
    .update({
      notice_message: toEnvelope(popups),
      updated_at: new Date().toISOString(),
    })
    .eq("id", SETTINGS_ROW_ID);
  if (error) throw error;
}

export async function fetchFallbackAdminPopups(client: SupabaseClient): Promise<SitePopup[]> {
  const rows = await readEnvelope(client);
  return rows.sort((a, b) => {
    const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (so !== 0) return so;
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
}

export async function fetchFallbackPublicPopups(client: SupabaseClient): Promise<SitePopup[]> {
  const rows = await fetchFallbackAdminPopups(client);
  return rows.filter((row) => row.is_active !== false);
}

export async function createFallbackPopup(
  client: SupabaseClient,
  payload: Omit<SitePopup, "id" | "created_at" | "updated_at">
): Promise<SitePopup> {
  const rows = await readEnvelope(client);
  const now = new Date().toISOString();
  const row: SitePopup = normalizePopup({
    ...payload,
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
  });
  await writeEnvelope(client, [...rows, row]);
  return row;
}

export async function updateFallbackPopup(
  client: SupabaseClient,
  id: string,
  patch: Partial<SitePopup>
): Promise<void> {
  const rows = await readEnvelope(client);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Popup not found.");
  const next = [...rows];
  next[idx] = normalizePopup({
    ...next[idx],
    ...patch,
    id,
    updated_at: new Date().toISOString(),
  });
  await writeEnvelope(client, next);
}

export async function deleteFallbackPopup(client: SupabaseClient, id: string): Promise<void> {
  const rows = await readEnvelope(client);
  await writeEnvelope(
    client,
    rows.filter((r) => r.id !== id)
  );
}

export type FallbackPopupWrite = {
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

export function fallbackWriteToPopup(payload: FallbackPopupWrite): Omit<SitePopup, "id" | "created_at" | "updated_at"> {
  return {
    title: payload.title,
    popup_type: payload.popup_type,
    message: payload.message ?? null,
    image_url: payload.image_url ?? null,
    image_path: payload.image_path ?? null,
    cta_label: payload.cta_label ?? null,
    cta_url: payload.cta_url ?? null,
    pages: payload.pages,
    start_at: payload.start_at ?? null,
    end_at: payload.end_at ?? null,
    is_active: payload.is_active,
    sort_order: payload.sort_order,
  };
}
