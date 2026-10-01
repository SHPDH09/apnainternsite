import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import type { ProjectReportMode } from "@/lib/projectReportDomainContent";
import { resolveUniversityLogoBytes } from "@/lib/projectReportSettings";
import {
  resolveUniversityAddress,
  resolveUniversityDisplayName,
} from "@/lib/projectReportUniversityInfo";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BRAND = "Apna Intern SDP Technology Pvt. Ltd., Patna, Bihar";
const IPO = "Internship Programme Office (IPO)";

export type ProjectReportFrontPageInput = {
  universityName: string;
  universityLogoUrl?: string | null;
  domain: string;
  mode: ProjectReportMode;
  studentName?: string;
  collegeName?: string;
  departmentName?: string;
  programme?: string;
  collegeRollNumber?: string;
  universityRollNumber?: string;
  semester?: string;
  session?: string;
  monthYear?: string;
};

type DrawCtx = {
  font: PDFFont;
  fontBold: PDFFont;
  fontItalic: PDFFont;
};

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  size: number,
  font: PDFFont,
  color = rgb(0.08, 0.1, 0.15)
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (PAGE_W - w) / 2, y, size, font, color });
}

function drawWrappedCentered(
  page: PDFPage,
  text: string,
  y: number,
  size: number,
  font: PDFFont,
  maxWidth = CONTENT_W
): number {
  const lines = wrapText(text, font, size, maxWidth);
  let cy = y;
  for (const line of lines) {
    drawCentered(page, line, cy, size, font);
    cy -= size + 4;
  }
  return cy;
}

function drawPageHeader(page: PDFPage, domain: string, ctx: DrawCtx) {
  const label = `Internship Report | ${domain}`;
  drawCentered(page, label, PAGE_H - MARGIN + 8, 9, ctx.font, rgb(0.35, 0.4, 0.48));
}

function drawPageFooter(page: PDFPage, pageNum: number, font: PDFFont) {
  drawCentered(page, `Page ${pageNum}`, MARGIN - 24, 10, font, rgb(0.35, 0.4, 0.48));
}

