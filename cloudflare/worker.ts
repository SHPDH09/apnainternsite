/**
 * Cloudflare Worker — proxy /auth, /rest, /storage, /functions, /api to AWS Lambda.
 * Also accepts /staging/* from the SPA (Cloudflare *.workers.dev uses /staging prefix).
 * Static SPA files are served via the ASSETS binding (dist/).
 */

export interface Env {
  ASSETS: Fetcher;
  LAMBDA_ORIGIN: string;
  LAMBDA_STAGE?: string;
}

const API_PREFIXES = ["/auth", "/rest", "/storage", "/functions", "/api"];
const STAGE_SEGMENT = "/staging";

const DEFAULT_LAMBDA_ORIGIN =
  "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging";

function lambdaOrigin(env: Env): string {
  const stage = String(env.LAMBDA_STAGE || "staging")
    .replace(/^\//, "")
    .replace(/\/$/, "");
  let origin = (env.LAMBDA_ORIGIN || DEFAULT_LAMBDA_ORIGIN).replace(/\/$/, "");
  origin = origin.replace(/\/staging$/i, "").replace(/\/production$/i, "");
  if (/execute-api\.[a-z0-9-]+\.amazonaws\.com$/i.test(origin) && stage) {
    origin = `${origin}/${stage}`;
  }
  return origin;
}

/** Map browser path → path relative to lambdaOrigin (which already includes /staging). */
function upstreamPath(pathname: string): string {
  if (pathname === STAGE_SEGMENT || pathname.startsWith(`${STAGE_SEGMENT}/`)) {
    return pathname.slice(STAGE_SEGMENT.length) || "/";
  }
  return pathname;
}

function shouldProxy(pathname: string): boolean {
  if (pathname === STAGE_SEGMENT || pathname.startsWith(`${STAGE_SEGMENT}/`)) {
    return true;
  }
  return API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function proxyToLambda(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = upstreamPath(url.pathname);
  const target = new URL(path + url.search, lambdaOrigin(env));

  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  return fetch(target.toString(), init);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/cyber-cafe/login") {
      return Response.redirect(`${url.origin}/cybercafe/login`, 301);
    }

    if (shouldProxy(url.pathname)) {
      return proxyToLambda(request, env);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
