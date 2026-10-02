import type { SupabaseClient } from "@supabase/supabase-js";
import {
  publicStorageObjectUrl,
  resolveStorageUrl,
  storageObjectUrlCandidates,
} from "@/lib/storageUrl";
import {
  ClassTargetFilters,
  filtersToTargetArrays,
  describeClassTargets,
  studentMatchesClassTargets,
} from "@/lib/classLinkTargeting";
import { ensureAdminAuthSession } from "@/lib/adminAuthSession";

export type LearningMaterialType = "learning_material" | "project_report";

export type LearningMaterialRow = {
  id: string;
  title: string;
  description?: string | null;
  material_type: LearningMaterialType;
  file_path?: string | null;
  file_url?: string | null;
  /** Alternate public URLs (prefixed + flat basename) for legacy S3 sync. */
  file_url_candidates?: string[];
  file_name?: string | null;
  mime_type?: string | null;
  target_universities?: string[] | null;
  target_colleges?: string[] | null;
  target_domains?: string[] | null;
  target_modes?: string[] | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

const BUCKET = "learning-materials";
const MAX_BYTES = 25 * 1024 * 1024;

async function adminAuthHeaders(client: SupabaseClient): Promise<Record<string, string> | null> {
  await ensureAdminAuthSession(client, { extendWindow: true, attempts: 2 });
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token?.trim();
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function ensureLearningMaterialsViaSendMail(client: SupabaseClient): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const headers = await adminAuthHeaders(client);
  if (!headers) return false;
  const origin = window.location.origin.replace(/\/$/, "");
  const res = await fetch(`${origin}/api/send-mail`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "ensure_learning_materials" }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

async function ensureLearningMaterialsTable(client: SupabaseClient): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (await ensureLearningMaterialsViaSendMail(client)) return true;

  const headers = await adminAuthHeaders(client);
  if (!headers) return false;
  const origin = window.location.origin.replace(/\/$/, "");
  const direct = await fetch(`${origin}/api/ensure-learning-materials`, {
    method: "POST",
    headers,
  }).catch(() => null);
  return Boolean(direct?.ok);
}

const VERCEL_STORAGE_RELAY_MAX_BYTES = 3_300_000;

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

async function uploadLearningMaterialViaSendMail(
  client: SupabaseClient,
  path: string,
  file: File
): Promise<{ ok: boolean; publicUrl?: string }> {
  if (file.size > VERCEL_STORAGE_RELAY_MAX_BYTES) return { ok: false };
  const headers = await adminAuthHeaders(client);
  if (!headers) return { ok: false };
  const origin = window.location.origin.replace(/\/$/, "");
  const fileBase64 = await fileToBase64(file);
  const res = await fetch(`${origin}/api/send-mail`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "upload_learning_material_storage",
      object_path: path,
      file_name: file.name,
      content_type: file.type || "application/octet-stream",
      file_base64: fileBase64,
    }),
  }).catch(() => null);
  if (!res?.ok) return { ok: false };
  const json = (await res.json().catch(() => null)) as {
    publicUrl?: string;
    url?: string;
  } | null;
  const publicUrl = json?.publicUrl || json?.url;
  return publicUrl ? { ok: true, publicUrl } : { ok: false };
}

function isMissingLearningMaterialsTable(error: { message?: string; code?: string } | null): boolean {
  const msg = String(error?.message || "");
  const code = String(error?.code || "");
  return (
    code === "42P01" ||
    /learning_materials.*does not exist|relation.*learning_materials/i.test(msg)
  );
}

function mapMaterialRow(row: LearningMaterialRow): LearningMaterialRow {
  const candidates = storageObjectUrlCandidates(BUCKET, row.file_path, row.file_url);
  const primary =
    candidates[0] ||
    (row.file_path ? publicStorageObjectUrl(BUCKET, row.file_path) : null) ||
    (row.file_url ? resolveStorageUrl(row.file_url) : null) ||
    row.file_url ||
    null;
  return {
    ...row,
    file_url: primary,
    file_url_candidates: candidates.length > 0 ? candidates : primary ? [primary] : [],
  };
}

export function learningMaterialTypeLabel(type: LearningMaterialType): string {
  return type === "project_report" ? "Project report" : "Learning material";
}

export function rowToTargetFilters(row: LearningMaterialRow): ClassTargetFilters {
  return {
    universities: row.target_universities || [],
    colleges: row.target_colleges || [],
    domain:
      row.target_domains?.length === 1 ? row.target_domains[0] : "all",
    mode: row.target_modes?.length === 1 ? row.target_modes[0] : "all",
  };
}

export function materialMatchesStudent(
  row: LearningMaterialRow,
  student: {
    university_name?: string | null;
    college_name?: string | null;
    internship_domain?: string | null;
    course?: string | null;
    internship_mode?: string | null;
    metadata?: Record<string, unknown> | null;
  }
): boolean {
  if (!row.is_active) return false;
  return studentMatchesClassTargets(student, {
    target_universities: row.target_universities,
    target_colleges: row.target_colleges,
    target_domains: row.target_domains,
    target_modes: row.target_modes,
    domain_id: null,
    internship_domains: null,
  });
}