function drawFieldLine(
  page: PDFPage,
  label: string,
  value: string,
  x: number,
  y: number,
  ctx: DrawCtx,
  lineWidth = 320
) {
  page.drawText(label, { x, y, size: 11, font: ctx.font });
  const labelW = ctx.font.widthOfTextAtSize(label, 11);
  const lineX = x + labelW + 4;
  const display = value && value !== "—" ? value : "";
  if (display) {
    page.drawText(display, { x: lineX, y, size: 11, font: ctx.font });
  }
  page.drawLine({
    start: { x: lineX, y: y - 2 },
    end: { x: x + lineWidth, y: y - 2 },
    thickness: 0.6,
    color: rgb(0.2, 0.22, 0.28),
  });
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

function drawCoverPage(page: PDFPage, input: ProjectReportFrontPageInput, ctx: DrawCtx, logoImage: Awaited<ReturnType<typeof embedLogo>>) {
  drawPageHeader(page, input.domain, ctx);
  let y = PAGE_H - MARGIN - 20;

  if (logoImage) {
    const size = 88;
    page.drawImage(logoImage, {
      x: (PAGE_W - size) / 2,
      y: y - size,
      width: size,
      height: size,
    });
    y -= size + 16;
  } else {
    y -= 20;
  }

  const uniName = resolveUniversityDisplayName(input.universityName);
  y = drawWrappedCentered(page, uniName, y, 14, ctx.fontBold, CONTENT_W - 40) - 4;
  drawWrappedCentered(page, resolveUniversityAddress(input.universityName), y, 10, ctx.font, CONTENT_W - 60);

  y -= 36;
  drawFieldLine(page, "Name of the College:", input.collegeName || "", MARGIN, y, ctx);
  y -= 28;
  drawFieldLine(page, "Name of the Department:", input.departmentName || "", MARGIN, y, ctx);

  y -= 44;
  drawCentered(page, "INTERNSHIP REPORT", y, 16, ctx.fontBold);
  y -= 22;
  drawCentered(page, "on", y, 12, ctx.font);
  y -= 24;
  const domainQuoted = `"${input.domain.toUpperCase()}"`;
  drawWrappedCentered(page, domainQuoted, y, 13, ctx.fontBold, CONTENT_W - 20);
  y -= 28;
  drawCentered(page, `( ${input.mode} Internship Training Programme )`, y, 11, ctx.fontItalic, rgb(0.12, 0.14, 0.2));
  y -= 22;
  drawCentered(
    page,
    `(Month and Year: ${input.monthYear || "____________________________"})`,
    y,
    10,
    ctx.font
  );

  y -= 36;
  drawCentered(page, "Submitted by", y, 11, ctx.fontItalic);

  y -= 28;
  const fieldsX = MARGIN + 20;
  drawFieldLine(page, "Name of the Student:", input.studentName || "", fieldsX, y, ctx, 360);
  y -= 24;
  drawFieldLine(page, "Programme:", input.programme || "", fieldsX, y, ctx, 360);
  y -= 24;
  drawFieldLine(page, "College Roll Number:", input.collegeRollNumber || "", fieldsX, y, ctx, 360);
  y -= 24;
  drawFieldLine(page, "University Roll Number:", input.universityRollNumber || "", fieldsX, y, ctx, 360);
  y -= 24;
  drawFieldLine(page, "Semester:", input.semester || "", fieldsX, y, ctx, 360);
  y -= 24;
  drawFieldLine(page, "Session:", input.session || "", fieldsX, y, ctx, 360);

  drawCentered(page, IPO, MARGIN + 60, 11, ctx.fontBold);
  drawCentered(page, BRAND, MARGIN + 46, 10, ctx.font);
  drawCentered(page, `Submitted to ${uniName}`, MARGIN + 30, 10, ctx.fontItalic);
  drawPageFooter(page, 1, ctx.font);
}

function drawDeclarationPage(page: PDFPage, input: ProjectReportFrontPageInput, ctx: DrawCtx) {
  drawPageHeader(page, input.domain, ctx);
  drawCentered(page, "CANDIDATE DECLARATION", PAGE_H - MARGIN - 30, 14, ctx.fontBold);

  const uniName = resolveUniversityDisplayName(input.universityName);
  const uniAddr = resolveUniversityAddress(input.universityName);
  const paras = [
    `I hereby declare that the internship report entitled "${input.domain}" submitted by me to the Department of ${input.departmentName || "________________"} (College / Institution) affiliated to ${uniName}, ${uniAddr.split(",")[0] || uniAddr}, in partial fulfilment of the requirements for the award of the degree, is a record of original work carried out by me under the guidance and supervision of the ${IPO}, ${BRAND}.`,
    `The internship was completed in ${input.mode.toLowerCase()} mode through live/online classes, assignments, and project work organized by ${BRAND}.`,
    `I further declare that this report has not been submitted elsewhere for any degree or diploma. The work presented is based on my own internship training and project submission. I take full responsibility for the authenticity of the content.`,
    `I understand that any false statement may lead to cancellation of my internship credits as per university rules.`,
  ];

  let y = PAGE_H - MARGIN - 70;
  for (const para of paras) {
    const lines = wrapText(para, ctx.font, 10.5, CONTENT_W);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN, y, size: 10.5, font: ctx.font });
      y -= 14;
    }
    y -= 8;
  }

  y -= 10;
  page.drawRectangle({
    x: MARGIN,
    y: y - 100,
    width: CONTENT_W,
    height: 110,
    borderColor: rgb(0.2, 0.22, 0.28),
    borderWidth: 0.8,
  });
  const boxY = y - 20;
  drawFieldLine(page, "Place:", "", MARGIN + 12, boxY, ctx, 200);
  drawFieldLine(page, "Date:", "", MARGIN + 12, boxY - 22, ctx, 200);
  drawFieldLine(page, "College Roll No.:", input.collegeRollNumber || "", MARGIN + 12, boxY - 44, ctx, 200);
  drawFieldLine(page, "University Roll No.:", input.universityRollNumber || "", MARGIN + 12, boxY - 66, ctx, 200);

  const sigX = PAGE_W - MARGIN - 180;
  page.drawLine({
    start: { x: sigX, y: boxY - 10 },
    end: { x: sigX + 160, y: boxY - 10 },
    thickness: 0.6,
    color: rgb(0.2, 0.22, 0.28),
  });
  page.drawText("Signature of the Candidate", { x: sigX + 20, y: boxY - 26, size: 10, font: ctx.font });
  drawFieldLine(page, "(Name:", input.studentName || "", sigX, boxY - 48, ctx, 160);

  drawPageFooter(page, 2, ctx.font);
}

