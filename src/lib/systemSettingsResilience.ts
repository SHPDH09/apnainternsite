import type { SupabaseClient } from "@supabase/supabase-js";

export type SystemSettingRow = {
  key: string;
  is_enabled: boolean;
  label?: string | null;
  description?: string | null;
  updated_at?: string | null;
};

/** Defaults when table missing — all services stay enabled (matches server bootstrap). */
export const DEFAULT_SYSTEM_SETTINGS: SystemSettingRow[] = [
  { key: "live_classes", is_enabled: true },
  { key: "certificates", is_enabled: true },
  { key: "bulk_certification", is_enabled: true },
  { key: "internship_registration", is_enabled: true },
];

function isMissingSystemSettingsError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || "").toLowerCase();
  const code = String((err as { code?: string })?.code || "");
  return (
    code === "42P01" ||
    msg.includes("system_settings") && msg.includes("does not exist")
  );
}

async function tryEnsureRpc(client: SupabaseClient): Promise<void> {
  try {
    await client.rpc("admin_ensure_system_settings");
  } catch {
    /* RPC optional on older deploys */
  }
}

/** Load platform service toggles; never throws; no user-facing error for missing table. */
export async function fetchSystemSettingsResilient(
  client: SupabaseClient,
  opts?: { ensureSchema?: boolean }
): Promise<SystemSettingRow[]> {
  if (opts?.ensureSchema !== false) {
    await tryEnsureRpc(client);
  }

  const { data, error } = await client.from("system_settings").select("*");
  if (!error && Array.isArray(data) && data.length > 0) {
    return data as SystemSettingRow[];
  }

  if (error && isMissingSystemSettingsError(error)) {
    await tryEnsureRpc(client);
    const retry = await client.from("system_settings").select("*");
    if (!retry.error && Array.isArray(retry.data) && retry.data.length > 0) {
      return retry.data as SystemSettingRow[];
    }
    console.warn("[system_settings] table missing — using defaults");
    return [...DEFAULT_SYSTEM_SETTINGS];
  }

  if (error) {
    console.warn("[system_settings] load:", error.message || error);
  }
  return [...DEFAULT_SYSTEM_SETTINGS];
}
