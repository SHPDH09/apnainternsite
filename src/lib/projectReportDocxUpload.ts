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

async function adminAuthHeaders(client: SupabaseClient): Promise<Record<string, string>> {
  await ensureAdminAuthSession(client, { extendWindow: true, attempts: 3 });
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token?.trim();
  if (!token) {
    throw new Error("Your admin session expired. Refresh the page and sign in again.");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read the Word file."));
        return;
      }
      const base64 = result.includes(",") ? result.split(",").pop() || "" : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read the Word file."));
    reader.readAsDataURL(file);
  });
}

async function convertViaSendMail(client: SupabaseClient, file: File): Promise<File | null> {
  if (typeof window === "undefined") return null;
  const headers = await adminAuthHeaders(client);
  const docx_base64 = await fileToBase64(file);
  const origin = window.location.origin.replace(/\/$/, "");
  const res = await fetch(`${origin}/api/send-mail`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "convert_project_report_docx",
      payload: {
        docx_base64,
        file_name: file.name,
      },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    pdf_base64?: string;
    file_name?: string;
    message?: string;
  };
  if (!res.ok || json.success === false || !json.pdf_base64) {
    return null;
  }
  const binary = atob(json.pdf_base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pdfName = json.file_name || file.name.replace(/\.docx?$/i, ".pdf");
  return new File([bytes], pdfName, { type: "application/pdf" });
}

async function convertViaMultipartApi(client: SupabaseClient, file: File): Promise<File | null> {
  const headers = await adminAuthHeaders(client);
  delete headers["Content-Type"];
  const form = new FormData();
  form.append("file", file, file.name);
  const origin =
    typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
  const res = await fetch(`${origin}/api/project-report-docx-to-pdf`, {
    method: "POST",
    headers: { Authorization: headers.Authorization },
    body: form,
  });
  if (!res.ok) return null;
  const pdfBlob = await res.blob();
  if (!pdfBlob.size) return null;
  return new File([pdfBlob], file.name.replace(/\.docx?$/i, ".pdf"), { type: "application/pdf" });
}

/** Convert admin Word upload to PDF (send-mail first, then direct API). */
export async function convertProjectReportDocxToPdfFile(
  client: SupabaseClient,
  file: File
): Promise<File> {
  if (!isProjectReportDocxFile(file)) return file;

  const viaMail = await convertViaSendMail(client, file).catch(() => null);
  if (viaMail?.size) return viaMail;

  const viaApi = await convertViaMultipartApi(client, file).catch(() => null);
  if (viaApi?.size) return viaApi;

  throw new Error(
    "Word could not be converted to PDF on the server. Save the document as PDF from Microsoft Word (File → Save as PDF) and upload the PDF file instead."
  );
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