function drawPlaceholderPage(
  page: PDFPage,
  input: ProjectReportFrontPageInput,
  ctx: DrawCtx,
  title: string,
  subtitle: string,
  placeholder: string,
  pageNum: number
) {
  drawPageHeader(page, input.domain, ctx);
  drawCentered(page, title, PAGE_H - MARGIN - 40, 14, ctx.fontBold);
  drawCentered(page, subtitle, PAGE_H - MARGIN - 62, 10, ctx.fontItalic, rgb(0.35, 0.38, 0.45));
  drawWrappedCentered(page, placeholder, PAGE_H / 2, 11, ctx.fontItalic, CONTENT_W - 80);
  drawPageFooter(page, pageNum, ctx.font);
}

function drawAcknowledgementPage(page: PDFPage, input: ProjectReportFrontPageInput, ctx: DrawCtx) {
  drawPageHeader(page, input.domain, ctx);
  drawCentered(page, "ACKNOWLEDGEMENT", PAGE_H - MARGIN - 36, 14, ctx.fontBold);

  const uniName = resolveUniversityDisplayName(input.universityName);
  const paras = [
    `I would like to express my sincere gratitude to ${uniName} for providing the opportunity to undertake this NEP 2020 aligned internship programme in "${input.domain}".`,
    `I am thankful to ${BRAND} for designing and delivering the ${input.mode.toLowerCase()} internship training programme with structured modules, assignments, and evaluation.`,
    `I extend my appreciation to my trainer and mentors for their guidance throughout the internship duration.`,
    `I am grateful to my Head of the Department and the Internship Programme Office (IPO) coordinator for their support and encouragement.`,
    `Finally, I thank my parents and peers for their constant motivation during this internship journey.`,
    `Any mistakes or shortcomings that remain in this report are entirely my own.`,
  ];

  let y = PAGE_H - MARGIN - 68;
  for (const para of paras) {
    const lines = wrapText(para, ctx.font, 10.5, CONTENT_W);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN, y, size: 10.5, font: ctx.font });
      y -= 14;
    }
    y -= 6;
  }

  page.drawLine({
    start: { x: PAGE_W - MARGIN - 160, y: y - 20 },
    end: { x: PAGE_W - MARGIN, y: y - 20 },
    thickness: 0.6,
    color: rgb(0.2, 0.22, 0.28),
  });
  page.drawText("(Name of the Student)", {
    x: PAGE_W - MARGIN - 130,
    y: y - 36,
    size: 10,
    font: ctx.fontItalic,
  });
  drawFieldLine(page, "College Roll No.:", input.collegeRollNumber || "", MARGIN, y - 60, ctx, 260);
  drawFieldLine(page, "University Roll No.:", input.universityRollNumber || "", MARGIN, y - 84, ctx, 260);

  drawPageFooter(page, 7, ctx.font);
}

