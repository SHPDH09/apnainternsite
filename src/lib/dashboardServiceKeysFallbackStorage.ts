import type { SupabaseClient } from "@supabase/supabase-js";
import { publicStorageObjectUrl } from "@/lib/storageUrl";

const FALLBACK_MARKER = "__apna_dashboard_service_keys_v1__";
const FALLBACK_BUCKET = "logos";
const FALLBACK_OBJECT_PATH = "admin/dashboard-service-keys.json";

export type FallbackServiceKeyConfig = {
  label: string;
  category: "learning" | "documents" | "other";
  defaultLocked: boolean;
  lockMessage: string;
  feePaise: number;
  gstPercent: number;
};

type FallbackEnvelope = {
  [FALLBACK_MARKER]?: {
    services?: Record<string, FallbackServiceKeyConfig>;
    updated_at?: string | null;
    updated_by?: string | null;
  };
};

function errorText(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { message?: string; details?: string; code?: string };
    return [e.message, e.details, e.code].filter(Boolean).join(" — ");
  }
  return error instanceof Error ? error.message : String(error ?? "");
}

function isReadUnavailable(error: unknown): boolean {
  return /not found|404|does not exist|not implemented|not_found|403|401|forbidden/i.test(
    errorText(error)
  );
}

async function readFallbackJson(client: SupabaseClient): Promise<FallbackEnvelope[FALLBACK_MARKER] | null> {
  const candidates: string[] = [];
  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/$/, "");
    candidates.push(`${origin}/storage/v1/object/public/${FALLBACK_BUCKET}/${FALLBACK_OBJECT_PATH}`);
  }
  const viaHelper = publicStorageObjectUrl(FALLBACK_BUCKET, FALLBACK_OBJECT_PATH);
  if (viaHelper && !candidates.includes(viaHelper)) candidates.push(viaHelper);

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const parsed = JSON.parse(await res.text()) as FallbackEnvelope;
        return parsed[FALLBACK_MARKER] || null;
      }
    } catch (err) {
      if (!isReadUnavailable(err)) continue;
    }
  }

  try {
    const { data, error } = await client.storage.from(FALLBACK_BUCKET).download(FALLBACK_OBJECT_PATH);
    if (error) {
      if (isReadUnavailable(error)) return null;
      throw error;
    }
    const parsed = JSON.parse(await data.text()) as FallbackEnvelope;
    return parsed[FALLBACK_MARKER] || null;
  } catch (err) {
    if (isReadUnavailable(err)) return null;
    throw err;
  }
}

export async function readDashboardServiceKeysFallback(
  client: SupabaseClient
): Promise<Record<string, FallbackServiceKeyConfig> | null> {
  try {
    const envelope = await readFallbackJson(client);
    if (!envelope?.services || typeof envelope.services !== "object") return null;
    return envelope.services;
  } catch {
    return null;
  }
}

export async function writeDashboardServiceKeysFallback(
  client: SupabaseClient,
  services: Record<string, FallbackServiceKeyConfig>,
  updatedBy: string | null
): Promise<void> {
  const payload: FallbackEnvelope = {
    [FALLBACK_MARKER]: {
      services,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
  };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const { error } = await client.storage.from(FALLBACK_BUCKET).upload(FALLBACK_OBJECT_PATH, blob, {
    upsert: true,
    contentType: "application/json",
  });
  if (error) throw error;
}
