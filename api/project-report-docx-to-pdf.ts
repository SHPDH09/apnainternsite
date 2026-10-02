/**
 * POST /api/project-report-docx-to-pdf — admin-only Word (.docx) → PDF for project report templates.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Busboy from "busboy";
import { verifyBearerSession } from "./lib/verifyBearerSession.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

function bearer(req: VercelRequest): string | null {
  const h = req.headers.authorization || req.headers.Authorization;
  const raw = Array.isArray(h) ? h[0] : h;
  const m = raw ? String(raw).match(/^Bearer\s+(.+)$/i) : null;
  return m?.[1]?.trim() || null;
}

function readUpload(req: VercelRequest): Promise<{ buffer: Buffer; fileName: string }> {
  return new Promise((resolve, reject) => {
    const ct = String(req.headers["content-type"] || "");
    if (!ct.includes("multipart/form-data")) {
      reject(new Error("Upload the Word file as multipart form data."));
      return;
    }

    const busboy = Busboy({ headers: req.headers as Record<string, string> });
    const chunks: Buffer[] = [];
    let fileName = "template.docx";

    busboy.on("file", (_field, stream, info) => {
      fileName = info.filename || fileName;
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    });

    busboy.on("finish", () => {
      resolve({ buffer: Buffer.concat(chunks), fileName });
    });

    busboy.on("error", reject);
    req.pipe(busboy);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ ok: false, message: "Authorization Bearer token required" });
  }
  const session = await verifyBearerSession(token);
  if (!session?.sub) {
    return res.status(401).json({ ok: false, message: "Invalid or expired session" });
  }

  try {
    const { assertAdminUserId } = await import("../aws/server/project-report-template-save.js");
    await assertAdminUserId(session.sub);

    const { buffer, fileName } = await readUpload(req);
    const { convertDocxBufferToPdf, isDocxMime } = await import(
      "../aws/server/project-report-docx-to-pdf.js"
    );

    if (!isDocxMime("", fileName)) {
      return res.status(400).json({ ok: false, message: "Please upload a Word (.docx) file." });
    }

    const pdf = await convertDocxBufferToPdf(buffer);
    const outName = fileName.replace(/\.docx?$/i, ".pdf");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${outName.replace(/"/g, "")}"`);
    return res.status(200).send(pdf);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[project-report-docx-to-pdf]", message);
    return res.status(503).json({ ok: false, message });
  }
}