function drawDepartmentCertificatePage(page: PDFPage, input: ProjectReportFrontPageInput, ctx: DrawCtx) {
  drawPageHeader(page, input.domain, ctx);
  drawCentered(page, "CERTIFICATE BY THE DEPARTMENT", PAGE_H - MARGIN - 36, 13, ctx.fontBold);
  drawCentered(page, "(To be issued by the Head of the Department / College)", PAGE_H - MARGIN - 56, 10, ctx.fontItalic, rgb(0.35, 0.38, 0.45));

  const body = `This is to certify that ${input.studentName || "____________________"} (Student Name) s/o or d/o ____________________, College Roll No. ${input.collegeRollNumber || "____________________"}, University Roll No. ${input.universityRollNumber || "____________________"} of programme ${input.programme || "____________________"}, session ${input.session || "____________________"} has successfully completed his/her internship for a duration of 120 hours from ${BRAND} (name of the organization).

He/She has also submitted the report of the internship after successful completion of the internship.`;

  let y = PAGE_H - MARGIN - 90;
  for (const para of body.split("\n\n")) {
    const lines = wrapText(para, ctx.font, 10.5, CONTENT_W);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN, y, size: 10.5, font: ctx.font });
      y -= 14;
    }
    y -= 10;
  }

  y -= 16;
  page.drawText("Head of the Department", { x: MARGIN, y, size: 11, font: ctx.fontBold });
  drawFieldLine(page, "Signature:", "", MARGIN, y - 24, ctx, 240);
  drawFieldLine(page, "Name:", "", MARGIN, y - 48, ctx, 240);
  drawFieldLine(page, "Department:", input.departmentName || "", MARGIN, y - 72, ctx, 240);
  drawFieldLine(page, "College:", input.collegeName || "", MARGIN, y - 96, ctx, 240);
  drawFieldLine(page, "Seal & Date:", "", MARGIN, y - 120, ctx, 240);

  drawPageFooter(page, 6, ctx.font);
}

/** Generate the 7 standard front pages (cover through acknowledgement). */
export async function generateProjectReportFrontPagesPdf(
  input: ProjectReportFrontPageInput
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const ctx: DrawCtx = { font, fontBold, fontItalic };
  const logoBytes = await resolveUniversityLogoBytes(input.universityLogoUrl);
  const logoImage = await embedLogo(pdfDoc, logoBytes);

  drawCoverPage(pdfDoc.addPage([PAGE_W, PAGE_H]), input, ctx, logoImage);
  drawDeclarationPage(pdfDoc.addPage([PAGE_W, PAGE_H]), input, ctx);
  drawPlaceholderPage(
    pdfDoc.addPage([PAGE_W, PAGE_H]),
    input,
    ctx,
    "CONSENT LETTER",
    "(To be attached on College / IPO letterhead)",
    "[ Space for the Consent Letter signed by the Internship Programme Office (IPO) ]",
    3
  );
  drawPlaceholderPage(
    pdfDoc.addPage([PAGE_W, PAGE_H]),
    input,
    ctx,
    "INTERNSHIP TRAINING OVERVIEW",
    "(Programme summary — hybrid / online / offline mode as selected)",
    `[ ${input.mode} Internship Training Programme — ${input.domain} ]`,
    4
  );
  drawPlaceholderPage(
    pdfDoc.addPage([PAGE_W, PAGE_H]),
    input,
    ctx,
    "INTERNSHIP COMPLETION CERTIFICATE",
    "(Issued by the Company / IPO — Apna Intern SDP Technology Pvt. Ltd.)",
    "[ Space for the Internship Completion Certificate issued on company letterhead, with company seal and signature ]",
    5
  );
  drawDepartmentCertificatePage(pdfDoc.addPage([PAGE_W, PAGE_H]), input, ctx);
  drawAcknowledgementPage(pdfDoc.addPage([PAGE_W, PAGE_H]), input, ctx);

  return pdfDoc.save();
}
