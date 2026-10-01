import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectReportMode } from "@/lib/projectReportDomainContent";
import type { ProjectReportFrontPageInput } from "@/lib/projectReportFrontPages";
import { mergeProjectReportWithFrontPages } from "@/lib/projectReportMerge";
import { resolveUniversityLogoFromList } from "@/lib/projectReportUniversityInfo";
import { resolveStudentDocumentFields } from "@/lib/studentPortalDocuments";
import { resolveStorageUrl } from "@/lib/storageUrl";
import { updateOwnStudentProfile } from "@/lib/updateOwnStudentProfile";
import { CONSENT_LETTER_MAX_BYTES } from "@/lib/studentDocuments";

export const PROJECT_REPORT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

function metaOf(profile: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const m = profile?.metadata;
  return m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
}

export function getStudentProjectReportUploadUrl(profile: Record<string, unknown> | null | undefined): string | null {
  const url = metaOf(profile).project_report_upload_url;
  if (typeof url === "string" && url.trim()) return resolveStorageUrl(url.trim());
  return null;
}

export function getStudentProjectReportMergedUrl(profile: Record<string, unknown> | null | undefined): string | null {
  const url = metaOf(profile).project_report_merged_url;
  if (typeof url === "string" && url.trim()) return resolveStorageUrl(url.trim());
  return null;
}

export function getStudentProjectReportMode(profile: Record<string, unknown> | null | undefined): ProjectReportMode {
  const raw = String(metaOf(profile).project_report_mode || profile?.internship_mode || "Hybrid").trim();
  if (/^online$/i.test(raw)) return "Online";
  if (/^offline$/i.test(raw)) return "Offline";
  return "Hybrid";
}

export function isAllowedProjectReportFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type === "application/pdf") return true;
  return /\.pdf$/i.test(file.name || "");
}

export function buildProjectReportFrontPageInput(
  profile: Record<string, unknown> | null | undefined,
  mode: ProjectReportMode,
  universities: Array<{ name: string; logo_url?: string | null }>
): ProjectReportFrontPageInput {
  const fields = resolveStudentDocumentFields(profile);
  const universityName = fields.university;
  const now = new Date();
  const monthYear = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return {
    universityName,
    universityLogoUrl: resolveUniversityLogoFromList(universityName, universities),
    domain: fields.domain,
    mode,
    studentName: fields.studentName,
    collegeName: fields.collegeName,
    departmentName: fields.subject !== "—" ? fields.subject : fields.course,
    programme: fields.programSemester,
    collegeRollNumber: fields.rollNumber,
    universityRollNumber: fields.universityRollNumber || fields.universityRegistrationNumber,
    semester: fields.semester,
    session: fields.session,
    monthYear,
  };
}

async function uploadProjectReportPdf(
  client: SupabaseClient,
  file: Blob | File,
  pathKey: string,
  filename: string
): Promise<string> {
  const safeKey = pathKey.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "upload";
  const filePath = `project-reports/${safeKey}-${Date.now()}-${filename.replace(/[^\w.-]+/g, "_")}`;

  const errors: string[] = [];
  for (const bucket of ["consent-forms", "learning-materials"] as const) {
    const { error } = await client.storage.from(bucket).upload(filePath, file, {
      upsert: true,
      contentType: "application/pdf",
      cacheControl: "3600",
    });
    if (!error) {
      const { data } = client.storage.from(bucket).getPublicUrl(filePath);
      if (data?.publicUrl) return data.publicUrl;
      errors.push(`${bucket}: upload ok but public URL missing`);
      continue;
    }
    errors.push(`${bucket}: ${error.message || "upload failed"}`);
  }
  throw new Error(`Could not upload project report. ${errors.join(" | ")}`);
}

export async function saveStudentProjectReport(
  client: SupabaseClient,
  userId: string,
  profile: Record<string, unknown> | null | undefined,
  file: File,
  mode: ProjectReportMode,
  universities: Array<{ name: string; logo_url?: string | null }>
): Promise<{ uploadUrl: string; mergedUrl: string }> {
  if (file.size > PROJECT_REPORT_UPLOAD_MAX_BYTES) {
    throw new Error("Project report must be 25 MB or smaller.");
  }
  if (!isAllowedProjectReportFile(file)) {
    throw new Error("Upload a PDF file for your project report.");
  }

  const frontInput = buildProjectReportFrontPageInput(profile, mode, universities);
  const uploadedBytes = await file.arrayBuffer();
  const mergedBlob = await mergeProjectReportWithFrontPages(frontInput, uploadedBytes);

  const email = String(profile?.email || userId);
  const uploadUrl = await uploadProjectReportPdf(client, file, email, "raw.pdf");
  const mergedUrl = await uploadProjectReportPdf(client, mergedBlob, email, "merged.pdf");

  const meta = { ...metaOf(profile) };
  await updateOwnStudentProfile(client, userId, {
    metadata: {
      ...meta,
      project_report_upload_url: uploadUrl,
      project_report_merged_url: mergedUrl,
      project_report_mode: mode,
      project_report_uploaded_at: new Date().toISOString(),
    },
  });

  return { uploadUrl, mergedUrl };
}

export async function buildMergedProjectReportBlob(
  profile: Record<string, unknown> | null | undefined,
  universities: Array<{ name: string; logo_url?: string | null }>
): Promise<Blob | null> {
  const uploadUrl = getStudentProjectReportUploadUrl(profile);
  if (!uploadUrl) return null;
  const mode = getStudentProjectReportMode(profile);
  const frontInput = buildProjectReportFrontPageInput(profile, mode, universities);
  const res = await fetch(uploadUrl);
  if (!res.ok) throw new Error("Could not load uploaded project report.");
  const bytes = await res.arrayBuffer();
  return mergeProjectReportWithFrontPages(frontInput, bytes);
}
