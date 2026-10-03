import type { VercelRequest, VercelResponse } from "@vercel/node";
import serverless from "serverless-http";

let handlerPromise: Promise<ReturnType<typeof serverless>> | null = null;

function targetPath(req: VercelRequest): string | null {
  const raw = req.url || "/";
  const qIndex = raw.indexOf("?");
  const pathOnly = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = qIndex >= 0 ? raw.slice(qIndex + 1) : "";
  const params = new URLSearchParams(query);
  const surface = params.get("__surface")?.trim();
  const sub = params.get("__path")?.trim().replace(/^\//, "") || "";
  params.delete("__surface");
  params.delete("__path");
  if (surface === "rest" || surface === "auth" || surface === "storage") {
    const tail = sub ? `/${sub}` : "";
    const q = params.toString();
    return `/${surface}${tail}${q ? `?${q}` : ""}`;
  }
  const m = pathOnly.match(/^\/api\/supabase-surface$/);
  if (m && surface) {
    const tail = sub ? `/${sub}` : "";
    const q = params.toString();
    return `/${surface}${tail}${q ? `?${q}` : ""}`;
  }
  return null;
}

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const { refreshRdsIamPasswordIfNeeded } = await import("../aws/server/db.js");
      await refreshRdsIamPasswordIfNeeded();
      const { createSupabaseSurfaceApp } = await import("../aws/server/supabase-surface-app.js");
      const app = await createSupabaseSurfaceApp();
      return serverless(app);
    })();
  }
  return handlerPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { refreshRdsIamPasswordIfNeeded } = await import("../aws/server/db.js");
  await refreshRdsIamPasswordIfNeeded();
  const path = targetPath(req);
  if (!path) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  req.url = path;
  const fn = await getHandler();
  await fn(req, res);
}

export const config = {
  api: { bodyParser: false },
};
