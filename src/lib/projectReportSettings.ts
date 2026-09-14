import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAdminAuthSession } from "@/lib/adminAuthSession";
import {
  fetchProjectReportFallbackTemplates,
  isProjectReportTableMissingError,
  projectReportFallbackWritable,
  upsertProjectReportFallbackTemplate,
} from "@/lib/projectReportFallbackStorage";
import { publicStorageObjectUrl, resolveStorageUrl } from "@/lib/storageUrl";
import {
  DEFAULT_PROJECT_REPORT_FIELD_LAYOUT,
  type ProjectReportDomainTemplate,
  type ProjectReportFieldLayout,
  type ProjectReportSettings,
} from "@/lib/projectReportTypes";

export type { ProjectReportDomainTemplate, ProjectReportFieldLayout, ProjectReportSettings };
export { DEFAULT_PROJECT_REPORT_FIELD_LAYOUT };

const BUCKET = "consent-forms";
const MAX_PDF_BYTES = 20 * 1024 * 1024;

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

function mergeTemplates(
  rdsRows: ProjectReportDomainTemplate[],
  fallbackRows: ProjectReportDomainTemplate[]
): ProjectReportDomainTemplate[] {
  const byKey = new Map<string, ProjectReportDomainTemplate>();
  for (const row of fallbackRows) byKey.set(row.domain_key, row);
  for (const row of rdsRows) byKey.set(row.domain_key, row);
  return Array.from(byKey.values()).sort((a, b) => a.domain_name.localeCompare(b.domain_name));
}

export function normalizeProjectReportDomainKey(domain: string): string {
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function formatProjectReportUploadError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || "Upload failed.");
  if (/invalid or expired session|jwt required|401|403/i.test(msg)) {
    return "Your admin session expired. Refresh the page, sign in again, then retry the upload.";
  }
  if (/does not exist|42P01|project_report_domain_templates|initializing/i.test(msg)) {
    return "Could not save template metadata. Please retry — cloud storage fallback is enabled.";
  }
  if (/bucket not found/i.test(msg)) {
    return 'Storage bucket "consent-forms" is missing. Contact support to provision storage.';
  }
  if (/permission denied|row-level security|42501/i.test(msg)) {
    return "You do not have permission to upload templates. Sign in as an admin and try again.";
  }
  if (/invalid input syntax for type uuid/i.test(msg)) {
    return "Could not save template metadata. Please refresh the page and try again.";
  }
  return msg || "Project report template upload failed.";
}

/** Validate PDF before upload (type, size, header). */
export async function validateProjectReportPdfFile(file: File): Promise<void> {
  if (!file || file.size <= 0) {
    throw new Error("Please choose a PDF file to upload.");
  }
  const name = file.name.toLowerCase();
  const isPdfType = file.type === "application/pdf" || file.type === "application/x-pdf";
  if (!isPdfType && !name.endsWith(".pdf")) {
    throw new Error("Project report template must be a PDF file.");
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error("PDF must be 20 MB or smaller.");
  }

  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const magic = String.fromCharCode(...header);
  if (!magic.startsWith("%PDF")) {
    throw new Error("The selected file is not a valid PDF document.");
  }
}

async function adminAuthHeaders(client: SupabaseClient): Promise<Record<string, string> | null> {
  await ensureAdminAuthSession(client, { extendWindow: true, attempts: 3 });
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token?.trim();
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function callSendMailAction(
  client: SupabaseClient,
  action: string,
  payload?: Record<string, unknown>
): Promise<{ ok: boolean; message?: string; row?: Record<string, unknown> }> {
  if (typeof window === "undefined") return { ok: false, message: "Server unavailable." };
  const headers = await adminAuthHeaders(client);
  if (!headers) return { ok: false, message: "Sign in as admin and try again." };

  const origin = window.location.origin.replace(/\/$/, "");
  const res = await fetch(`${origin}/api/send-mail`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action,
      ...(payload ? { payload } : {}),
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    ok?: boolean;
    message?: string;
    row?: Record<string, unknown>;
  };

  if (!res.ok || json.success === false) {
    return { ok: false, message: json.message || `Request failed (${res.status}).` };
  }
  return { ok: true, row: json.row, message: json.message };
}

async function isRdsTableAvailable(client: SupabaseClient): Promise<boolean> {
  try {
    const { error } = await client.from("project_report_domain_templates").select("id").limit(1);
    if (!error) return true;
    if (isProjectReportTableMissingError(error)) return false;
    return false;
  } catch {
    return false;
  }
}

async function tryBootstrapProjectReportTemplates(client: SupabaseClient): Promise<boolean> {
  await ensureAdminAuthSession(client, { extendWindow: true, attempts: 3 });

  const recheck = () => isRdsTableAvailable(client);

  try {
    const { error } = await client.rpc("admin_ensure_project_report_templates");
    if (!error) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (await recheck()) return true;
    }
  } catch {
    /* RPC optional */
  }

  const bootstrap = await callSendMailAction(client, "ensure_project_report_templates");
  if (bootstrap.ok) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (await recheck()) return true;
  }

  if (typeof window !== "undefined") {
    try {
      const headers = await adminAuthHeaders(client);
      if (headers) {
        const origin = window.location.origin.replace(/\/$/, "");
        const res = await fetch(`${origin}/api/ensure-project-report-templates`, {
          method: "POST",
          headers,
        });
        if (res.ok) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          if (await recheck()) return true;
        }
      }
    } catch {
      /* optional */
    }
  }

  return false;
}

