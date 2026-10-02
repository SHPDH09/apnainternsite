import fs from "fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node dump-pdf-text.mjs <pdf>");
  process.exit(1);
}

async function main() {
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data }).promise;
  console.log("pages", doc.numPages);
  for (let p = 1; p <= Math.min(2, doc.numPages); p++) {
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
