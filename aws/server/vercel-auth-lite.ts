/**
 * Lightweight GoTrue-compatible auth for Vercel (no rest-surface bundle).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import {
  signAccessToken,
  signRefreshToken,
  userFromPayload,
  verifyToken,
} from "./local-jwt.js";

const LOCAL_ANON_KEY = String(
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "local-anon-key"
).trim();

type AuthUserRow = {
  id: string;
  email: string | null;
  encrypted_password: string | null;
  banned_until: string | null;
  email_confirmed_at: string | null;
  raw_app_meta_data: Record<string, unknown> | null;
  raw_user_meta_data: Record<string, unknown> | null;
  role: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_sign_in_at: string | null;
};

let litePool: Pool | null = null;

function liteConnectionString(): string {
  const raw = String(process.env.DATABASE_URL || "").trim();
  if (!raw) throw new Error("DATABASE_URL missing");
  return raw
    .replace(/([?&])sslmode=[^&]*/gi, "$1")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?");
}

function getLitePool(): Pool {
  if (!litePool) {
    litePool = new Pool({
      connectionString: liteConnectionString(),
      max: 2,
      connectionTimeoutMillis: 12_000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return litePool;
}

export function authPathFromVercelRequest(req: VercelRequest): string {
  const segment = String(req.query.segment || "auth").trim();
  const restPath = String(req.query.path || "").trim();
  if (restPath) {
    return `/${segment}/${restPath.replace(/^\//, "")}`.split("?")[0] || "/auth/v1/settings";
  }
  const raw = req.url || "/";
  const pathOnly = raw.split("?")[0] || "/";
  if (pathOnly.includes("/api/auth-portal")) {
    return "/auth/v1/settings";
  }
  return pathOnly;
}

function authJsonBody(req: VercelRequest): Record<string, unknown> {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return req.body as Record<string, unknown>;
  }
  return {};
}

function bearerToken(req: VercelRequest): string | null {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function isAnonApiBearer(req: VercelRequest, token: string): boolean {
  if (token === LOCAL_ANON_KEY) return true;
  const apikey = String(req.headers.apikey || "").trim();
  return Boolean(apikey && token === apikey && token === LOCAL_ANON_KEY);
}

function supabaseAuthUser(row: AuthUserRow) {
  return {
    id: row.id,
    aud: "authenticated",
    role: row.role || "authenticated",
    email: row.email,
    email_confirmed_at: row.email_confirmed_at,
    phone: "",
    confirmed_at: row.email_confirmed_at,
    last_sign_in_at: row.last_sign_in_at || new Date().toISOString(),
    app_metadata: row.raw_app_meta_data || { provider: "email", providers: ["email"] },
    user_metadata: row.raw_user_meta_data || {},
    identities: [],
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  };
}

function tokenResponseForRow(row: AuthUserRow) {
  const user = supabaseAuthUser(row);
  const access_token = signAccessToken({
    id: row.id,
    email: row.email || "",
    role: "authenticated",
    app_metadata: user.app_metadata as Record<string, unknown>,
    user_metadata: user.user_metadata as Record<string, unknown>,
  });
  const refresh_token = signRefreshToken({
    id: row.id,
    email: row.email || "",
  });
  return {
    access_token,
    token_type: "bearer",
    expires_in: 43200,
    expires_at: Math.floor(Date.now() / 1000) + 43200,
    refresh_token,
    user,
  };
}

async function findAuthUserByEmail(email: string): Promise<AuthUserRow | null> {
  const { rows } = await getLitePool().query<AuthUserRow>(
    `SELECT id, email, encrypted_password, banned_until, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, role, created_at, updated_at, last_sign_in_at
     FROM auth.users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email.trim()]
  );
  return rows[0] || null;
}

async function findAuthUserById(id: string): Promise<AuthUserRow | null> {
  const { rows } = await getLitePool().query<AuthUserRow>(
    `SELECT id, email, encrypted_password, banned_until, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, role, created_at, updated_at, last_sign_in_at
     FROM auth.users WHERE id = $1::uuid LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

function authSettingsFast(_req: VercelRequest, res: VercelResponse): void {
  res.status(200).json({
    external: {},
    disable_signup: false,
    mailer_autoconfirm: true,
    phone_autoconfirm: true,
    sms_provider: "",
    saml_enabled: false,
  });
}

function authLogoutFast(_req: VercelRequest, res: VercelResponse): void {
  res.status(204).end();
}

async function authTokenLite(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const body = authJsonBody(req);
    const grant =
      String(req.query.grant_type || body.grant_type || "").trim() || "password";

    if (grant === "refresh_token") {
      const refresh = body.refresh_token || body.refreshToken || req.query.refresh_token;
      if (!refresh) {
        res.status(400).json({
          error: "invalid_request",
          error_description: "refresh_token required",
        });
        return;
      }
      const payload = verifyToken(String(refresh));
      if (!payload?.sub || payload.typ !== "refresh") {
        res.status(401).json({
          error: "invalid_grant",
          error_description: "Invalid refresh token",
        });
        return;
      }
      const row = await findAuthUserById(String(payload.sub));
      if (!row) {
        res.status(401).json({ error: "invalid_grant", error_description: "User not found" });
        return;
      }
      res.status(200).json(tokenResponseForRow(row));
      return;
    }

    if (grant !== "password") {
      res.status(400).json({
        error: "unsupported_grant_type",
        error_description: `grant_type=${grant} not supported locally`,
      });
      return;
    }

    const email = String(body.email || "").trim();
    const password = String(body.password || "");
    if (!email || !password) {
      res.status(400).json({
        error: "invalid_request",
        error_description: "email and password required",
      });
      return;
    }

    let row = await findAuthUserByEmail(email);
    if (!row?.encrypted_password) {
      res.status(400).json({
        error: "invalid_grant",
        error_description: "Invalid login credentials",
      });
      return;
    }

    if (row.banned_until && new Date(row.banned_until).getTime() > Date.now()) {
      res.status(400).json({
        error: "user_banned",
        error_description: "User is banned",
      });
      return;
    }

    let ok = await bcrypt.compare(password, row.encrypted_password);
    if (!ok) {
      try {
        const repaired = await getLitePool().query<{ result: boolean }>(
          `SELECT public.repair_student_auth_login($1, $2) AS result`,
          [email.toLowerCase(), password]
        );
        if (repaired.rows[0]?.result === true) {
          row = (await findAuthUserByEmail(email)) || row;
          if (row.encrypted_password) {
            ok = await bcrypt.compare(password, row.encrypted_password);
          }
        }
      } catch {
        /* optional RPC */
      }
    }

    if (!ok) {
      res.status(400).json({
        error: "invalid_grant",
        error_description: "Invalid login credentials",
      });
      return;
    }

    await getLitePool().query(`UPDATE auth.users SET last_sign_in_at = now() WHERE id = $1::uuid`, [
      row.id,
    ]);
    res.status(200).json(tokenResponseForRow(row));
  } catch (err) {
    res.status(500).json({
      error: "server_error",
      error_description: err instanceof Error ? err.message : String(err),
    });
  }
}

async function authUserLite(req: VercelRequest, res: VercelResponse): Promise<void> {
  const token = bearerToken(req);
  if (!token || isAnonApiBearer(req, token)) {
    res.status(401).json({ error: "no_authorization", msg: "No Authorization header" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload?.sub) {
    res.status(401).json({ error: "invalid_token", msg: "Invalid JWT" });
    return;
  }
  try {
    const row = await findAuthUserById(String(payload.sub));
    if (!row) {
      res.status(200).json(userFromPayload(payload));
      return;
    }
    res.status(200).json(supabaseAuthUser(row));
  } catch (err) {
    res.status(500).json({
      error: "server_error",
      error_description: err instanceof Error ? err.message : String(err),
    });
  }
}

/** @returns true if the auth route was handled. */
export async function handleVercelAuthLite(
  req: VercelRequest,
  res: VercelResponse,
  pathOnly: string
): Promise<boolean> {
  if (pathOnly === "/auth/v1/settings") {
    authSettingsFast(req, res);
    return true;
  }
  if (pathOnly === "/auth/v1/logout" && (req.method === "POST" || req.method === "GET")) {
    authLogoutFast(req, res);
    return true;
  }
  if (pathOnly === "/auth/v1/token" && req.method === "POST") {
    await authTokenLite(req, res);
    return true;
  }
  if (pathOnly === "/auth/v1/user" && req.method === "GET") {
    await authUserLite(req, res);
    return true;
  }
  return false;
}
