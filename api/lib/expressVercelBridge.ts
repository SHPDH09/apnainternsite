import type { VercelRequest, VercelResponse } from "@vercel/node";
import serverless from "serverless-http";

let handlerPromise: Promise<ReturnType<typeof serverless>> | null = null;

function stripApiGatewayStagePrefix(pathOnly: string): string {
  let p = pathOnly;
  for (const stage of ["/staging", "/production"]) {
    if (p === stage) return "/";
    if (p.startsWith(`${stage}/`)) {
      p = p.slice(stage.length) || "/";
      break;
    }
  }
  return p;
}

function rewriteUrl(req: VercelRequest, stripPrefix: string, mount: string): void {
  let raw = req.url || "/";
  const q = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
  let pathOnly = raw.split("?")[0] || "/";
  pathOnly = stripApiGatewayStagePrefix(pathOnly);
  if (pathOnly.startsWith(stripPrefix)) {
    pathOnly = `${mount}${pathOnly.slice(stripPrefix.length) || ""}` || mount;
  } else if (!pathOnly.startsWith(mount)) {
    pathOnly = `${mount}${pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`}`;
  }
  req.url = `${pathOnly}${q}`;
}

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const { refreshRdsIamPasswordIfNeeded } = await import("../../aws/server/db.js");
      await refreshRdsIamPasswordIfNeeded();
      const { createApp } = await import("../../aws/server/app.js");
      const app = await createApp();
      return serverless(app);
    })();
  }
  return handlerPromise;
}

/** Run Express (auth/rest/storage) on Vercel with Hyderabad DATABASE_URL + RDS IAM. */
export async function runExpressOnVercel(
  req: VercelRequest,
  res: VercelResponse,
  opts: { stripPrefix: string; mount: string }
): Promise<void> {
  const { refreshRdsIamPasswordIfNeeded } = await import("../../aws/server/db.js");
  await refreshRdsIamPasswordIfNeeded();
  rewriteUrl(req, opts.stripPrefix, opts.mount);
  const fn = await getHandler();
  await fn(req, res);
}
