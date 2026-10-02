import { rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { ProjectReportStudentSnapshot } from "@/lib/projectReportStudentSnapshot";

const COVER = {
  universityLine: { x: 108, y: 667, width: 380, size: 11 },
  collegeLine: { x: 108, y: 639, width: 380, size: 11 },
  degreeBand: { x: 72, y: 448, width: 468, height: 22 },
  branchBand: { x: 72, y: 428, width: 468, height: 22 },
  sessionLine: { x: 240, y: 114.7, width: 220, size: 10 },
  valueX: 290,
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
  /** Template “UNIVERSITY LOGO (paste here)” block */
  logoBox: { x: 235, y: 706, width: 142, height: 88 },
} as const;

type TextSlot = { page: number; x: number; y: number; size?: number };

function drawValue(page: PDFPage, font: PDFFont, text: string, slot: TextSlot) {
  const value = String(text || "").trim();
  if (!value || value === "—") return;
  page.drawText(value.slice(0, 110), {
    x: slot.x,
    y: slot.y,
    size: slot.size ?? 10,
    font,
    color: rgb(0.05, 0.05, 0.12),
  });
}

function paintWhite(page: PDFPage, x: number, y: number, width: number, height: number) {
  page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1), borderWidth: 0 });
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

function maskLineBand(page: PDFPage, y: number, height = 18) {
  paintWhite(page, 68, y - 4, 460, height);
}

function drawLinesAt(
  page: PDFPage,
  font: PDFFont,
  lines: string[],
  x: number,
  startY: number,
  size: number,
  lineHeight: number
) {
  let y = startY;
  for (const line of lines) {
    if (line) {
      page.drawText(line.slice(0, 120), {
        x,
        y,
        size,
        font,
        color: rgb(0.05, 0.05, 0.12),
      });
    }
    y -= lineHeight;
  }
}

function drawLabelValueLines(
  page: PDFPage,
  font: PDFFont,
  rows: Array<{ label: string; value: string }>,
  x: number,
  startY: number,
  size: number,
  lineHeight: number
) {
  let y = startY;
  for (const row of rows) {
    const value = String(row.value || "").trim();
    if (!value || value === "—") {
      y -= lineHeight;
      continue;
    }
    page.drawText(`${row.label} ${value}`.slice(0, 80), {
      x,
      y,
      size,
      font,
      color: rgb(0.05, 0.05, 0.12),
    });
    y -= lineHeight;
  }
}

export function drawAccountingTallyCoverLogo(page: PDFPage, logo: PDFImage | null) {
  const box = COVER.logoBox;
  /* Template corner brackets + “UNIVERSITY LOGO” caption */
  paintWhite(page, 198, 696, 218, 102);
  if (!logo) return;

  const scale = Math.min(box.width / logo.width, box.height / logo.height);
  const w = logo.width * scale;
  const h = logo.height * scale;
  const x = box.x + (box.width - w) / 2;
  const y = box.y + (box.height - h) / 2;
  page.drawImage(logo, { x, y, width: w, height: h });
}

export function overlayAccountingTallyStudentFields(
  pages: PDFPage[],
  font: PDFFont,
  fontBold: PDFFont,
  student: ProjectReportStudentSnapshot,
  extras: { collegeName: string; universityName: string }
) {
  const collegeLine = extras.collegeName || student.collegeName;
  const uniLine = extras.universityName || student.universityName;
  const programmeCourse = student.programmeCourse || student.course;
  const domain = student.internshipDomain || "—";
  const uniReg = student.universityRegistrationNumber;
  const uniRoll = student.universityRollNumber;
  const session = student.sessionDisplay || student.academicSession;
  const bodySize = 10;
  const bodyX = 72;
  const lineHeight = 17.6;

  const page0 = pages[0];
  if (page0) {
    paintWhite(page0, 175, 678, 260, 28);
    paintWhite(page0, 108, 646, 385, 24);
    paintWhite(page0, 142, 618, 352, 24);

    drawCentered(page0, fontBold, uniLine, COVER.universityLine);
    drawCentered(page0, fontBold, collegeLine, COVER.collegeLine);

    paintWhite(page0, COVER.degreeBand.x, COVER.degreeBand.y, COVER.degreeBand.width, COVER.degreeBand.height);
    drawCentered(page0, fontBold, `${programmeCourse} (Course / Degree)`, {
      x: COVER.degreeBand.x,
      y: 452.3,
      width: COVER.degreeBand.width,
      size: 10,
    });

    paintWhite(page0, COVER.branchBand.x, COVER.branchBand.y, COVER.branchBand.width, COVER.branchBand.height);
    drawCentered(page0, font, `Internship Domain: ${domain}`, {
      x: COVER.branchBand.x,
      y: 435.6,
      width: COVER.branchBand.width,
      size: 10,
    });

    paintWhite(page0, 96, 270, 178, 14);
    page0.drawText("Internship Domain", {
      x: 100.5,
      y: COVER.branchY,
      size: COVER.fieldSize,
      font,
      color: rgb(0.12, 0.25, 0.55),
    });

    if (session) {
      paintWhite(page0, 200, 108, 260, 16);
      drawCentered(page0, font, `Session: ${session}`, {
        x: 200,
        y: COVER.sessionLine.y,
        width: 260,
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
      { y: COVER.sessionY, text: session },
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

  const cert = pages[1];
  if (cert) {
    paintWhite(cert, 68, 574, 460, 98);
    const certLines = [
      `Mr./Ms. ${student.studentName}, Registration No. ${uniReg}, Roll No. ${uniRoll},`,
      `a student of ${programmeCourse} (Course) in ${domain} (Internship Domain),`,
      `Semester ${student.semester}, Session ${session}.`,
    ];
    drawLinesAt(cert, font, certLines, bodyX, 650.9, bodySize, lineHeight);

    maskLineBand(cert, 534.5, 16);
    drawValue(cert, font, `degree of ${programmeCourse} of ${uniLine}.`, {
      page: 1,
      x: bodyX,
      y: 534.5,
      size: bodySize,
    });
    maskLineBand(cert, 516.2, 14);
  }

  const decl = pages[2];
  if (decl) {
    paintWhite(decl, 68, 632, 460, 92);
    const declIntro = [
      `I, ${student.studentName}, Registration No. ${uniReg},`,
      `Roll No. ${uniRoll}, a student of ${programmeCourse} (Course) in ${domain} (Internship Domain) at`,
      `${collegeLine} (College), affiliated to ${uniLine} (University),`,
      `hereby declare that the project`,
    ];
    drawLinesAt(decl, font, declIntro, bodyX, 712.7, bodySize, lineHeight);

    paintWhite(decl, 72, 276, 210, 14);
    drawValue(decl, font, student.submissionDate, { page: 2, x: 118, y: 279.6, size: bodySize });
    paintWhite(decl, 340, 260, 210, 28);
    drawLabelValueLines(
      decl,
      font,
      [
        { label: "Name:", value: student.studentName },
        { label: "Roll No.:", value: uniRoll },
      ],
      346,
      279.6,
      bodySize,
      12.8
    );
  }

  const ack = pages[3];
  if (ack) {
    paintWhite(ack, 318, 288, 230, 38);
    drawLabelValueLines(
      ack,
      font,
      [
        { label: "Name:", value: student.studentName },
        { label: "Roll No.:", value: uniRoll },
        { label: "Registration No.:", value: uniReg },
      ],
      328,
      318.6,
      bodySize,
      13
    );
  }
}
