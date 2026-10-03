import type { VercelRequest, VercelResponse } from "@vercel/node";

function portalPathFromRequest(req: VercelRequest): string {
  const segment = String(req.query.segment || "").trim();
  const restPath = String(req.query.path || "").trim();
  const raw = req.url || "/";
  const qIdx = raw.indexOf("?");
  const q = qIdx >= 0 ? raw.slice(qIdx) : "";

  if (segment && restPath) {
    const base = `/${segment}/${restPath.replace(/^\//, "")}`;
    const params = new URLSearchParams(q.replace(/^\?/, ""));
    params.delete("segment");
    params.delete("path");
    const tail = params.toString();
    return tail ? `${base}?${tail}` : base;
  }

  return raw;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const mod = await import("./.bundled/supabase-surface.mjs");
  const fn = mod.default as (req: VercelRequest, res: VercelResponse) => Promise<void>;
  req.url = portalPathFromRequest(req);
  await fn(req, res);
}

export const config = {
  maxDuration: 60,
};
