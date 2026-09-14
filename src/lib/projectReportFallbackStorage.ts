import type { SupabaseClient } from "@supabase/supabase-js";
import { publicStorageObjectUrl } from "@/lib/storageUrl";
import type { ProjectReportDomainTemplate, ProjectReportFieldLayout } from "@/lib/projectReportTypes";

const DEFAULT_FIELD_LAYOUT: ProjectReportFieldLayout = {
  logo: { page: 0, x: 72, y: 720, width: 72, height: 72 },
  universityName: { page: 0, x: 160, y: 760, size: 16, maxWidth: 360 },
  domain: { page: 0, x: 72, y: 640, size: 12 },
  mode: { page: 0, x: 72, y: 620, size: 12 },
  domainContent: { page: 1, x: 72, y: 720, width: 460, size: 10, lineHeight: 14 },
};

const FALLBACK_MARKER = "__apna_project_report_templates_v1__";
const FALLBACK_BUCKET = "consent-forms";
const FALLBACK_OBJECT_PATH = "admin/project-report-domain-templates.json";

type FallbackEnvelope = {
  [FALLBACK_MARKER]?: ProjectReportDomainTemplate[];
};

function errorText(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { message?: string; details?: string; code?: string };
    return [e.message, e.details, e.code].filter(Boolean).join(" — ");
  }
  return error instanceof Error ? error.message : String(error ?? "");
}

export function isProjectReportTableMissingError(error: unknown): boolean {
  const msg = errorText(error);
  return (
    /42P01|undefined_table/i.test(msg) ||
    /relation ["']?public\.project_report_domain_templates["']? does not exist/i.test(msg) ||
    /Could not find the table ['"]public\.project_report_domain_templates['"]/i.test(msg) ||
    (/project_report_domain_templates/i.test(msg) && /does not exist/i.test(msg))
  );
}

function parseLayout(raw: unknown): ProjectReportFieldLayout {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_FIELD_LAYOUT };
  }
  return { ...DEFAULT_FIELD_LAYOUT, ...(raw as ProjectReportFieldLayout) };
}

function normalizeRow(raw: Record<string, unknown>): ProjectReportDomainTemplate {
  const domainKey = String(raw.domain_key || "").trim();
  return {
    id: String(raw.id || `fallback-${domainKey || crypto.randomUUID()}`),
    domain_name: String(raw.domain_name || ""),
    domain_key: domainKey,
    template_pdf_path: raw.template_pdf_path ? String(raw.template_pdf_path) : null,
    template_pdf_url: raw.template_pdf_url ? String(raw.template_pdf_url) : null,
    template_file_name: raw.template_file_name ? String(raw.template_file_name) : null,
    field_layout: parseLayout(raw.field_layout),
    updated_at: raw.updated_at ? String(raw.updated_at) : new Date().toISOString(),
  };
}

function isReadUnavailable(error: unknown): boolean {
  return /not found|404|does not exist|not implemented|not_found|403|401|forbidden/i.test(
    errorText(error)
  );
}

async function readFallbackJson(client: SupabaseClient): Promise<ProjectReportDomainTemplate[]> {
  const candidates: string[] = [];
  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/$/, "");
    candidates.push(`${origin}/storage/v1/object/public/${FALLBACK_BUCKET}/${FALLBACK_OBJECT_PATH}`);
  }
  const viaHelper = publicStorageObjectUrl(FALLBACK_BUCKET, FALLBACK_OBJECT_PATH);
  if (viaHelper && !candidates.includes(viaHelper)) candidates.push(viaHelper);

  for (const url of candidates) {
    try {
      const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const parsed = JSON.parse(await res.text()) as FallbackEnvelope;
        const rows = parsed[FALLBACK_MARKER];
        if (!Array.isArray(rows)) return [];
        return rows.map((row) => normalizeRow(row as unknown as Record<string, unknown>));
      }
    } catch (err) {
      if (!isReadUnavailable(err)) continue;
    }
  }

  try {
    const { data, error } = await client.storage.from(FALLBACK_BUCKET).download(FALLBACK_OBJECT_PATH);
    if (error) {
      if (isReadUnavailable(error)) return [];
      throw error;
    }
    const parsed = JSON.parse(await data.text()) as FallbackEnvelope;
    const rows = parsed[FALLBACK_MARKER];
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => normalizeRow(row as unknown as Record<string, unknown>));
  } catch (err) {
    if (isReadUnavailable(err)) return [];
    throw err;
  }
}

async function writeFallbackJson(
  client: SupabaseClient,
  rows: ProjectReportDomainTemplate[]
): Promise<void> {
  const payload: FallbackEnvelope = {
    [FALLBACK_MARKER]: rows.map((row) => ({
      ...row,
      updated_at: row.updated_at || new Date().toISOString(),
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const { error } = await client.storage.from(FALLBACK_BUCKET).upload(FALLBACK_OBJECT_PATH, blob, {
    upsert: true,
    contentType: "application/json",
  });
  if (error) throw error;
}

export async function fetchProjectReportFallbackTemplates(
  client: SupabaseClient
): Promise<ProjectReportDomainTemplate[]> {
  try {
    const rows = await readFallbackJson(client);
    return rows.sort((a, b) => a.domain_name.localeCompare(b.domain_name));
  } catch {
    return [];
  }
}

export async function upsertProjectReportFallbackTemplate(
  client: SupabaseClient,
  row: Omit<ProjectReportDomainTemplate, "id" | "field_layout"> & {
    id?: string;
    field_layout?: ProjectReportFieldLayout;
  }
): Promise<ProjectReportDomainTemplate> {
  const existing = await readFallbackJson(client);
  const domainKey = row.domain_key.trim();
  const saved = normalizeRow({
    ...row,
    id: row.id || `fallback-${domainKey}`,
    domain_key: domainKey,
    field_layout: row.field_layout || DEFAULT_FIELD_LAYOUT,
    updated_at: new Date().toISOString(),
  });
  const next = existing.filter((r) => r.domain_key !== domainKey);
  next.push(saved);
  await writeFallbackJson(client, next.sort((a, b) => a.domain_name.localeCompare(b.domain_name)));
  return saved;
}

/** PDF templates already upload to consent-forms — fallback JSON uses the same bucket. */
export async function projectReportFallbackWritable(_client: SupabaseClient): Promise<boolean> {
  return true;
}
