const DEFAULT_VERCEL_MAIL_ORIGIN = "https://apnainternsite.vercel.app";

export function vercelMailOrigin(env: { VERCEL_MAIL_ORIGIN?: string }): string {
  return String(env.VERCEL_MAIL_ORIGIN || DEFAULT_VERCEL_MAIL_ORIGIN).replace(/\/$/, "");
}

/** Relay a request to Vercel (same path + query), preserving method/body/headers when provided. */
export async function proxyRequestToVercel(
  request: Request,
  env: { VERCEL_MAIL_ORIGIN?: string },
  jsonBody?: Record<string, unknown>,
): Promise<Response> {
  const origin = vercelMailOrigin(env);
  const url = new URL(request.url);
  const target = `${origin}${url.pathname}${url.search}`;

  const headers = new Headers();
  const auth = request.headers.get("Authorization");
  if (auth) headers.set("Authorization", auth);
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  headers.set("Accept", "application/json");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    if (jsonBody) {
      init.body = JSON.stringify(jsonBody);
    } else {
      init.body = await request.clone().text();
    }
  }

  const res = await fetch(target, init);
  const body = await res.text();
  const outHeaders = new Headers(res.headers);
  outHeaders.set("X-Apna-Proxy", "vercel");
  return new Response(body, { status: res.status, headers: outHeaders });
}

/** When Worker SMTP is unconfigured or fails, relay OTP to Vercel (SMTP already works there). */
export async function proxyOtpDeliverToVercel(
  request: Request,
  env: { VERCEL_MAIL_ORIGIN?: string },
  jsonBody?: Record<string, unknown>,
): Promise<Response> {
  const res = await proxyRequestToVercel(request, env, jsonBody);
  const headers = new Headers(res.headers);
  headers.set("X-Otp-Delivery", "vercel-fallback");
  return new Response(await res.text(), { status: res.status, headers });
}
