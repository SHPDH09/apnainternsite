import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ProjectReportStudentSnapshot } from "@/lib/projectReportStudentSnapshot";

/** Default cover block for admin-uploaded templates (pdf-lib, origin bottom-left). */
const COVER = {
  x: 72,
  startY: 320,
  lineHeight: 14,
  size: 10,
  labelSize: 10,
} as const;

function drawLine(page: PDFPage, font: PDFFont, label: string, value: string, y: number) {
  const v = String(value || "").trim();
  if (!v || v === "—") return y;
  const text = `${label} ${v}`.slice(0, 120);
  page.drawText(text, {
    x: COVER.x,
    y,
    size: COVER.size,
    font,
    color: rgb(0.05, 0.05, 0.12),
  });
  return y - COVER.lineHeight;
}

/** Fill common student placeholders on generic domain PDF templates. */
export function overlayGenericStudentFields(
  pages: PDFPage[],
  font: PDFFont,
  fontBold: PDFFont,
  student: ProjectReportStudentSnapshot,
  extras?: { universityName?: string; mode?: string }
) {
  const page = pages[0];
  if (!page) return;

  const uni = extras?.universityName || student.universityName;
  let y = COVER.startY;

  page.drawText("Student details", {
    x: COVER.x,
    y: y + 8,
    size: COVER.labelSize,
    font: fontBold,
    color: rgb(0.1, 0.25, 0.55),
  });
  y -= 4;

  y = drawLine(page, font, "Name:", student.studentName, y);
  y = drawLine(page, font, "University Reg. No.:", student.universityRegistrationNumber, y);
  y = drawLine(page, font, "Roll No.:", student.universityRollNumber, y);
  y = drawLine(page, font, "University:", uni, y);
  y = drawLine(page, font, "College:", student.collegeName, y);
  y = drawLine(page, font, "Programme:", student.programmeCourse, y);
  y = drawLine(page, font, "Domain:", student.internshipDomain, y);
  y = drawLine(page, font, "Semester:", student.semester, y);
  y = drawLine(page, font, "Session:", student.sessionDisplay || student.academicSession, y);
  if (extras?.mode) {
    y = drawLine(page, font, "Mode:", extras.mode, y);
  }
  drawLine(page, font, "Submission Date:", student.submissionDate, y);
}
