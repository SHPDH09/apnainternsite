import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ProjectReportStudentSnapshot } from "@/lib/projectReportStudentSnapshot";

const COVER = {
  universityLine: { x: 108, y: 667, width: 380, size: 11 },
  collegeLine: { x: 108, y: 639, width: 380, size: 11 },
  programmeCourseLine: { x: 148, y: 453, width: 200, size: 10 },
  domainLine: { x: 280, y: 436, width: 260, size: 10 },
  sessionLine: { x: 240, y: 114.7, width: 200, size: 10 },
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

function paintWhite(page: PDFPage, x: number, y: number, width: number, height: number) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });
}

function maskCoverHeaderPlaceholders(page: PDFPage, options: { hideLogoCaption: boolean }) {
  paintWhite(page, 108, 646, 385, 24);
  paintWhite(page, 142, 618, 352, 24);
  if (options.hideLogoCaption) {
    paintWhite(page, 218, 696, 168, 52);
  }
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

function maskAndFillLine(page: PDFPage, y: number, x: number, width: number, height: number) {
  paintWhite(page, x, y - 2, width, height);
}

/** Cover + certificate/declaration/acknowledgement — aligned to template rules. */
export function overlayAccountingTallyStudentFields(
  pages: PDFPage[],
  font: PDFFont,
  fontBold: PDFFont,
  student: ProjectReportStudentSnapshot,
  extras: { collegeName: string; universityName: string; hideLogoCaption?: boolean }
) {
  const collegeLine = extras.collegeName || student.collegeName;
  const uniLine = extras.universityName || student.universityName;
  const programmeCourse = student.programmeCourse || student.course;
  const domain = student.internshipDomain || "—";
  const uniReg = student.universityRegistrationNumber;
  const uniRoll = student.universityRollNumber;

  const page0 = pages[0];
  if (page0) {
    maskCoverHeaderPlaceholders(page0, {
      hideLogoCaption: extras.hideLogoCaption !== false,
    });
    drawCentered(page0, fontBold, uniLine, COVER.universityLine);
    drawCentered(page0, fontBold, collegeLine, COVER.collegeLine);
    drawValue(page0, font, programmeCourse, {
      page: 0,
      x: COVER.programmeCourseLine.x,
      y: COVER.programmeCourseLine.y,
      size: COVER.programmeCourseLine.size,
    });
    drawValue(page0, font, domain, {
      page: 0,
      x: COVER.domainLine.x,
      y: COVER.domainLine.y,
      size: COVER.domainLine.size,
    });

    if (student.sessionDisplay) {
      paintWhite(page0, 238, 110, 200, 14);
      drawValue(page0, font, `Session: ${student.sessionDisplay}`, {
        page: 0,
        x: COVER.sessionLine.x,
        y: COVER.sessionLine.y,
        size: COVER.sessionLine.size,
      });
    }

    const coverFields: Array<{ y: number; text: string }> = [
      { y: COVER.nameY, text: student.studentName },
      { y: COVER.registrationY, text: uniReg },
      { y: COVER.rollY, text: uniRoll },
      { y: COVER.universityY, text: uniLine },
      { y: COVER.collegeY, text: collegeLine },
      { y: COVER.courseY, text: programmeCourse },
      { y: COVER.branchY, text: domain },
      { y: COVER.semesterY, text: student.semester },
      { y: COVER.sessionY, text: student.sessionDisplay || student.academicSession },
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

  const certificate: Array<{ slot: TextSlot; text: string; mask?: { x: number; w: number; h: number } }> = [
    { slot: { page: 1, x: 118, y: 650.9, size: 10 }, text: student.studentName, mask: { x: 115, w: 200, h: 14 } },
    { slot: { page: 1, x: 72, y: 632.7, size: 10 }, text: uniReg, mask: { x: 70, w: 140, h: 14 } },
    { slot: { page: 1, x: 292, y: 632.7, size: 10 }, text: uniRoll, mask: { x: 288, w: 120, h: 14 } },
    { slot: { page: 1, x: 74, y: 614.5, size: 10 }, text: programmeCourse, mask: { x: 70, w: 300, h: 14 } },
    {
      slot: { page: 1, x: 74, y: 596.2, size: 10 },
      text: `${domain}, ${student.semester}, ${student.sessionDisplay || student.academicSession}`,
      mask: { x: 70, w: 480, h: 14 },
    },
    { slot: { page: 1, x: 238, y: 534.5, size: 10 }, text: programmeCourse, mask: { x: 234, w: 200, h: 14 } },
    { slot: { page: 1, x: 74, y: 516.2, size: 10 }, text: uniLine, mask: { x: 70, w: 400, h: 14 } },
  ];

  const declarationPage = pages[2];
  if (declarationPage) {
    maskAndFillLine(declarationPage, 712.7, 70, 460, 16);
    drawValue(declarationPage, font, student.studentName, { page: 2, x: 82, y: 712.7, size: 10 });
    drawValue(declarationPage, font, uniReg, { page: 2, x: 368, y: 712.7, size: 10 });

    maskAndFillLine(declarationPage, 694.4, 70, 460, 16);
    drawValue(declarationPage, font, uniRoll, { page: 2, x: 118, y: 694.4, size: 10 });
    drawValue(declarationPage, font, programmeCourse, { page: 2, x: 300, y: 694.4, size: 10 });

    maskAndFillLine(declarationPage, 676.2, 70, 460, 16);
    drawValue(declarationPage, font, domain, { page: 2, x: 192, y: 676.2, size: 10 });

    maskAndFillLine(declarationPage, 657.9, 70, 460, 16);
    drawValue(declarationPage, font, collegeLine, { page: 2, x: 74, y: 657.9, size: 10 });

    maskAndFillLine(declarationPage, 639.7, 70, 460, 16);
    drawValue(declarationPage, font, uniLine, { page: 2, x: 74, y: 639.7, size: 10 });

    maskAndFillLine(declarationPage, 279.6, 340, 220, 14);
    drawValue(declarationPage, font, student.studentName, { page: 2, x: 398, y: 279.6, size: 10 });
    maskAndFillLine(declarationPage, 266.8, 350, 200, 14);
    drawValue(declarationPage, font, uniRoll, { page: 2, x: 418, y: 266.8, size: 10 });
    drawValue(declarationPage, font, student.submissionDate, { page: 2, x: 118, y: 279.6, size: 10 });
  }

  const acknowledgement: Array<{ slot: TextSlot; text: string; maskW: number }> = [
    { slot: { page: 3, x: 398, y: 318.6, size: 10 }, text: student.studentName, maskW: 170 },
    { slot: { page: 3, x: 418, y: 305.5, size: 10 }, text: uniRoll, maskW: 150 },
    { slot: { page: 3, x: 468, y: 292.7, size: 10 }, text: uniReg, maskW: 110 },
  ];

  for (const row of certificate) {
    const page = pages[row.slot.page];
    if (!page) continue;
    if (row.mask) maskAndFillLine(page, row.slot.y, row.mask.x, row.mask.w, row.mask.h);
    drawValue(page, font, row.text, row.slot);
  }

  for (const row of acknowledgement) {
    const page = pages[row.slot.page];
    if (!page) continue;
    maskAndFillLine(page, row.slot.y, row.slot.x - 4, row.maskW, 14);
    drawValue(page, font, row.text, row.slot);
  }
}