/** Create project_report_domain_templates on RDS when missing. Never throws. */
export async function ensureProjectReportTemplatesTable(client: SupabaseClient): Promise<boolean> {
  if (await isRdsTableAvailable(client)) return true;
  if (await tryBootstrapProjectReportTemplates(client)) return true;
  return projectReportFallbackWritable(client);
}

export async function fetchProjectReportDomainTemplates(
  client: SupabaseClient
): Promise<ProjectReportDomainTemplate[]> {
  const fallbackRows = await fetchProjectReportFallbackTemplates(client);

  try {
    await ensureProjectReportTemplatesTable(client);
    const { data, error } = await client
      .from("project_report_domain_templates")
      .select("*")
      .order("domain_name", { ascending: true });
    if (error) {
      if (isProjectReportTableMissingError(error)) return fallbackRows;
      throw error;
    }
    return mergeTemplates(
      (data || []).map((row) => rowToTemplate(row as Record<string, unknown>)),
      fallbackRows
    );
  } catch (err) {
    if (isProjectReportTableMissingError(err)) return fallbackRows;
    throw err;
  }
}

export async function fetchProjectReportDomainTemplate(
  client: SupabaseClient,
  domain: string
): Promise<ProjectReportDomainTemplate | null> {
  const domainKey = normalizeProjectReportDomainKey(domain);
  if (!domainKey) return null;

  const all = await fetchProjectReportDomainTemplates(client);
  const exact = all.find((row) => row.domain_key === domainKey);
  if (exact) return exact;

  const fuzzy = all.find((row) => row.domain_name.toLowerCase() === domain.trim().toLowerCase());
  return fuzzy || null;
}

async function saveToRds(
  client: SupabaseClient,
  payload: {
    domain_name: string;
    domain_key: string;
    template_pdf_path: string;
    template_pdf_url: string;
    template_file_name: string;
    updated_by?: string | null;
  }
): Promise<ProjectReportDomainTemplate | null> {
  const saveViaApi = await callSendMailAction(client, "save_project_report_template", payload);
  if (saveViaApi.ok && saveViaApi.row) {
    return rowToTemplate(saveViaApi.row);
  }

  const { data, error } = await client
    .from("project_report_domain_templates")
    .upsert(
      {
        domain_name: payload.domain_name,
        domain_key: payload.domain_key,
        template_pdf_path: payload.template_pdf_path,
        template_pdf_url: payload.template_pdf_url,
        template_file_name: payload.template_file_name,
        updated_by: payload.updated_by || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "domain_key" }
    )
    .select("*")
    .single();

  if (error) {
    if (isProjectReportTableMissingError(error)) return null;
    throw new Error(error.message || "Could not save template to database.");
  }
  return rowToTemplate(data as Record<string, unknown>);
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

  await validateProjectReportPdfFile(params.file);

  const sessionOk = await ensureAdminAuthSession(client, { extendWindow: true, attempts: 4 });
  if (!sessionOk) {
    throw new Error("Your admin session expired. Refresh the page, sign in again, then retry the upload.");
  }

  await ensureProjectReportTemplatesTable(client);

  const existing = await fetchProjectReportDomainTemplate(client, domainName);
  if (existing?.template_pdf_path) {
    await client.storage.from(BUCKET).remove([existing.template_pdf_path]).catch(() => undefined);
  }

  const safeName = params.file.name.replace(/[^\w.-]+/g, "_").slice(0, 120);
  const path = `project-report-templates/${domainKey.replace(/\s+/g, "-")}/${Date.now()}-${safeName}`;

  const { error: uploadErr } = await client.storage.from(BUCKET).upload(path, params.file, {
    upsert: true,
    contentType: "application/pdf",
  });
  if (uploadErr) {
    if (/bucket not found/i.test(uploadErr.message)) {
      throw new Error('Storage bucket "consent-forms" is missing. Contact support to provision storage.');
    }
    throw new Error(uploadErr.message || "Failed to upload template PDF.");
  }

  const { data: pub } = client.storage.from(BUCKET).getPublicUrl(path);
  const cleanUrl =
    publicStorageObjectUrl(BUCKET, path) ||
    resolveStorageUrl(pub.publicUrl) ||
    pub.publicUrl;
  const publicUrl = `${String(cleanUrl).split("?")[0]}?v=${Date.now()}`;

  const metadata = {
    domain_name: domainName,
    domain_key: domainKey,
    template_pdf_path: path,
    template_pdf_url: publicUrl,
    template_file_name: params.file.name,
    updated_by: params.uploadedBy || null,
  };

  let saved: ProjectReportDomainTemplate | null = null;

  if (await isRdsTableAvailable(client)) {
    saved = await saveToRds(client, metadata).catch(() => null);
  } else {
    await tryBootstrapProjectReportTemplates(client);
    if (await isRdsTableAvailable(client)) {
      saved = await saveToRds(client, metadata).catch(() => null);
    }
  }

  if (!saved) {
    saved = await upsertProjectReportFallbackTemplate(client, {
      ...metadata,
      template_pdf_path: path,
      template_pdf_url: publicUrl,
      template_file_name: params.file.name,
    });
  }

  const verifyBytes = await resolveTemplatePdfBytes(saved).catch(() => null);
  if (!verifyBytes || verifyBytes.byteLength < 100) {
    throw new Error("Uploaded PDF could not be verified. Please try uploading again.");
  }

  return saved;
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
