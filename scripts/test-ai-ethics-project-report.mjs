import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  drawAiEthicsCoverLogo,
  overlayAiEthicsStudentFields,
} from "../src/lib/projectReportAiEthicsOverlay.ts";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";

async function main() {
  const templatePath = path.join(
    root,
    "public/project-report-templates/ai-ethics-responsible-tech-policy-research-project-report.pdf"
  );
  const pdfDoc = await PDFDocument.load(fs.readFileSync(templatePath));
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const logoPath = path.join(root, "public/apna-intern-logo.png");
  const logoImage = fs.existsSync(logoPath)
    ? await pdfDoc.embedPng(fs.readFileSync(logoPath))
    : null;

  const student = {
    studentName: "Raunak testing",
    universityRegistrationNumber: "4565665",
    universityRollNumber: "4565665",
    registrationNumber: "4565665",
    rollNumber: "4565665",
    universityName: "L.N. Mithila University, Darbhanga",
    collegeName: "A. N. D. College",
    programmeCourse: "B.A.",
    internshipDomain: "AI Ethics & Responsible Tech Policy Research",
    course: "B.A.",
    degree: "B.A.",
    department: "",
    semester: "5",
    academicSession: "2023-2027",
    sessionDisplay: "2023 – 2027",
    submissionDate: "2 October 2026",
  };

  overlayAiEthicsStudentFields(pages, font, fontBold, student, {
    collegeName: student.collegeName,
    universityName: student.universityName,
  });
  drawAiEthicsCoverLogo(pages[0], logoImage);

  const out = path.join(root, "captures/test-ai-ethics-project-report.pdf");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, await pdfDoc.save());
  console.log("Wrote", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
