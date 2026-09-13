/**
 * Verify admin Bearer tokens on Vercel where LOCAL_JWT_SECRET may differ from Lambda.
 * Tries local verifyToken first, then Lambda /auth/v1/user (same secret as login).
 */
import { verifyToken } from "../../aws/server/local-jwt.js";

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

export async function verifyBearerSession(
  token: string
): Promise<VerifiedBearerSession | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const local = verifyToken(trimmed);
  if (local?.sub) {
    return {
      sub: String(local.sub),
      email: local.email ? String(local.email) : undefined,
    };
  }

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
