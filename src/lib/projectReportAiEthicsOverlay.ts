import { rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { ProjectReportStudentSnapshot } from "@/lib/projectReportStudentSnapshot";

/** Coordinates from bundled AI Ethics PDF (612×792, pdf-lib origin bottom-left). */
const COVER = {
  universityLine: { x: 72, y: 655, width: 468, size: 11 },
  collegeLine: { x: 72, y: 628, width: 468, size: 11 },
  degreeBand: { x: 51, y: 464, width: 510, height: 22 },
  branchBand: { x: 51, y: 451, width: 510, height: 22 },
  sessionLine: { x: 160, y: 190.5, width: 292, size: 10 },
  valueX: 315,
  nameY: 417.6,
  registrationY: 400.9,
  rollY: 384.2,
  universityY: 367.5,
  collegeY: 350.8,
  courseY: 334.2,
  branchY: 317.5,
  semesterY: 300.8,
  sessionFieldY: 284.1,
  submissionY: 234.0,
  fieldSize: 10,
  logoBox: { x: 195, y: 688, width: 130, height: 52 },
  internshipDomainLabel: { x: 57.2, y: 317.5, maskW: 200 },
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
      page.drawText(line.slice(0, 125), {
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

export function drawAiEthicsCoverLogo(page: PDFPage, logo: PDFImage | null) {
  const box = COVER.logoBox;
  paintWhite(page, box.x - 8, box.y - 8, box.width + 16, box.height + 16);
  if (!logo) return;
  const scale = Math.min(box.width / logo.width, box.height / logo.height);
  const w = logo.width * scale;
  const h = logo.height * scale;
  page.drawImage(logo, {
    x: box.x + (box.width - w) / 2,
    y: box.y + (box.height - h) / 2,
    width: w,
    height: h,
  });
}

export function overlayAiEthicsStudentFields(
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
  const bodyX = 51.8;
  const lineHeight = 13;

  const page0 = pages[0];
  if (page0) {
    paintWhite(page0, 160, 648, 300, 40);
    paintWhite(page0, 160, 620, 300, 28);

    drawCentered(page0, fontBold, uniLine, COVER.universityLine);
    drawCentered(page0, fontBold, collegeLine, COVER.collegeLine);

    paintWhite(page0, COVER.degreeBand.x, COVER.degreeBand.y, COVER.degreeBand.width, COVER.degreeBand.height);
    drawCentered(page0, fontBold, `${programmeCourse} (Course / Degree)`, {
      x: COVER.degreeBand.x,
      y: 468,
      width: COVER.degreeBand.width,
      size: 10,
    });

    paintWhite(page0, COVER.branchBand.x, COVER.branchBand.y, COVER.branchBand.width, COVER.branchBand.height);
    drawCentered(page0, font, `Internship Domain: ${domain}`, {
      x: COVER.branchBand.x,
      y: 455,
      width: COVER.branchBand.width,
      size: 10,
    });

    paintWhite(
      page0,
      COVER.internshipDomainLabel.x,
      COVER.internshipDomainLabel.y - 4,
      COVER.internshipDomainLabel.maskW,
      14
    );
    page0.drawText("Internship Domain :", {
      x: COVER.internshipDomainLabel.x,
      y: COVER.internshipDomainLabel.y,
      size: COVER.fieldSize,
      font,
      color: rgb(0.12, 0.25, 0.55),
    });

    if (session) {
      paintWhite(page0, 155, 186, 300, 14);
      drawCentered(page0, font, `Session: ${session}`, {
        x: COVER.sessionLine.x,
        y: COVER.sessionLine.y,
        width: COVER.sessionLine.width,
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
      { y: COVER.sessionFieldY, text: session },
      { y: COVER.submissionY, text: student.submissionDate },
    ];
    for (const row of coverFields) {
      paintWhite(page0, COVER.valueX - 4, row.y - 3, 280, 14);
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
    paintWhite(cert, 48, 608, 520, 62);
    drawLinesAt(
      cert,
      font,
      [
        `Mr./Ms. ${student.studentName}, Registration No. ${uniReg}, Roll No. ${uniRoll},`,
        `a student of ${programmeCourse} (Course) in ${domain} (Internship Domain), Semester ${student.semester}, Session ${session},`,
        `under my supervision and guidance in partial fulfilment of the requirements for the award of the degree of ${programmeCourse} of ${uniLine} (University).`,
      ],
      bodyX,
      664.6,
      bodySize,
      lineHeight
    );
  }

  const decl = pages[2];
  if (decl) {
    paintWhite(decl, 48, 648, 520, 58);
    drawLinesAt(
      decl,
      font,
      [
        `I, ${student.studentName}, Registration No. ${uniReg}, Roll No. ${uniRoll},`,
        `a student of ${programmeCourse} (Course) in ${domain} (Internship Domain) at ${collegeLine} (College),`,
        `affiliated to ${uniLine} (University), hereby declare that this project`,
      ],
      bodyX,
      703.6,
      bodySize,
      lineHeight
    );
  }
}
