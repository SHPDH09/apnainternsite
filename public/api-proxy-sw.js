/**
 * Browser service worker — proxies /auth, /rest, /storage, /functions, /api to Lambda.
 * Fixes "Not Found" when Cloudflare Worker LAMBDA_ORIGIN omits the API Gateway /staging stage.
 */
const LAMBDA_ORIGIN = "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging";
const PROXY_PREFIXES = ["/auth", "/rest", "/storage", "/functions", "/api"];

function shouldProxy(pathname) {
  return PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!shouldProxy(url.pathname)) return;

  const target = new URL(url.pathname + url.search, LAMBDA_ORIGIN);
  const init = {
    method: event.request.method,
    headers: event.request.headers,
    redirect: "manual",
    credentials: event.request.credentials,
  };
  if (event.request.method !== "GET" && event.request.method !== "HEAD") {
    init.body = event.request.body;
  }

  event.respondWith(fetch(new Request(target.toString(), init)));
});
