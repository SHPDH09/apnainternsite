import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ProjectReportStudentSnapshot } from "@/lib/projectReportStudentSnapshot";

/** pdf-lib coords (origin bottom-left), matched to template via pdf.js text extraction. */
const COVER = {
  universityLine: { x: 115, y: 651, width: 375, size: 12 },
  collegeLine: { x: 115, y: 624, width: 375, size: 11 },
  degreeLine: { x: 148, y: 453, width: 340, size: 10 },
  valueX: 282,
  nameY: 395.7,
  registrationY: 375.6,
  rollY: 355.4,
  universityY: 335.2,
  collegeY: 315.0,
  courseY: 294.8,
  branchY: 274.7,
  semesterY: 254.5,
  sessionY: 234.3,
  submissionY: 173.8,
  fieldSize: 10,
} as const;

type TextSlot = {
  page: number;
  x: number;
  y: number;
  size?: number;
};

function drawValue(page: PDFPage, font: PDFFont, text: string, slot: TextSlot) {
  const value = String(text || "").trim();
  if (!value || value === "—") return;
  const size = slot.size ?? 10;
  page.drawText(value.slice(0, 100), {
    x: slot.x,
    y: slot.y,
    size,
    font,
    color: rgb(0.05, 0.05, 0.12),
  });
}

function drawCentered(
  page: PDFPage,
  font: PDFFont,
  text: string,
  box: { x: number; y: number; width: number; size: number }
) {
  const value = String(text || "").trim();
  if (!value || value === "—") return;
  const clipped = value.slice(0, 90);
  const textWidth = font.widthOfTextAtSize(clipped, box.size);
  const x = box.x + Math.max(0, (box.width - textWidth) / 2);
  page.drawText(clipped, {
    x,
    y: box.y,
    size: box.size,
    font,
    color: rgb(0.05, 0.05, 0.12),
  });
}

/** Cover + certificate/declaration/acknowledgement — aligned to colon labels & underline rules. */
export function overlayAccountingTallyStudentFields(
  pages: PDFPage[],
  font: PDFFont,
  fontBold: PDFFont,
  student: ProjectReportStudentSnapshot,
  extras: { collegeName: string; universityName: string }
) {
  const collegeLine = extras.collegeName || student.collegeName;
  const uniLine = extras.universityName || student.universityName;
  const degreeLine = student.degree || student.course;
  const courseLine = student.course || student.degree;
  const branchLine = student.department || student.course;

  const page0 = pages[0];
  if (page0) {
    drawCentered(page0, fontBold, uniLine, COVER.universityLine);
    drawCentered(page0, font, collegeLine, COVER.collegeLine);
    drawValue(page0, font, degreeLine, {
      page: 0,
      x: COVER.degreeLine.x,
      y: COVER.degreeLine.y,
      size: COVER.degreeLine.size,
    });

    const coverFields: Array<{ y: number; text: string }> = [
      { y: COVER.nameY, text: student.studentName },
      { y: COVER.registrationY, text: student.registrationNumber },
      { y: COVER.rollY, text: student.rollNumber },
      { y: COVER.universityY, text: uniLine },
      { y: COVER.collegeY, text: collegeLine },
      { y: COVER.courseY, text: courseLine },
      { y: COVER.branchY, text: branchLine },
      { y: COVER.semesterY, text: student.semester },
      { y: COVER.sessionY, text: student.academicSession },
      { y: COVER.submissionY, text: student.submissionDate },
    ];
    for (const row of coverFields) {
      drawValue(page0, font, row.text, {
        page: 0,
        x: COVER.valueX,
        y: row.y,
        size: COVER.fieldSize,
      });
    }
  }

  const certificate: Array<{ slot: TextSlot; text: string }> = [
    { slot: { page: 1, x: 118, y: 650.9, size: 10 }, text: student.studentName },
    { slot: { page: 1, x: 72, y: 632.7, size: 10 }, text: student.registrationNumber },
    { slot: { page: 1, x: 292, y: 632.7, size: 10 }, text: student.rollNumber },
    { slot: { page: 1, x: 74, y: 614.5, size: 10 }, text: courseLine },
    { slot: { page: 1, x: 74, y: 596.2, size: 10 }, text: `${branchLine}, ${student.semester}, ${student.academicSession}` },
    { slot: { page: 1, x: 238, y: 534.5, size: 10 }, text: student.degree || courseLine },
    { slot: { page: 1, x: 74, y: 516.2, size: 10 }, text: uniLine },
  ];

  const declaration: Array<{ slot: TextSlot; text: string }> = [
    { slot: { page: 2, x: 88, y: 712.7, size: 10 }, text: student.studentName },
    { slot: { page: 2, x: 330, y: 712.7, size: 10 }, text: student.registrationNumber },
    { slot: { page: 2, x: 118, y: 694.4, size: 10 }, text: student.rollNumber },
    { slot: { page: 2, x: 190, y: 676.2, size: 10 }, text: courseLine },
    { slot: { page: 2, x: 74, y: 657.9, size: 10 }, text: collegeLine },
    { slot: { page: 2, x: 74, y: 639.7, size: 10 }, text: uniLine },
    { slot: { page: 2, x: 74, y: 279.6, size: 10 }, text: student.submissionDate },
    { slot: { page: 2, x: 350, y: 279.6, size: 10 }, text: student.studentName },
    { slot: { page: 2, x: 410, y: 266.8, size: 10 }, text: student.rollNumber },
  ];

  const acknowledgement: Array<{ slot: TextSlot; text: string }> = [
    { slot: { page: 3, x: 332, y: 318.6, size: 10 }, text: student.studentName },
    { slot: { page: 3, x: 408, y: 305.5, size: 10 }, text: student.rollNumber },
    { slot: { page: 3, x: 455, y: 292.7, size: 10 }, text: student.registrationNumber },
  ];

  for (const row of [...certificate, ...declaration, ...acknowledgement]) {
    const page = pages[row.slot.page];
    if (!page) continue;
    drawValue(page, font, row.text, row.slot);
  }
}
