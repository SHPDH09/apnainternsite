/**
 * Cloudflare Worker — proxy /auth, /rest, /storage, /functions, /api to AWS Lambda.
 * Static SPA files are served via the ASSETS binding (dist/).
 *
 * Workers static _redirects cannot proxy to external URLs (Pages-only feature).
 */

export interface Env {
  ASSETS: Fetcher;
  LAMBDA_ORIGIN: string;
}

const PROXY_PREFIXES = ["/auth", "/rest", "/storage", "/functions", "/api"];

/** Staging API Gateway base — used when LAMBDA_ORIGIN is missing in Worker env. */
const DEFAULT_LAMBDA_ORIGIN =
  "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging";

function lambdaOrigin(env: Env): string {
  let origin = (env.LAMBDA_ORIGIN || DEFAULT_LAMBDA_ORIGIN).replace(/\/$/, "");
  // Dashboard often sets origin without /staging — API Gateway requires the stage path.
  if (/execute-api\.[a-z0-9-]+\.amazonaws\.com$/i.test(origin)) {
    origin = `${origin}/staging`;
  }
  return origin;
}

function shouldProxy(pathname: string): boolean {
  return PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function proxyToLambda(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, lambdaOrigin(env));

  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  return fetch(new Request(target.toString(), init));
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
