// @ts-nocheck — Vercel typechecks API routes without aws/server in tsconfig paths.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import serverless from "serverless-http";
import { refreshRdsIamPasswordIfNeeded } from "../aws/server/db.js";
import { createSupabaseSurfaceApp } from "../aws/server/supabase-surface-app.js";

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
  if (pathOnly.match(/^\/api\/supabase-surface$/) && surface) {
    const tail = sub ? `/${sub}` : "";
    const q = params.toString();
    return `/${surface}${tail}${q ? `?${q}` : ""}`;
  }
  return null;
}

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      await refreshRdsIamPasswordIfNeeded();
      const app = await createSupabaseSurfaceApp();
      return serverless(app);
    })();
  }
  return handlerPromise;
}

/** PostgREST + GoTrue + storage on Vercel (Hyderabad RDS). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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
