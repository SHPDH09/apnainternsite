import type { SupabaseClient } from "@supabase/supabase-js";
import { pickWorkingStorageUrl, resolveStorageUrl } from "@/lib/storageUrl";

const BUCKET = "consent-forms";

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

export type ProjectReportDomainTemplate = {
  id: string;
  domain_name: string;
  domain_key: string;
  template_pdf_path: string | null;
  template_pdf_url: string | null;
  template_file_name: string | null;
  field_layout: ProjectReportFieldLayout;
  updated_at?: string;
};

/** @deprecated Use ProjectReportDomainTemplate */
export type ProjectReportSettings = ProjectReportDomainTemplate;

function parseLayout(raw: unknown): ProjectReportFieldLayout {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_PROJECT_REPORT_FIELD_LAYOUT };
  }
  return {
    ...DEFAULT_PROJECT_REPORT_FIELD_LAYOUT,
    ...(raw as ProjectReportFieldLayout),
  };
}

function rowToTemplate(data: Record<string, unknown>): ProjectReportDomainTemplate {
  return {
    id: String(data.id),
    domain_name: String(data.domain_name || ""),
    domain_key: String(data.domain_key || ""),
    template_pdf_path: data.template_pdf_path ? String(data.template_pdf_path) : null,
    template_pdf_url: data.template_pdf_url ? String(data.template_pdf_url) : null,
    template_file_name: data.template_file_name ? String(data.template_file_name) : null,
    field_layout: parseLayout(data.field_layout),
    updated_at: data.updated_at ? String(data.updated_at) : undefined,
  };
}

export function normalizeProjectReportDomainKey(domain: string): string {
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function fetchProjectReportDomainTemplates(
  client: SupabaseClient
): Promise<ProjectReportDomainTemplate[]> {
  const { data, error } = await client
    .from("project_report_domain_templates")
    .select("*")
    .order("domain_name", { ascending: true });
  if (error) {
    if (/does not exist|42P01/i.test(error.message)) return [];
    throw error;
  }
  return (data || []).map((row) => rowToTemplate(row as Record<string, unknown>));
}

export async function fetchProjectReportDomainTemplate(
  client: SupabaseClient,
  domain: string
): Promise<ProjectReportDomainTemplate | null> {
  const domainKey = normalizeProjectReportDomainKey(domain);
  if (!domainKey) return null;

  const { data, error } = await client
    .from("project_report_domain_templates")
    .select("*")
    .eq("domain_key", domainKey)
    .maybeSingle();
  if (error) {
    if (/does not exist|42P01/i.test(error.message)) return null;
    throw error;
  }
  if (data) return rowToTemplate(data as Record<string, unknown>);

  const { data: fuzzyRows, error: fuzzyErr } = await client
    .from("project_report_domain_templates")
    .select("*")
    .ilike("domain_name", domain.trim());
  if (fuzzyErr) {
    if (/does not exist|42P01/i.test(fuzzyErr.message)) return null;
    throw fuzzyErr;
  }
  const fuzzy = (fuzzyRows || [])[0];
  return fuzzy ? rowToTemplate(fuzzy as Record<string, unknown>) : null;
}

export async function saveProjectReportDomainTemplate(
  client: SupabaseClient,
  params: {
    domain: string;
    file: File;
    uploadedBy?: string | null;
  }
): Promise<ProjectReportDomainTemplate> {
  const domainName = params.domain.trim();
  const domainKey = normalizeProjectReportDomainKey(domainName);
  if (!domainKey) throw new Error("Select a domain before uploading.");

  const safeName = params.file.name.replace(/[^\w.-]+/g, "_").slice(0, 120);
  const path = `project-report-templates/${domainKey.replace(/\s+/g, "-")}/${Date.now()}-${safeName}`;

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
    domain_name: domainName,
    domain_key: domainKey,
    template_pdf_path: path,
    template_pdf_url: publicUrl,
    template_file_name: params.file.name,
    updated_by: params.uploadedBy || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("project_report_domain_templates")
    .upsert(payload, { onConflict: "domain_key" })
    .select("*")
    .single();
  if (error) throw error;

  return rowToTemplate(data as Record<string, unknown>);
}

export async function resolveTemplatePdfBytes(
  template: Pick<ProjectReportDomainTemplate, "template_pdf_url">
): Promise<ArrayBuffer | null> {
  const url = template.template_pdf_url?.trim();
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
