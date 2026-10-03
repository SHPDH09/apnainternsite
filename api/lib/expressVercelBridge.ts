import type { VercelRequest, VercelResponse } from "@vercel/node";
import serverless from "serverless-http";

let handlerPromise: Promise<ReturnType<typeof serverless>> | null = null;

function rewriteUrl(req: VercelRequest, stripPrefix: string, mount: string): void {
  let raw = req.url || "/";
  raw = raw.replace(/^\/staging(?=\/)/, "");
  const q = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
  const pathOnly = raw.split("?")[0] || "/";
  let rest = pathOnly;
  if (pathOnly.startsWith(stripPrefix)) {
    rest = pathOnly.slice(stripPrefix.length) || "/";
  } else if (pathOnly.startsWith(mount)) {
    rest = pathOnly.slice(mount.length) || "/";
  }
  req.url = `${mount}${rest.startsWith("/") ? rest : `/${rest}`}${q}`;
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
