import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import {
  DEFAULT_PROJECT_REPORT_FIELD_LAYOUT,
  type ProjectReportFieldLayout,
  type ProjectReportSettings,
  resolveTemplatePdfBytes,
  resolveUniversityLogoBytes,
} from "@/lib/projectReportSettings";
import {
  resolveProjectReportDomainContent,
  type ProjectReportDomainSection,
  type ProjectReportMode,
} from "@/lib/projectReportDomainContent";
import { downloadHtmlDocumentPdf } from "@/lib/studentDocumentPdf";

export type ProjectReportGenerateInput = {
  universityName: string;
  universityLogoUrl?: string | null;
  domain: string;
  mode: ProjectReportMode;
};

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function embedLogo(pdfDoc: PDFDocument, logoBytes: Uint8Array | null) {
  if (!logoBytes?.length) return null;
  try {
    return await pdfDoc.embedPng(logoBytes);
  } catch {
    try {
      return await pdfDoc.embedJpg(logoBytes);
    } catch {
      return null;
    }
  }
}

function drawLines(
  page: PDFPage,
  font: PDFFont,
  lines: string[],
  x: number,
  startY: number,
  size: number,
  lineHeight: number,
  color = rgb(0.1, 0.1, 0.15)
) {
  let y = startY;
  for (const line of lines) {
    page.drawText(line, { x, y, size, font, color });
    y -= lineHeight;
  }
  return y;
}

function buildDomainContentLines(section: ProjectReportDomainSection, font: PDFFont, layoutWidth: number, size: number): string[] {
  const maxWidth = layoutWidth;
  const out: string[] = [];
  const pushBlock = (heading: string, body: string) => {
    out.push(heading);
    out.push(...wrapText(body, font, size, maxWidth));
    out.push("");
  };
  pushBlock("1. Introduction", section.introduction);
  pushBlock("2. Objectives", section.objectives.map((o, i) => `${i + 1}. ${o}`).join(" "));
  pushBlock("3. Scope", section.scope);
  pushBlock("4. Methodology", section.methodology);
  pushBlock(
    "5. Tools & Technologies",
    section.toolsTechnologies.join(", ")
  );
  pushBlock(
    "6. Expected Outcomes",
    section.expectedOutcomes.map((o, i) => `${i + 1}. ${o}`).join(" ")
  );
  pushBlock("7. Conclusion", section.conclusion);
  return out.filter((l, i, arr) => !(l === "" && arr[i + 1] === ""));
}

async function overlayDynamicFields(
  pdfDoc: PDFDocument,
  input: ProjectReportGenerateInput,
  layout: ProjectReportFieldLayout,
  logoBytes: Uint8Array | null
) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const section = resolveProjectReportDomainContent(input.domain);

  const logoLayout = layout.logo || DEFAULT_PROJECT_REPORT_FIELD_LAYOUT.logo!;
  const logoPage = pages[logoLayout.page] || pages[0];
  const logoImage = await embedLogo(pdfDoc, logoBytes);
  if (logoImage && logoPage) {
    logoPage.drawImage(logoImage, {
      x: logoLayout.x,
      y: logoLayout.y,
      width: logoLayout.width,
      height: logoLayout.height,
    });
  }

  const nameLayout = layout.universityName || DEFAULT_PROJECT_REPORT_FIELD_LAYOUT.universityName!;
  const namePage = pages[nameLayout.page] || pages[0];
  if (namePage) {
    const nameLines = wrapText(
      input.universityName,
      fontBold,
      nameLayout.size,
      nameLayout.maxWidth || 360
    );
    drawLines(namePage, fontBold, nameLines, nameLayout.x, nameLayout.y, nameLayout.size, nameLayout.size + 4);
  }

  const domainLayout = layout.domain || DEFAULT_PROJECT_REPORT_FIELD_LAYOUT.domain!;
  const domainPage = pages[domainLayout.page] || pages[0];
  if (domainPage) {
    domainPage.drawText(`Domain: ${input.domain}`, {
      x: domainLayout.x,
      y: domainLayout.y,
      size: domainLayout.size,
      font: fontBold,
      color: rgb(0.12, 0.25, 0.55),
    });
    domainPage.drawText(`Project: ${section.projectTitle}`, {
      x: domainLayout.x,
      y: domainLayout.y - 16,
      size: domainLayout.size,
      font,
    });
  }

  const modeLayout = layout.mode || DEFAULT_PROJECT_REPORT_FIELD_LAYOUT.mode!;
  const modePage = pages[modeLayout.page] || pages[0];
  if (modePage) {
    modePage.drawText(`Mode: ${input.mode}`, {
      x: modeLayout.x,
      y: modeLayout.y,
      size: modeLayout.size,
      font: fontBold,
      color: rgb(0.12, 0.25, 0.55),
    });
  }

  const contentLayout = layout.domainContent || DEFAULT_PROJECT_REPORT_FIELD_LAYOUT.domainContent!;
  const contentPage = pages[contentLayout.page];
  if (contentPage) {
    const lines = buildDomainContentLines(section, font, contentLayout.width, contentLayout.size);
    drawLines(
      contentPage,
      font,
      lines,
      contentLayout.x,
      contentLayout.y,
      contentLayout.size,
      contentLayout.lineHeight
    );
  }
}

