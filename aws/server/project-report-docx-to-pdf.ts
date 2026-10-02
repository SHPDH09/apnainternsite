import { promisify } from "node:util";

const MAX_DOCX_BYTES = 20 * 1024 * 1024;

export function isDocxFileName(name: string): boolean {
  const lower = String(name || "").toLowerCase();
  return lower.endsWith(".docx") || lower.endsWith(".doc");
}

export function isDocxMime(type: string, fileName: string): boolean {
  const t = String(type || "").toLowerCase();
  if (
    t.includes("wordprocessingml") ||
    t === "application/msword" ||
    t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return true;
  }
  return isDocxFileName(fileName);
}

export async function convertDocxBufferToPdf(docx: Buffer): Promise<Buffer> {
  if (!docx.length) throw new Error("Word file is empty.");
  if (docx.length > MAX_DOCX_BYTES) {
    throw new Error("Word file must be 20 MB or smaller.");
  }

  type LibreConvert = {
    convert: (
      document: Buffer,
      format: string,
      filter: undefined,
      callback: (err: Error | null, result: Buffer) => void
    ) => void;
  };

  let libre: LibreConvert;
  try {
    const mod = await import("libreoffice-convert");
    libre = (mod.default ?? mod) as LibreConvert;
  } catch {
    throw new Error(
      "Word conversion is not installed on this server. Save the document as PDF from Microsoft Word and upload the PDF instead."
    );
  }

  const convertAsync = promisify(libre.convert.bind(libre)) as (
    document: Buffer,
    format: string,
    filter: undefined
  ) => Promise<Buffer>;

  try {
    const pdf = await convertAsync(docx, ".pdf", undefined);
    if (!pdf?.length || pdf.length < 100) {
      throw new Error("Word conversion produced an empty PDF.");
    }
    const magic = pdf.subarray(0, 5).toString("ascii");
    if (!magic.startsWith("%PDF")) {
      throw new Error("Word conversion did not produce a valid PDF.");
    }
    return pdf;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/libreoffice|soffice|ENOENT|spawn/i.test(msg)) {
      throw new Error(
        "Word conversion requires LibreOffice on the server. Save as PDF from Word and upload the PDF, or enable LibreOffice on the API host."
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  }
}
