/**
 * Verify Bearer tokens on Vercel (no aws/server/local-jwt — safe for send-mail bundle).
 */
const DEFAULT_LAMBDA_API =
  "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging";

function lambdaAuthUrl(): string {
  const raw =
    process.env.LAMBDA_API_URL?.trim() ||
    process.env.STAGING_LAMBDA_API?.trim() ||
    DEFAULT_LAMBDA_API;
  return `${raw.replace(/\/$/, "")}/auth/v1/user`;
}

export type VerifiedBearerSession = {
  sub: string;
  email?: string;
};

async function verifyLocalJwt(token: string): Promise<VerifiedBearerSession | null> {
  try {
    const jwt = await import("jsonwebtoken");
    const secret =
      process.env.LOCAL_JWT_SECRET ||
      process.env.JWT_SECRET ||
      "ezyintern-local-dev-secret-change-me";
    const payload = jwt.default.verify(token, secret, {
      issuer: "ezyintern-local",
    }) as { sub?: string; email?: string };
    if (!payload?.sub) return null;
    return {
      sub: String(payload.sub),
      email: payload.email ? String(payload.email) : undefined,
    };
  } catch {
    try {
      const jwt = await import("jsonwebtoken");
      const secret =
        process.env.LOCAL_JWT_SECRET ||
        process.env.JWT_SECRET ||
        "ezyintern-local-dev-secret-change-me";
      const payload = jwt.default.verify(token, secret) as { sub?: string; email?: string };
      if (!payload?.sub) return null;
      return {
        sub: String(payload.sub),
        email: payload.email ? String(payload.email) : undefined,
      };
    } catch {
      return null;
    }
  }
}

export async function verifyBearerSession(
  token: string
): Promise<VerifiedBearerSession | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const local = await verifyLocalJwt(trimmed);
  if (local?.sub) return local;

  try {
    const res = await fetch(lambdaAuthUrl(), {
      headers: { Authorization: `Bearer ${trimmed}` },
    });
    if (!res.ok) return null;
    const user = (await res.json().catch(() => null)) as {
      id?: string;
      sub?: string;
      email?: string;
    } | null;
    const sub = user?.id || user?.sub;
    if (!sub) return null;
    return {
      sub: String(sub),
      email: user?.email ? String(user.email) : undefined,
    };
  } catch (err) {
    console.warn("[verifyBearerSession] Lambda auth check failed:", err);
    return null;
  }
}
