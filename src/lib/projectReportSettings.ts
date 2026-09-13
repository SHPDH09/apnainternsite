import type { SupabaseClient } from "@supabase/supabase-js";
import { pickWorkingStorageUrl, resolveStorageUrl } from "@/lib/storageUrl";

const BUCKET = "consent-forms";
const SETTINGS_ID = 1;

export type ProjectReportFieldLayout = {
  logo?: { page: number; x: number; y: number; width: number; height: number };
  universityName?: { page: number; x: number; y: number; size: number; maxWidth?: number };
  domain?: { page: number; x: number; y: number; size: number };
  mode?: { page: number; x: number; xLabel?: number; y: number; size: number };
  domainContent?: { page: number; x: number; y: number; width: number; size: number; lineHeight: number };
};

export const DEFAULT_PROJECT_REPORT_FIELD_LAYOUT: ProjectReportFieldLayout = {
  logo: { page: 0, x: 72, y: 720, width: 72, height: 72 },
  universityName: { page: 0, x: 160, y: 760, size: 16, maxWidth: 360 },
  domain: { page: 0, x: 72, y: 640, size: 12 },
  mode: { page: 0, x: 72, y: 620, size: 12 },
  domainContent: { page: 1, x: 72, y: 720, width: 460, size: 10, lineHeight: 14 },
};

export type ProjectReportSettings = {
  id: number;
  template_pdf_path: string | null;
  template_pdf_url: string | null;
  template_file_name: string | null;
  field_layout: ProjectReportFieldLayout;
  updated_at?: string;
};

function parseLayout(raw: unknown): ProjectReportFieldLayout {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_PROJECT_REPORT_FIELD_LAYOUT };
  }
  return {
    ...DEFAULT_PROJECT_REPORT_FIELD_LAYOUT,
    ...(raw as ProjectReportFieldLayout),
  };
}

export async function fetchProjectReportSettings(
  client: SupabaseClient
): Promise<ProjectReportSettings | null> {
  const { data, error } = await client
    .from("project_report_settings")
    .select("*")
    .eq("id", SETTINGS_ID)
    .maybeSingle();
  if (error) {
    if (/does not exist|42P01/i.test(error.message)) return null;
    throw error;
  }
  if (!data) return null;
  return {
    id: Number(data.id),
    template_pdf_path: data.template_pdf_path ? String(data.template_pdf_path) : null,
    template_pdf_url: data.template_pdf_url ? String(data.template_pdf_url) : null,
    template_file_name: data.template_file_name ? String(data.template_file_name) : null,
    field_layout: parseLayout(data.field_layout),
    updated_at: data.updated_at ? String(data.updated_at) : undefined,
  };
}

export async function saveProjectReportTemplate(
  client: SupabaseClient,
  params: {
    file: File;
    uploadedBy?: string | null;
  }
): Promise<ProjectReportSettings> {
  const safeName = params.file.name.replace(/[^\w.-]+/g, "_").slice(0, 120);
  const path = `project-report-templates/${Date.now()}-${safeName}`;

  const { error: uploadErr } = await client.storage.from(BUCKET).upload(path, params.file, {
    upsert: true,
    contentType: params.file.type || "application/pdf",
  });
  if (uploadErr) throw new Error(uploadErr.message || "Failed to upload template PDF.");

  const { data: pub } = client.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl =
    (await pickWorkingStorageUrl([pub.publicUrl, resolveStorageUrl(BUCKET, path)].filter(Boolean))) ||
    pub.publicUrl;

  const payload = {
    id: SETTINGS_ID,
    template_pdf_path: path,
    template_pdf_url: publicUrl,
    template_file_name: params.file.name,
    updated_by: params.uploadedBy || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("project_report_settings")
    .upsert(payload)
    .select("*")
    .single();
  if (error) throw error;

  return {
    id: SETTINGS_ID,
    template_pdf_path: String(data.template_pdf_path || path),
    template_pdf_url: String(data.template_pdf_url || publicUrl),
    template_file_name: String(data.template_file_name || params.file.name),
    field_layout: parseLayout(data.field_layout),
    updated_at: data.updated_at ? String(data.updated_at) : undefined,
  };
}

export async function resolveTemplatePdfBytes(settings: ProjectReportSettings): Promise<ArrayBuffer | null> {
  const url = settings.template_pdf_url?.trim();
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load template PDF (${res.status}).`);
  return res.arrayBuffer();
}

export async function resolveUniversityLogoBytes(logoUrl: string | null | undefined): Promise<Uint8Array | null> {
  const raw = String(logoUrl || "").trim();
  if (!raw) return null;
  try {
    const url = resolveStorageUrl(raw) || raw;
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}
