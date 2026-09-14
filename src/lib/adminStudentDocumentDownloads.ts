import type { SupabaseClient } from "@supabase/supabase-js";
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { StudentLogbookDocument } from "@/components/student/StudentLogbookDocument";
import {
  formatDocumentIssueDate,
  resolveStudentDocumentFields,
} from "@/lib/studentPortalDocuments";
import { downloadHtmlDocumentPdf } from "@/lib/studentDocumentPdf";
import { enrichStudentProfileForDisplay } from "@/lib/studentProfileDisplay";
import { parseJsonField } from "@/lib/parseJsonField";
import { certificateDisplayFromRecord } from "@/lib/certificateFormat";
import {
  certificatePdfFilename,
  downloadAdminCertificatePdf,
} from "@/lib/adminCertificatePdf";
import {
  downloadConsentLetterFile,
  getStudentConsentLetterUrl,
} from "@/lib/studentDocuments";
import { downloadStudentAttendanceReportPdf } from "@/lib/adminDownloadAttendanceReport";
import { pickWorkingStorageUrl } from "@/lib/storageUrl";
import type { LearningMaterialRow } from "@/lib/learningMaterialsApi";

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function loadStudentRow(
  client: SupabaseClient,
  student: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const id = String(student.id || "").trim();
  if (!id) return student;
  try {
    const { data } = await client.from("students").select("*").eq("id", id).maybeSingle();
    if (data) return data as Record<string, unknown>;
  } catch {
    /* use partial row */
  }
  return student;
}

export async function downloadAdminStudentLogbookPdf(
  client: SupabaseClient,
  student: Record<string, unknown>
): Promise<void> {
  const row = enrichStudentProfileForDisplay(await loadStudentRow(client, student)) || student;
  const fields = resolveStudentDocumentFields(row);

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;pointer-events:none;width:794px;z-index:-1;";
  document.body.appendChild(host);

  const root = createRoot(host);
  let el: HTMLDivElement | null = null;

  try {
    await new Promise<void>((resolve) => {
      root.render(
        createElement(StudentLogbookDocument, {
          ref: (node: HTMLDivElement | null) => {
            el = node;
          },
          fields,
          issueDate: formatDocumentIssueDate(),
        })
      );
      void waitForPaint().then(resolve);
    });

    if (!el) throw new Error("Could not render logbook.");
    await downloadHtmlDocumentPdf(
      el,
      `Logbook_${(fields.studentName || "Student").replace(/\s+/g, "_")}.pdf`
    );
  } finally {
    root.unmount();
    host.remove();
  }
}

export async function downloadAdminStudentConsentLetter(
  student: Record<string, unknown>
): Promise<void> {
  const url = getStudentConsentLetterUrl(student);
  if (!url) throw new Error("No consent letter on file for this student.");
  const fields = resolveStudentDocumentFields(student);
  await downloadConsentLetterFile(url, fields.studentName || "Student");
}

export async function downloadAdminStudentCertificatePdf(
  client: SupabaseClient,
  student: Record<string, unknown>,
  cert: Record<string, unknown>
): Promise<void> {
  const row = enrichStudentProfileForDisplay(await loadStudentRow(client, student)) || student;
  const data = certificateDisplayFromRecord(row, cert);
  const filename = certificatePdfFilename(
    String(cert.certificate_id || cert.id || ""),
    String(row.full_name || "")
  );
  await downloadAdminCertificatePdf(data, filename);
}

export async function fetchAdminStudentCertificate(
  client: SupabaseClient,
  studentId: string
): Promise<Record<string, unknown> | null> {
  const { data } = await client
    .from("certificates")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

export async function fetchAdminStudentProjectReports(
  client: SupabaseClient,
  student: Record<string, unknown>
): Promise<LearningMaterialRow[]> {
  const row = enrichStudentProfileForDisplay(student) || student;
  const meta = parseJsonField(row.metadata) || {};
  const domain = String(
    row.internship_domain || row.course || meta.course || ""
  ).trim();
  if (!domain) return [];

  const { data } = await client
    .from("learning_materials")
    .select("*")
    .eq("material_type", "project_report")
    .ilike("domain", `%${domain}%`)
    .order("created_at", { ascending: false })
    .limit(5);

  return (data || []) as LearningMaterialRow[];
}

export async function openAdminStudentProjectReport(
  reports: LearningMaterialRow[]
): Promise<void> {
  const report = reports[0];
  if (!report) throw new Error("Project report has not been shared for this student yet.");
  const urls =
    report.file_url_candidates?.length
      ? report.file_url_candidates
      : report.file_url
        ? [report.file_url]
        : [];
  const url = await pickWorkingStorageUrl(urls);
  if (!url) throw new Error("Could not open project report.");
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function downloadAdminStudentProjectReport(
  reports: LearningMaterialRow[]
): Promise<void> {
  const report = reports[0];
  if (!report) throw new Error("Project report has not been shared for this student yet.");
  const urls =
    report.file_url_candidates?.length
      ? report.file_url_candidates
      : report.file_url
        ? [report.file_url]
        : [];
  const url = await pickWorkingStorageUrl(urls);
  if (!url) throw new Error("Could not download project report.");
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not download project report.");
  const blob = await res.blob();
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = report.title?.replace(/\s+/g, "_") || "Project_Report.pdf";
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export { downloadStudentAttendanceReportPdf };
