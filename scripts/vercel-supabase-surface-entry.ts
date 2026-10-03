/**
 * Bundled entry for Vercel — auth/rest/storage on Hyderabad RDS (not stale Lambda).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import serverless from "serverless-http";
import { refreshRdsIamPasswordIfNeeded } from "../aws/server/db.ts";
import { createSupabaseSurfaceApp } from "../aws/server/supabase-surface-app.ts";

type ServerlessHandler = ReturnType<typeof serverless>;

let handlerPromise: Promise<ServerlessHandler> | null = null;

async function getHandler(): Promise<ServerlessHandler> {
  if (!handlerPromise) {
    handlerPromise = createSupabaseSurfaceApp().then((app) => serverless(app));
  }
  return handlerPromise;
}

function rewriteFromVercelPath(req: IncomingMessage): void {
  const raw = req.url || "/";
  const qIdx = raw.indexOf("?");
  const q = qIdx >= 0 ? raw.slice(qIdx) : "";
  let pathOnly = qIdx >= 0 ? raw.slice(0, qIdx) : raw;

  const prefix = "/api/supabase-surface";
  if (pathOnly === prefix) {
    pathOnly = "/";
  } else if (pathOnly.startsWith(`${prefix}/`)) {
    pathOnly = pathOnly.slice(prefix.length) || "/";
  }

  req.url = `${pathOnly}${q}`;
}

export default async function handleSupabaseSurface(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  await refreshRdsIamPasswordIfNeeded();
  rewriteFromVercelPath(req);
  const fn = await getHandler();
  await fn(req, res);
}
