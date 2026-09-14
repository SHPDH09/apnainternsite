import { rgb, type PDFPage, type PDFFont } from "pdf-lib";

export type PdfTextLine = {
  pageIndex: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LogoCoverRegion = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

const A4_HEIGHT = 842;
const A4_WIDTH = 595;

function normalizeName(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const aTokens = new Set(na.split(" ").filter(Boolean));
  const bTokens = new Set(nb.split(" ").filter(Boolean));
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  const minSize = Math.min(aTokens.size, bTokens.size);
  return minSize >= 2 && overlap / minSize >= 0.6;
}

function shouldReplaceUniversityLine(
  text: string,
  pageIndex: number,
  y: number,
  pageHeight: number,
  catalogNames: string[],
  selectedUniversityName: string
): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  if (namesMatch(trimmed, selectedUniversityName)) return false;

  const upperBand = y >= pageHeight * 0.52;
  const isFirstPageHeader = pageIndex === 0 && upperBand;
  const looksLikeUniversity = /university|college|institute|vidyalaya|school of/i.test(trimmed);
  const matchesCatalog = catalogNames.some((name) => namesMatch(trimmed, name));

  if (isFirstPageHeader && (looksLikeUniversity || matchesCatalog)) return true;
  if (matchesCatalog) return true;
  return false;
}

function groupTextItemsIntoLines(
  items: Array<{ str: string; transform: number[]; width: number; height: number }>,
  pageIndex: number
): PdfTextLine[] {
  const chunks = items
    .map((item) => {
      const text = String(item.str || "").replace(/\s+/g, " ").trim();
      if (!text) return null;
      const x = item.transform[4] ?? 0;
      const y = item.transform[5] ?? 0;
      const height = Math.max(item.height || 12, 10);
      const width = Math.max(item.width || text.length * height * 0.45, 20);
      return { pageIndex, text, x, y, width, height };
    })
    .filter(Boolean) as PdfTextLine[];

  chunks.sort((a, b) => {
    if (Math.abs(b.y - a.y) > 2) return b.y - a.y;
    return a.x - b.x;
  });

  const lines: PdfTextLine[] = [];
  for (const chunk of chunks) {
    const prev = lines[lines.length - 1];
    if (prev && prev.pageIndex === chunk.pageIndex && Math.abs(prev.y - chunk.y) <= 3) {
      prev.text = `${prev.text} ${chunk.text}`.replace(/\s+/g, " ").trim();
      prev.width = Math.max(prev.width, chunk.x + chunk.width - prev.x);
      prev.height = Math.max(prev.height, chunk.height);
      continue;
    }
    lines.push({ ...chunk });
  }
  return lines;
}

/** Extract grouped text lines with PDF coordinates from a template PDF. */
export async function extractPdfTextLines(pdfBytes: Uint8Array): Promise<PdfTextLine[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: pdfBytes.slice() });
  const pdf = await loadingTask.promise;
  const lines: PdfTextLine[] = [];

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    lines.push(
      ...groupTextItemsIntoLines(
        textContent.items as Array<{ str: string; transform: number[]; width: number; height: number }>,
        pageIndex
      )
    );
    void viewport;
  }

  await pdf.destroy();
  return lines;
}

function wrapToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