export async function fetchLearningMaterials(
  client: SupabaseClient,
  retried = false
): Promise<LearningMaterialRow[]> {
  const { data, error } = await client
    .from("learning_materials")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    if (!retried && isMissingLearningMaterialsTable(error)) {
      const ready = await ensureLearningMaterialsTable(client);
      if (ready) return fetchLearningMaterials(client, true);
    }
    console.warn("[learning_materials] fetch failed:", error.message);
    return [];
  }
  return ((data || []) as LearningMaterialRow[]).map(mapMaterialRow);
}

async function uploadWithRetry(
  client: SupabaseClient,
  path: string,
  file: File,
  contentType?: string
): Promise<{ error: { message: string } | null }> {
  let lastErr: { message: string } | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await client.storage.from(BUCKET).upload(path, file, {
      upsert: attempt > 0,
      contentType: contentType || file.type || undefined,
    });
    if (!error) return { error: null };
    lastErr = error;
    if (!/503|502|504|timeout|unavailable/i.test(error.message)) break;
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  if (lastErr && /503|502|504|timeout|unavailable/i.test(lastErr.message)) {
    const relay = await uploadLearningMaterialViaSendMail(client, path, file);
    if (relay.ok) return { error: null };
  }
  return { error: lastErr };
}

export async function uploadLearningMaterialFile(
  client: SupabaseClient,
  file: File,
  createdBy: string
): Promise<{ path: string; publicUrl: string }> {
  if (file.size > MAX_BYTES) {
    throw new Error("File must be 25 MB or smaller.");
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${createdBy}/${Date.now()}-${safeName}`;
  const { error } = await uploadWithRetry(client, path, file);
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error(
        'Storage bucket "learning-materials" is missing. Run npm run aws:s3:provision and npm run aws:s3:sync.'
      );
    }
    throw new Error(error.message || "Storage upload failed. Please retry in a moment.");
  }
  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl =
    publicStorageObjectUrl(BUCKET, path) ||
    resolveStorageUrl(data.publicUrl) ||
    data.publicUrl;
  return { path, publicUrl };
}

export async function insertLearningMaterial(
  client: SupabaseClient,
  input: {
    title: string;
    description?: string;
    materialType: LearningMaterialType;
    file: File;
    filters: ClassTargetFilters;
    createdBy: string;
  }
): Promise<LearningMaterialRow> {
  await ensureLearningMaterialsTable(client);
  const { path, publicUrl } = await uploadLearningMaterialFile(
    client,
    input.file,
    input.createdBy
  );
  const targets = filtersToTargetArrays(input.filters);
  const { data, error } = await client
    .from("learning_materials")
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      material_type: input.materialType,
      file_path: path,
      file_url: publicUrl,
      file_name: input.file.name,
      mime_type: input.file.type || null,
      target_universities: targets.target_universities || [],
      target_colleges: targets.target_colleges || [],
      target_domains: targets.target_domains || [],
      target_modes: targets.target_modes || [],
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapMaterialRow(data as LearningMaterialRow);
}

export async function setLearningMaterialActive(
  client: SupabaseClient,
  id: string,
  isActive: boolean
): Promise<void> {
  const { error } = await client
    .from("learning_materials")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLearningMaterial(
  client: SupabaseClient,
  row: LearningMaterialRow
): Promise<void> {
  if (row.file_path) {
    await client.storage.from(BUCKET).remove([row.file_path]);
  }
  const { error } = await client.from("learning_materials").delete().eq("id", row.id);
  if (error) throw error;
}

export function describeMaterialTargets(row: LearningMaterialRow): string {
  return describeClassTargets({
    target_universities: row.target_universities,
    target_colleges: row.target_colleges,
    target_domains: row.target_domains,
    target_modes: row.target_modes,
    domain_id: null,
    internship_domains: null,
  });
}

export async function updateLearningMaterial(
  client: SupabaseClient,
  row: LearningMaterialRow,
  input: {
    title: string;
    description?: string;
    materialType: LearningMaterialType;
    filters: ClassTargetFilters;
    file?: File | null;
    updatedBy: string;
  }
): Promise<LearningMaterialRow> {
  const targets = filtersToTargetArrays(input.filters);
  let file_path = row.file_path;
  let file_url = row.file_url;
  let file_name = row.file_name;
  let mime_type = row.mime_type;
  const oldPath = row.file_path;

  if (input.file) {
    const uploaded = await uploadLearningMaterialFile(client, input.file, input.updatedBy);
    file_path = uploaded.path;
    file_url = uploaded.publicUrl;
    file_name = input.file.name;
    mime_type = input.file.type || null;
    if (oldPath && oldPath !== file_path) {
      await client.storage.from(BUCKET).remove([oldPath]);
    }
  }

  const { data, error } = await client
    .from("learning_materials")
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      material_type: input.materialType,
      file_path,
      file_url,
      file_name,
      mime_type,
      target_universities: targets.target_universities || [],
      target_colleges: targets.target_colleges || [],
      target_domains: targets.target_domains || [],
      target_modes: targets.target_modes || [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .select("*")
    .single();
  if (error) throw error;
  return mapMaterialRow(data as LearningMaterialRow);
}

export async function fetchStudentLearningMaterials(
  client: SupabaseClient,
  student: Parameters<typeof materialMatchesStudent>[1]
): Promise<LearningMaterialRow[]> {
  const rows = await fetchLearningMaterials(client);
  return rows
    .filter((row) => materialMatchesStudent(row, student))
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
}
