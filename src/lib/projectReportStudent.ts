import { supabase } from "@/integrations/supabase/client";
import {
  buildDocumentPlaceholderValues,
  formatMissingPlaceholderMessage,
  PROJECT_REPORT_DOMAIN_UNAVAILABLE,
  validateDocumentPlaceholders,
} from "@/lib/studentDocumentPlaceholders";
import { resolveStudentDocumentFields } from "@/lib/studentPortalDocuments";
import {
  fetchProjectReportDomainTemplate,
  normalizeProjectReportDomainKey,
} from "@/lib/projectReportSettings";
import { generateProjectReportPdfBlob } from "@/lib/projectReportPdf";
import type { ProjectReportMode } from "@/lib/projectReportDomainContent";

export class ProjectReportGenerationError extends Error {
  constructor(
    message: string,
    readonly code: "no_template" | "missing_fields" | "generate_failed" = "generate_failed"
  ) {
    super(message);
    this.name = "ProjectReportGenerationError";
  }
}

function resolveMode(raw: string): ProjectReportMode {
  const m = raw.trim().toLowerCase();
  if (m.includes("offline")) return "Offline";
  if (m.includes("hybrid")) return "Hybrid";
  return "Online";
}

export async function generateStudentProjectReportBlob(
  profile: Record<string, unknown> | null | undefined,
  options?: {
    certificateNumber?: string | null;
    supervisorName?: string | null;
    universityLogoUrl?: string | null;
  }
): Promise<{ blob: Blob; templateVersion?: number; domainKey: string }> {
  const fields = resolveStudentDocumentFields(profile);
  const domain = fields.domain?.trim();
  if (!domain || domain === "—") {
    throw new ProjectReportGenerationError(
      "Internship domain is not set on your profile.",
      "missing_fields"
    );
  }

  const placeholders = buildDocumentPlaceholderValues(fields, {
    certificateNumber: options?.certificateNumber,
    supervisorName: options?.supervisorName,
  });
  const validation = validateDocumentPlaceholders(placeholders);
  if (!validation.ok) {
    throw new ProjectReportGenerationError(
      formatMissingPlaceholderMessage(validation.missing),
      "missing_fields"
    );
  }

  const template = await fetchProjectReportDomainTemplate(supabase, domain).catch(() => null);
  const domainKey = template?.domain_key || normalizeProjectReportDomainKey(domain);
  if (!template?.template_pdf_url && !template?.template_pdf_path) {
    throw new ProjectReportGenerationError(PROJECT_REPORT_DOMAIN_UNAVAILABLE, "no_template");
  }

  try {
    const blob = await generateProjectReportPdfBlob(
      template,
      {
        universityName: fields.university,
        universityLogoUrl: options?.universityLogoUrl ?? null,
        domain,
        mode: resolveMode(fields.mode),
        placeholders,
      },
      null
    );
    const templateVersion =
      template.field_layout?.template_version ?? template.template_version ?? undefined;
    return { blob, templateVersion, domainKey };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ProjectReportGenerationError(msg || "Could not generate project report.", "generate_failed");
  }
}

export async function downloadStudentProjectReport(
  profile: Record<string, unknown> | null | undefined,
  options?: Parameters<typeof generateStudentProjectReportBlob>[1]
): Promise<void> {
  const { blob } = await generateStudentProjectReportBlob(profile, options);
  const fields = resolveStudentDocumentFields(profile);
  const safeName = fields.studentName.replace(/[^\w.-]+/g, "_").slice(0, 40);
  const safeDomain = fields.domain.replace(/[^\w.-]+/g, "_").slice(0, 30);
  const filename = `Project_Report_${safeName}_${safeDomain}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function previewStudentProjectReportUrl(
  profile: Record<string, unknown> | null | undefined,
  options?: Parameters<typeof generateStudentProjectReportBlob>[1]
): Promise<string> {
  const { blob } = await generateStudentProjectReportBlob(profile, options);
  return URL.createObjectURL(blob);
}