function fitFontSize(text: string, font: PDFFont, startSize: number, maxWidth: number): number {
  let size = startSize;
  while (size > 8 && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function coverRect(page: PDFPage, x: number, y: number, width: number, height: number, padding = 3) {
  page.drawRectangle({
    x: x - padding,
    y: y - padding,
    width: width + padding * 2,
    height: height + padding * 2,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });
}

function drawUniversityLine(
  page: PDFPage,
  font: PDFFont,
  line: PdfTextLine,
  newName: string,
  pageWidth: number
) {
  const maxWidth = Math.max(line.width, pageWidth - 72);
  const singleLineSize = fitFontSize(newName, font, Math.max(line.height, 11), maxWidth);
  if (font.widthOfTextAtSize(newName, singleLineSize) <= maxWidth) {
    coverRect(page, line.x, line.y - 2, line.width, line.height + 4);
    page.drawText(newName, {
      x: line.x,
      y: line.y,
      size: singleLineSize,
      font,
      color: rgb(0, 0, 0),
    });
    return;
  }

  const wrapped = wrapToWidth(newName, font, singleLineSize, maxWidth);
  coverRect(page, line.x, line.y - 2, maxWidth, line.height + wrapped.length * (singleLineSize + 3));
  let y = line.y + (wrapped.length - 1) * (singleLineSize + 3);
  for (const row of wrapped) {
    page.drawText(row, {
      x: line.x,
      y,
      size: singleLineSize,
      font,
      color: rgb(0, 0, 0),
    });
    y -= singleLineSize + 3;
  }
}

export function inferLogoCoverRegion(lines: PdfTextLine[], pageIndex = 0): LogoCoverRegion {
  const pageLines = lines.filter((line) => line.pageIndex === pageIndex);
  const uniLines = pageLines.filter((line) => /university|college|institute/i.test(line.text));

  if (uniLines.length >= 2) {
    const upperLine = uniLines.reduce((a, b) => (a.y > b.y ? a : b));
    const lowerLine = uniLines.reduce((a, b) => (a.y < b.y ? a : b));
    const logoBottom = lowerLine.y + lowerLine.height + 4;
    const logoTop = upperLine.y - 4;
    const height = Math.max(logoTop - logoBottom, 90);
    const width = Math.min(Math.max(upperLine.width, lowerLine.width, 180), 260);
    const centerX = (upperLine.x + lowerLine.x) / 2 + (upperLine.width + lowerLine.width) / 4;
    const x = Math.max(36, Math.min(centerX - width / 2, A4_WIDTH - width - 36));
    return { pageIndex, x, y: logoBottom, width, height };
  }

  if (uniLines.length === 1) {
    const line = uniLines[0];
    const width = Math.min(Math.max(line.width, 180), 260);
    const x = Math.max(36, line.x + line.width / 2 - width / 2);
    return { pageIndex, x, y: line.y - 130, width, height: 120 };
  }

  return defaultLogoCoverRegion(pageIndex);
}

export function findUniversityLinesToReplace(
  lines: PdfTextLine[],
  catalogUniversityNames: string[],
  selectedUniversityName: string
): PdfTextLine[] {
  const hits: PdfTextLine[] = [];
  for (const line of lines) {
    const pageHeight = A4_HEIGHT;
    if (
      shouldReplaceUniversityLine(
        line.text,
        line.pageIndex,
        line.y,
        pageHeight,
        catalogUniversityNames,
        selectedUniversityName
      )
    ) {
      hits.push(line);
    }
  }
  return hits;
}

function looksLikeCampusAddress(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8 || trimmed.length > 120) return false;
  if (/university|college|institute|internship report|submitted by/i.test(trimmed)) return false;
  return /\d{5,6}|,\s*[A-Za-z]|nagar|road|street|pin|bihar|patna|muzaffarpur|madhepura|district/i.test(
    trimmed
  );
}

function coverAddressBelowUniversity(page: PDFPage, uniLine: PdfTextLine, lines: PdfTextLine[]) {
  const below = lines.find(
    (candidate) =>
      candidate.pageIndex === uniLine.pageIndex &&
      candidate.y < uniLine.y &&
      uniLine.y - candidate.y <= 24 &&
      looksLikeCampusAddress(candidate.text)
  );
  if (!below) return;
  coverRect(page, below.x, below.y - 2, Math.max(below.width, 320), below.height + 4, 4);
}

export function applyUniversityTextReplacements(
  pages: PDFPage[],
  font: PDFFont,
  lines: PdfTextLine[],
  catalogUniversityNames: string[],
  selectedUniversityName: string
) {
  const targets = findUniversityLinesToReplace(lines, catalogUniversityNames, selectedUniversityName);
  for (const line of targets) {
    const page = pages[line.pageIndex];
    if (!page) continue;
    const { width: pageWidth } = page.getSize();
    coverAddressBelowUniversity(page, line, lines);
    drawUniversityLine(page, font, line, selectedUniversityName, pageWidth);
  }
  return targets.length;
}

export function defaultLogoCoverRegion(pageIndex = 0): LogoCoverRegion {
  return {
    pageIndex,
    x: (A4_WIDTH - 180) / 2,
    y: 470,
    width: 180,
    height: 120,
  };
}
