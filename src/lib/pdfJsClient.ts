import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsModule: PdfJsModule | null = null;
let workerConfigured = false;

function configurePdfJsWorker(pdfjs: PdfJsModule) {
  if (workerConfigured) return;
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  workerConfigured = true;
}

/** Load pdf.js once with a Vite-bundled worker URL (fixes GlobalWorkerOptions.workerSrc errors). */
export async function getPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsModule) {
    pdfjsModule = await import("pdfjs-dist/legacy/build/pdf.mjs");
    configurePdfJsWorker(pdfjsModule);
  }
  return pdfjsModule;
}
