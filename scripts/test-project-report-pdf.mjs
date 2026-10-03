import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  drawAccountingTallyCoverLogo,
  overlayAccountingTallyStudentFields,
} from "../src/lib/projectReportAccountingTallyOverlay.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

async function main() {
  const templatePath = path.join(
    root,
    "public/project-report-templates/accounting-tally-gst-project-report.pdf"
  );
  const bytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  let logoBytes = null;
  const logoCandidates = [
    path.join(root, "public/apna-intern-logo.png"),
    path.join(root, "public/logo.png"),
  ];
  for (const p of logoCandidates) {
    if (fs.existsSync(p)) {
      logoBytes = fs.readFileSync(p);
      break;
    }
  }
  let logoImage = null;
  if (logoBytes) {
    try {
      logoImage = await pdfDoc.embedPng(logoBytes);
    } catch {
      logoImage = await pdfDoc.embedJpg(logoBytes);
    }
  }

  const student = {
    studentName: "Raunak testing",
    universityRegistrationNumber: "4565665",
    universityRollNumber: "4565665",
    registrationNumber: "4565665",
    rollNumber: "4565665",
    universityName: "L.N. Mithila University, Darbhanga",
    collegeName: "A. N. D. College",
    programmeCourse: "B.Com.",
    internshipDomain: "Accounting, Tally & GST",
    course: "B.Com.",
    degree: "B.Com.",
    department: "",
    semester: "5",
    academicSession: "2023-2027",
    sessionDisplay: "2023 – 2027",
    submissionDate: "2 October 2026",
  };

  overlayAccountingTallyStudentFields(pages, font, fontBold, student, {
    collegeName: student.collegeName,
    universityName: student.universityName,
  });
  drawAccountingTallyCoverLogo(pages[0], logoImage);

  const out = await pdfDoc.save();
  const outPath = path.join(root, "captures/test-project-report.pdf");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out);
  console.log("Wrote", outPath, "logo embedded:", !!logoImage);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
