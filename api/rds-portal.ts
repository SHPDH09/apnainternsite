import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Pool, type PoolClient } from "pg";
import { getRpcDef } from "../aws/server/rpc-registry.js";
import {
  signAccessToken,
  signRefreshToken,
  userFromPayload,
  verifyToken,
} from "../aws/server/local-jwt.js";

function portalPathFromRequest(req: VercelRequest): string {
  const segment = String(req.query.segment || "").trim();
  const restPath = String(req.query.path || "").trim();
  const raw = req.url || "/";
  const qIdx = raw.indexOf("?");
  const q = qIdx >= 0 ? raw.slice(qIdx) : "";

  if (segment && restPath) {
    const base = `/${segment}/${restPath.replace(/^\//, "")}`;
    const params = new URLSearchParams(q.replace(/^\?/, ""));
    params.delete("segment");
    params.delete("path");
    const tail = params.toString();
    return tail ? `${base}?${tail}` : base;
  }

  return raw;
}

const TABLE = /^[a-z_][a-z0-9_]*$/i;
const IDENT = /^[a-z_][a-z0-9_]*$/i;
const TS_RPC = new Set([
  "admin_ensure_site_cms_tables",
  "admin_ensure_dashboard_service_keys",
  "admin_ensure_partner_applications",
  "admin_ensure_project_report_templates",
  "student_ensure_uniqueness_schema",
]);

/** Granted to anon in Postgres; supabase-js often sends Bearer local-anon-key until refresh completes. */
const PAYMENT_GATE_RPC = new Set([
  "student_has_paid_enrollment",
  "student_recover_paid_enrollment",
]);

const LOCAL_ANON_KEY = String(
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "local-anon-key"
).trim();

type JwtClaims = { sub: string; email?: string; role?: string };

let litePool: Pool | null = null;

function jwtSecret(): string {
  return (
    process.env.LOCAL_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "ezyintern-local-dev-secret-change-me"
  );
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

function claimsFromPayload(payload: jwt.JwtPayload): JwtClaims | null {
  if (!payload?.sub) return null;
  const sub = String(payload.sub).trim();
  if (!/^[0-9a-f-]{36}$/i.test(sub)) return null;
  return {
    sub,
    email: payload.email ? String(payload.email) : undefined,
    role: payload.role ? String(payload.role) : "authenticated",
  };
}

function jwtFromRequest(req: VercelRequest, strictVerify: boolean): JwtClaims | null {
  const token = bearerToken(req);
  if (!token || isAnonApiBearer(req, token)) return null;
  if (!token.includes(".")) return null;

  const secrets = [jwtSecret(), process.env.SUPABASE_JWT_SECRET?.trim()].filter(Boolean) as string[];

  for (const secret of secrets) {
    try {
      const payload = jwt.verify(token, secret, {
        issuer: "ezyintern-local",
      }) as jwt.JwtPayload;
      const claims = claimsFromPayload(payload);
      if (claims) return claims;
    } catch {
      /* try next secret / fallback */
    }
    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload;
      const claims = claimsFromPayload(payload);
      if (claims) return claims;
    } catch {
      /* try next */
    }
  }

  if (strictVerify) return null;

  try {
    const payload = jwt.decode(token) as jwt.JwtPayload | null;
    return claimsFromPayload(payload || {});
  } catch {
    return null;
  }
}

async function applyJwtClaims(client: PoolClient, jwtClaims: JwtClaims | null): Promise<void> {
  if (!jwtClaims?.sub) return;
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [jwtClaims.sub]);
  await client.query(`SELECT set_config('request.jwt.claim.role', $1, true)`, [
    jwtClaims.role || "authenticated",
  ]);
  if (jwtClaims.email) {
    await client.query(`SELECT set_config('request.jwt.claim.email', $1, true)`, [
      jwtClaims.email,
    ]);
  }
}

function rpcBody(req: VercelRequest): Record<string, unknown> {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return req.body as Record<string, unknown>;
  }
  return {};
}

function bindRpcArg(
  val: unknown,
  pgType: string | undefined,
  paramIndex: number
): { placeholder: string; value: unknown } {
  const t = (pgType || "").toLowerCase();
  if (val === null || val === undefined) {
    return { placeholder: `$${paramIndex}`, value: null };
  }
  if (t === "jsonb" || t === "json") {
    return {
      placeholder: `$${paramIndex}::${t}`,
      value: typeof val === "string" ? val : JSON.stringify(val),
    };
  }
  if (
    typeof val === "object" &&
    !(val instanceof Date) &&
    !Buffer.isBuffer(val) &&
    (!Array.isArray(val) ||
      val.some((x) => x !== null && typeof x === "object" && !(x instanceof Date)))
  ) {
    return {
      placeholder: `$${paramIndex}::jsonb`,
      value: JSON.stringify(val),
    };
  }
  if (Array.isArray(val) && t.endsWith("[]")) {
    return { placeholder: `$${paramIndex}::${t}`, value: val };
  }
  return { placeholder: `$${paramIndex}`, value: val };
}

