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

let surfaceHandlerPromise: Promise<
  (req: VercelRequest, res: VercelResponse) => Promise<void>
> | null = null;

function loadSurfaceHandler(): Promise<(req: VercelRequest, res: VercelResponse) => Promise<void>> {
  if (!surfaceHandlerPromise) {
    surfaceHandlerPromise = import("./.bundled/supabase-surface.mjs").then((mod) => mod.default);
  }
  return surfaceHandlerPromise;
}

/** GoTrue settings — no Postgres; avoid cold-loading the full surface bundle. */
function authSettingsFast(_req: VercelRequest, res: VercelResponse): void {
  res.status(200).json({
    external: {},
    disable_signup: false,
    mailer_autoconfirm: true,
    phone_autoconfirm: true,
    sms_provider: "",
    saml_enabled: false,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const rewritten = portalPathFromRequest(req);
  const pathOnly = rewritten.split("?")[0] || "/";
  if (pathOnly === "/auth/v1/settings") {
    authSettingsFast(req, res);
    return;
  }

  req.url = rewritten;
  const fn = await loadSurfaceHandler();
  await fn(req, res);
}

export const config = {
  maxDuration: 60,
  memory: 1024,
};
