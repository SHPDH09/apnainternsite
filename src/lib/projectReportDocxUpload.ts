import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAdminAuthSession } from "@/lib/adminAuthSession";

const MAX_DOCX_BYTES = 20 * 1024 * 1024;

export function isProjectReportDocxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (name.endsWith(".docx") || name.endsWith(".doc")) return true;
  return (
    type.includes("wordprocessingml") ||
    type === "application/msword" ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export function isProjectReportPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === "application/pdf" || file.type === "application/x-pdf" || name.endsWith(".pdf");
}

/** Accept Word or PDF before upload / conversion. */
export async function validateProjectReportTemplateFile(file: File): Promise<void> {
  if (!file || file.size <= 0) {
    throw new Error("Please choose a Word (.docx) or PDF file to upload.");
  }
  if (file.size > MAX_DOCX_BYTES) {
    throw new Error("Template file must be 20 MB or smaller.");
  }
  if (!isProjectReportDocxFile(file) && !isProjectReportPdfFile(file)) {
    throw new Error("Project report template must be a Word (.docx) or PDF file.");
  }
}

async function adminBearerToken(client: SupabaseClient): Promise<string> {
  await ensureAdminAuthSession(client, { extendWindow: true, attempts: 3 });
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token?.trim();
  if (!token) {
    throw new Error("Your admin session expired. Refresh the page and sign in again.");
  }
  return token;
}

function resolveConvertApiUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, "")}/api/project-report-docx-to-pdf`;
  }
  return "/api/project-report-docx-to-pdf";
}

/** Convert admin Word upload to PDF via API (LibreOffice on server). */
export async function convertProjectReportDocxToPdfFile(
  client: SupabaseClient,
  file: File
): Promise<File> {
  if (!isProjectReportDocxFile(file)) return file;

  const token = await adminBearerToken(client);
  const form = new FormData();
  form.append("file", file, file.name);

  const res = await fetch(resolveConvertApiUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    let message = `Word to PDF conversion failed (${res.status}).`;
    try {
      const json = (await res.json()) as { message?: string };
      if (json.message) message = json.message;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) message = text.slice(0, 400);
    }
    throw new Error(
      `${message} You can also open the document in Microsoft Word and use Save as PDF, then upload the PDF.`
    );
  }

  const pdfBlob = await res.blob();
  if (!pdfBlob.size) {
    throw new Error("Word conversion returned an empty PDF.");
  }
  const pdfName = file.name.replace(/\.docx?$/i, ".pdf");
  return new File([pdfBlob], pdfName, { type: "application/pdf" });
}

export async function prepareProjectReportTemplatePdfFile(
  client: SupabaseClient,
  file: File
): Promise<File> {
  await validateProjectReportTemplateFile(file);
  if (isProjectReportPdfFile(file)) {
    return file;
  }
  return convertProjectReportDocxToPdfFile(client, file);
}