async function callRpcLite(
  fnName: string,
  argOrder: string[],
  args: Record<string, unknown>,
  jwtClaims: JwtClaims | null
): Promise<unknown> {
  const client = await getLitePool().connect();
  try {
    await client.query("BEGIN");
    await applyJwtClaims(client, jwtClaims);

    const { rows: metaRows } = await client.query<{
      proretset: boolean;
      proargnames: string[] | null;
      argtypes: string[] | null;
    }>(
      `SELECT p.proretset,
              p.proargnames,
              ARRAY(
                SELECT format_type(t, NULL)
                FROM unnest(p.proargtypes) AS t
              ) AS argtypes
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = $1 AND p.prokind = 'f'
       ORDER BY p.oid
       LIMIT 1`,
      [fnName]
    );
    if (!metaRows[0]) {
      throw new Error(`Function public.${fnName} does not exist`);
    }

    const isSet = Boolean(metaRows[0].proretset);
    const pgNames = metaRows[0].proargnames || [];
    const pgTypes = metaRows[0].argtypes || [];
    const typeByName = new Map<string, string>();
    for (let i = 0; i < pgNames.length; i++) {
      if (pgNames[i]) typeByName.set(pgNames[i], pgTypes[i] || "");
    }

    const placeholders: string[] = [];
    const values: unknown[] = [];
    argOrder.forEach((key, i) => {
      const bound = bindRpcArg(key in args ? args[key] : null, typeByName.get(key), i + 1);
      placeholders.push(bound.placeholder);
      values.push(bound.value);
    });
    const ph = placeholders.join(", ");

    if (isSet) {
      const setSql =
        argOrder.length === 0
          ? `SELECT row_to_json(t) AS row FROM (SELECT * FROM public.${fnName}()) t`
          : `SELECT row_to_json(t) AS row FROM (SELECT * FROM public.${fnName}(${ph})) t`;
      const { rows } = await client.query<{ row: unknown }>(setSql, values);
      await client.query("COMMIT");
      return rows.map((r) => r.row);
    }

    const sql =
      argOrder.length === 0
        ? `SELECT public.${fnName}() AS result`
        : `SELECT public.${fnName}(${ph}) AS result`;
    const { rows } = await client.query<{ result: unknown }>(sql, values);
    await client.query("COMMIT");
    return rows[0]?.result ?? null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function tryRpcLite(req: VercelRequest, res: VercelResponse, pathOnly: string): Promise<boolean> {
  if (req.method !== "POST") return false;
  const m = pathOnly.match(/^\/rest\/v1\/rpc\/([a-z_][a-z0-9_]*)$/i);
  if (!m) return false;
  const name = m[1];
  if (TS_RPC.has(name)) return false;

  const def = getRpcDef(name);
  if (!def) return false;

  const paymentGateRpc = PAYMENT_GATE_RPC.has(name);
  const strictJwt = def.auth === "admin" || name.startsWith("admin_");
  const jwtClaims = jwtFromRequest(req, strictJwt);
  const requiresJwt =
    def.auth === "auth" ||
    def.auth === "admin" ||
    name.startsWith("admin_") ||
    name.startsWith("student_") ||
    name.startsWith("sync_") ||
    name.startsWith("get_referral_partner_");
  if (requiresJwt && !paymentGateRpc) {
    if (def.auth === "public") {
      // registry-public RPCs (e.g. repair_student_auth_login) — allow without token
    } else if (!jwtClaims) {
      res.status(401).json({ message: "JWT required" });
      return true;
    }
  }

  try {
    const data = await callRpcLite(name, def.args, rpcBody(req), jwtClaims);
    res.status(200).json(data);
    return true;
  } catch (err) {
    res.status(400).json({
      message: err instanceof Error ? err.message : String(err),
      code: (err as { code?: string }).code,
    });
    return true;
  }
}

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

function parseSelect(raw: unknown): string {
  const s = String(raw || "*").trim();
  if (!s || s === "*") return "*";
  const cols = s
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .filter((c) => IDENT.test(c));
  return cols.length ? cols.map((c) => `"${c}"`).join(", ") : "*";
}

function parseOrder(raw: unknown): string {
  if (!raw) return "";
  const s = String(Array.isArray(raw) ? raw[0] : raw);
  const bits: string[] = [];
  for (const part of s.split(",")) {
    const tokens = part.trim().split(".").filter(Boolean);
    const col = tokens[0];
    if (!col || !IDENT.test(col)) continue;
    const dir = tokens[1]?.toLowerCase() === "desc" ? "DESC" : "ASC";
    let nulls = "";
    if (tokens.some((t) => t.toLowerCase() === "nullslast")) nulls = " NULLS LAST";
    else if (tokens.some((t) => t.toLowerCase() === "nullsfirst")) nulls = " NULLS FIRST";
    bits.push(`"${col}" ${dir}${nulls}`);
  }
  return bits.length ? ` ORDER BY ${bits.join(", ")}` : "";
}

function buildWhere(query: VercelRequest["query"]): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const parts: string[] = [];
  for (const [key, rawVal] of Object.entries(query)) {
    if (["segment", "path", "select", "order", "limit", "offset"].includes(key)) continue;
    if (!IDENT.test(key)) continue;
    const val = Array.isArray(rawVal) ? rawVal[0] : rawVal;
    const s = String(val ?? "");
    const m = s.match(/^(eq|neq|gt|gte|lt|lte|like|ilike)\.(.*)$/i);
    if (!m) continue;
    const op = m[1].toLowerCase();
    const rhs = m[2];
    if (rhs === "null") {
      parts.push(`"${key}" IS NULL`);
      continue;
    }
    let bind: unknown = rhs;
    if (rhs === "true") bind = true;
    else if (rhs === "false") bind = false;
    params.push(bind);
    const ph = `$${params.length}`;
    const col = `"${key}"`;
    if (op === "eq") parts.push(`${col} = ${ph}`);
    else if (op === "neq") parts.push(`${col} <> ${ph}`);
    else if (op === "gt") parts.push(`${col} > ${ph}`);
    else if (op === "gte") parts.push(`${col} >= ${ph}`);
    else if (op === "lt") parts.push(`${col} < ${ph}`);
    else if (op === "lte") parts.push(`${col} <= ${ph}`);
    else if (op === "like") parts.push(`${col} LIKE ${ph}`);
    else if (op === "ilike") parts.push(`${col} ILIKE ${ph}`);
  }
  return { sql: parts.length ? parts.join(" AND ") : "", params };
}

async function tryRestLite(req: VercelRequest, res: VercelResponse, pathOnly: string): Promise<boolean> {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const m = pathOnly.match(/^\/rest\/v1\/([a-z_][a-z0-9_]*)/i);
  if (!m) return false;
  const table = m[1];
  if (!TABLE.test(table)) {
    res.status(400).json({ message: "Invalid table" });
    return true;
  }

  const cols = parseSelect(req.query.select);
  const limit = Math.min(Math.max(Number(req.query.limit) || 1000, 1), 5000);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const { sql: where, params } = buildWhere(req.query);
  const order = parseOrder(req.query.order);

  let sql = `SELECT ${cols} FROM public."${table}"`;
  if (where) sql += ` WHERE ${where}`;
  sql += order;
  sql += ` LIMIT ${limit} OFFSET ${offset}`;

  try {
    const { rows } = await getLitePool().query(sql, params);
    if (req.method === "HEAD") {
      res.status(200).end();
      return true;
    }
    res.status(200).json(rows);
    return true;
  } catch (err) {
    res.status(400).json({
      message: err instanceof Error ? err.message : String(err),
    });
    return true;
  }
}

let restHandlerPromise: Promise<
  (req: VercelRequest, res: VercelResponse) => Promise<void>
> | null = null;
let storageHandlerPromise: Promise<
  (req: VercelRequest, res: VercelResponse) => Promise<void>
> | null = null;

function loadRestHandler(): Promise<(req: VercelRequest, res: VercelResponse) => Promise<void>> {
  if (!restHandlerPromise) {
    restHandlerPromise = import("./.bundled/rest-surface.mjs").then((mod) => mod.default);
  }
  return restHandlerPromise;
}

function loadStorageHandler(): Promise<(req: VercelRequest, res: VercelResponse) => Promise<void>> {
  if (!storageHandlerPromise) {
    storageHandlerPromise = import("./.bundled/supabase-surface.mjs").then((mod) => mod.default);
  }
  return storageHandlerPromise;
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

function authJsonBody(req: VercelRequest): Record<string, unknown> {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return req.body as Record<string, unknown>;
  }
  return {};
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

async function tryAuthLite(
  req: VercelRequest,
  res: VercelResponse,
  pathOnly: string
): Promise<boolean> {
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const rewritten = portalPathFromRequest(req);
  const pathOnly = rewritten.split("?")[0] || "/";
  if (pathOnly === "/auth/v1/settings") {
    authSettingsFast(req, res);
    return;
  }
  if (pathOnly === "/auth/v1/logout" && (req.method === "POST" || req.method === "GET")) {
    authLogoutFast(req, res);
    return;
  }
  const authHandled = await tryAuthLite(req, res, pathOnly);
  if (authHandled) return;

  if (pathOnly.startsWith("/rest/")) {
    const rpcHandled = await tryRpcLite(req, res, pathOnly);
    if (rpcHandled) return;
    const handled = await tryRestLite(req, res, pathOnly);
    if (handled) return;
  }

  req.url = rewritten;
  const fn = pathOnly.startsWith("/rest/")
    ? await loadRestHandler()
    : await loadStorageHandler();
  await fn(req, res);
}

export const config = {
  maxDuration: 60,
  memory: 1024,
};