/** Generate PDF from uploaded template + dynamic overlays. Falls back to HTML render when no template. */
export async function generateProjectReportPdfBlob(
  settings: ProjectReportSettings | null,
  input: ProjectReportGenerateInput,
  htmlFallbackElement?: HTMLElement | null
): Promise<Blob> {
  const templateBytes = settings ? await resolveTemplatePdfBytes(settings).catch(() => null) : null;
  const logoBytes = await resolveUniversityLogoBytes(input.universityLogoUrl);
  const layout = settings?.field_layout || DEFAULT_PROJECT_REPORT_FIELD_LAYOUT;

  if (templateBytes) {
    const pdfDoc = await PDFDocument.load(templateBytes);
    await overlayDynamicFields(pdfDoc, input, layout, logoBytes);
    const bytes = await pdfDoc.save();
    return new Blob([bytes], { type: "application/pdf" });
  }

  if (htmlFallbackElement) {
    const { jsPDF } = await import("jspdf");
    const html2canvas = (await import("html2canvas")).default;
    const { DOCUMENT_PAGE } = await import("@/components/student/StudentDocumentLayout");

    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-10000px";
    wrapper.style.top = "0";
    wrapper.style.background = "#ffffff";
    wrapper.style.zIndex = "-1";
    const clone = htmlFallbackElement.cloneNode(true) as HTMLElement;
    clone.style.width = `${DOCUMENT_PAGE.captureWidthPx}px`;
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      return pdf.output("blob");
    } finally {
      document.body.removeChild(wrapper);
    }
  }

  throw new Error("Upload a project report template PDF or use preview to generate.");
}

export async function downloadProjectReportPdf(
  settings: ProjectReportSettings | null,
  input: ProjectReportGenerateInput,
  htmlFallbackElement?: HTMLElement | null
): Promise<void> {
  const blob = await generateProjectReportPdfBlob(settings, input, htmlFallbackElement);
  const safeUni = input.universityName.replace(/[^\w.-]+/g, "_").slice(0, 40);
  const safeDomain = input.domain.replace(/[^\w.-]+/g, "_").slice(0, 30);
  const filename = `Project_Report_${safeUni}_${safeDomain}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function previewProjectReportPdfUrl(
  settings: ProjectReportSettings | null,
  input: ProjectReportGenerateInput,
  htmlFallbackElement?: HTMLElement | null
): Promise<string> {
  const blob = await generateProjectReportPdfBlob(settings, input, htmlFallbackElement);
  return URL.createObjectURL(blob);
}

export { downloadHtmlDocumentPdf };
