const DEFAULT_VERCEL_MAIL_ORIGIN = "https://apnainternsite.vercel.app";

export function vercelMailOrigin(env: { VERCEL_MAIL_ORIGIN?: string }): string {
  return String(env.VERCEL_MAIL_ORIGIN || DEFAULT_VERCEL_MAIL_ORIGIN).replace(/\/$/, "");
}

/** When Worker SMTP is unconfigured or fails, relay OTP to Vercel (SMTP already works there). */
export async function proxyOtpDeliverToVercel(
  request: Request,
  env: { VERCEL_MAIL_ORIGIN?: string },
  jsonBody?: Record<string, unknown>,
): Promise<Response> {
  const origin = vercelMailOrigin(env);
  const url = new URL(request.url);
  const target = `${origin}${url.pathname}${url.search}`;

  const init: RequestInit = {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
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
  const headers = new Headers(res.headers);
  headers.set("X-Otp-Delivery", "vercel-fallback");
  return new Response(body, { status: res.status, headers });
}
