import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runExpressOnVercel } from "./lib/expressVercelBridge.js";

type Surface = "rest" | "auth" | "storage";

function parseShimRequest(req: VercelRequest): { surface: Surface; mountPath: string } | null {
  const rawUrl = req.url || "/";
  const qIndex = rawUrl.indexOf("?");
  const pathOnly = qIndex >= 0 ? rawUrl.slice(0, qIndex) : rawUrl;
  const query = qIndex >= 0 ? rawUrl.slice(qIndex + 1) : "";

  const fromQuery = new URLSearchParams(query);
  const surfaceParam = fromQuery.get("__surface")?.trim();
  const pathParam = fromQuery.get("__path")?.trim();

  if (surfaceParam === "rest" || surfaceParam === "auth" || surfaceParam === "storage") {
    fromQuery.delete("__surface");
    fromQuery.delete("__path");
    const rest = pathParam?.replace(/^\//, "") || "";
    const tail = rest ? `/${rest}` : "";
    const q = fromQuery.toString();
    return {
      surface: surfaceParam,
      mountPath: `/${surfaceParam}${tail}${q ? `?${q}` : ""}`,
    };
  }

  const m = pathOnly.match(/^\/api\/(rest|auth|storage)(\/.*)?$/);
  if (m) {
    const surface = m[1] as Surface;
    const tail = m[2] || "";
    const q = query ? `?${query}` : "";
    return { surface, mountPath: `/${surface}${tail}${q}` };
  }

  return null;
}

/** Single Vercel function entry for PostgREST + GoTrue + storage (Hyderabad RDS). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const parsed = parseShimRequest(req);
  if (!parsed) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  req.url = parsed.mountPath;
  const stripPrefix = `/api/${parsed.surface}`;
  const mount = `/${parsed.surface}`;
  return runExpressOnVercel(req, res, { stripPrefix, mount });
}

export const config = {
  api: { bodyParser: false },
};
