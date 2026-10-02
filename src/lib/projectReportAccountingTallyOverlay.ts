import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ProjectReportStudentSnapshot } from "@/lib/projectReportStudentSnapshot";

type TextSlot = {
  page: number;
  x: number;
  y: number;
  size?: number;
  maxWidth?: number;
};

function drawSingleLine(
  page: PDFPage,
  font: PDFFont,
  text: string,
  slot: TextSlot
) {
  const value = String(text || "").trim();
  if (!value || value === "—") return;
  const size = slot.size ?? 10;
  page.drawText(value.slice(0, 120), {
    x: slot.x,
    y: slot.y,
    size,
    font,
    color: rgb(0.05, 0.05, 0.12),
  });
}

/** Cover + certificate/declaration/acknowledgement identity lines. */
export function overlayAccountingTallyStudentFields(
  pages: PDFPage[],
  font: PDFFont,
  student: ProjectReportStudentSnapshot,
  extras: { collegeName: string; universityName: string; mode: string }
) {
  const collegeLine = extras.collegeName || student.collegeName;
  const uniLine = extras.universityName || student.universityName;

  const cover: Array<{ slot: TextSlot; text: string }> = [
    { slot: { page: 0, x: 72, y: 662, size: 12, maxWidth: 450 }, text: collegeLine },
    { slot: { page: 0, x: 220, y: 498, size: 10, maxWidth: 320 }, text: student.studentName },
    { slot: { page: 0, x: 220, y: 478, size: 10, maxWidth: 320 }, text: student.registrationNumber },
    { slot: { page: 0, x: 220, y: 458, size: 10, maxWidth: 320 }, text: student.rollNumber },
    { slot: { page: 0, x: 220, y: 438, size: 10, maxWidth: 320 }, text: uniLine },
    { slot: { page: 0, x: 220, y: 418, size: 10, maxWidth: 320 }, text: collegeLine },
    { slot: { page: 0, x: 220, y: 398, size: 10, maxWidth: 320 }, text: student.degree || student.course },
    { slot: { page: 0, x: 220, y: 378, size: 10, maxWidth: 320 }, text: student.department },
    { slot: { page: 0, x: 220, y: 358, size: 10, maxWidth: 120 }, text: student.semester },
    { slot: { page: 0, x: 220, y: 338, size: 10, maxWidth: 200 }, text: student.academicSession },
    { slot: { page: 0, x: 220, y: 298, size: 10, maxWidth: 200 }, text: student.submissionDate },
    { slot: { page: 0, x: 220, y: 278, size: 10, maxWidth: 200 }, text: `Mode: ${extras.mode}` },
  ];

  const certificate: Array<{ slot: TextSlot; text: string }> = [
    { slot: { page: 1, x: 118, y: 688, size: 10, maxWidth: 200 }, text: student.studentName },
    { slot: { page: 1, x: 200, y: 672, size: 10, maxWidth: 120 }, text: student.registrationNumber },
    { slot: { page: 1, x: 360, y: 672, size: 10, maxWidth: 120 }, text: student.rollNumber },
    { slot: { page: 1, x: 72, y: 656, size: 10, maxWidth: 200 }, text: student.degree || student.course },
    { slot: { page: 1, x: 250, y: 656, size: 10, maxWidth: 200 }, text: student.department },
    { slot: { page: 1, x: 430, y: 656, size: 10, maxWidth: 80 }, text: student.semester },
    { slot: { page: 1, x: 72, y: 640, size: 10, maxWidth: 450 }, text: uniLine },
  ];

  const declaration: Array<{ slot: TextSlot; text: string }> = [
    { slot: { page: 2, x: 95, y: 728, size: 10, maxWidth: 220 }, text: student.studentName },
    { slot: { page: 2, x: 330, y: 728, size: 10, maxWidth: 120 }, text: student.registrationNumber },
    { slot: { page: 2, x: 470, y: 728, size: 10, maxWidth: 100 }, text: student.rollNumber },
    { slot: { page: 2, x: 72, y: 712, size: 10, maxWidth: 450 }, text: `${student.degree || student.course} · ${student.department}` },
    { slot: { page: 2, x: 72, y: 696, size: 10, maxWidth: 450 }, text: collegeLine },
    { slot: { page: 2, x: 72, y: 680, size: 10, maxWidth: 450 }, text: uniLine },
    { slot: { page: 2, x: 120, y: 592, size: 10, maxWidth: 200 }, text: student.submissionDate },
    { slot: { page: 2, x: 120, y: 576, size: 10, maxWidth: 220 }, text: student.studentName },
    { slot: { page: 2, x: 120, y: 560, size: 10, maxWidth: 160 }, text: student.rollNumber },
  ];

  const acknowledgement: Array<{ slot: TextSlot; text: string }> = [
    { slot: { page: 3, x: 120, y: 520, size: 10, maxWidth: 220 }, text: student.studentName },
    { slot: { page: 3, x: 120, y: 504, size: 10, maxWidth: 160 }, text: student.rollNumber },
    { slot: { page: 3, x: 120, y: 488, size: 10, maxWidth: 160 }, text: student.registrationNumber },
  ];

  for (const row of [...cover, ...certificate, ...declaration, ...acknowledgement]) {
    const page = pages[row.slot.page];
    if (!page) continue;
    drawSingleLine(page, font, row.text, row.slot);
  }
}
