import fs from "fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

async function main() {
  const data = new Uint8Array(
    fs.readFileSync("public/project-report-templates/accounting-tally-gst-project-report.pdf")
  );
  const doc = await pdfjs.getDocument({ data }).promise;
  for (let p = 1; p <= 4; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    console.log("--- page", p, "---");
    for (const item of content.items) {
      if ("str" in item && String(item.str).trim()) {
        const [,,, , x, y] = item.transform;
        console.log(y.toFixed(1), x.toFixed(1), JSON.stringify(item.str));
      }
    }
  }
}

main().catch(console.error);
