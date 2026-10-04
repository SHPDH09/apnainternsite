import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleVercelStorageRequest } from "../aws/server/vercel-storage-request.js";

function buildStorageUrl(req: VercelRequest): string {
  const pathPart = String(req.query.path || "")
    .replace(/^\/+/, "")
    .replace(/,/g, "/");
  const raw = req.url || "/";
  const qIdx = raw.indexOf("?");
  const q = qIdx >= 0 ? raw.slice(qIdx + 1) : "";
  const params = new URLSearchParams(q);
  params.delete("path");
  const tail = params.toString();
  const base = `/storage/v1/${pathPart}`;
  return tail ? `${base}?${tail}` : base;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  req.url = buildStorageUrl(req);
  await handleVercelStorageRequest(req, res);
}

export const config = {
  maxDuration: 120,
  memory: 1024,
  api: {
    bodyParser: false,
  },
};
