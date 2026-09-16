import { PDFDocument } from "pdf-lib";
import {
  generateProjectReportFrontPagesPdf,
  type ProjectReportFrontPageInput,
} from "@/lib/projectReportFrontPages";

export const PROJECT_REPORT_FRONT_PAGE_COUNT = 7;

/** Prepend 7 template pages before the student's uploaded project report PDF. */
export async function mergeProjectReportWithFrontPages(
  frontInput: ProjectReportFrontPageInput,
  uploadedPdfBytes: ArrayBuffer | Uint8Array
): Promise<Blob> {
  const frontBytes = await generateProjectReportFrontPagesPdf(frontInput);
  const merged = await PDFDocument.create();

  const frontDoc = await PDFDocument.load(frontBytes);
  const bodyDoc = await PDFDocument.load(uploadedPdfBytes);

  const frontPages = await merged.copyPages(frontDoc, frontDoc.getPageIndices());
  for (const page of frontPages) merged.addPage(page);

  const bodyPages = await merged.copyPages(bodyDoc, bodyDoc.getPageIndices());
  for (const page of bodyPages) merged.addPage(page);

  const bytes = await merged.save();
  return new Blob([bytes], { type: "application/pdf" });
}

export async function fetchPdfBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load PDF (${res.status}).`);
  return res.arrayBuffer();
}
