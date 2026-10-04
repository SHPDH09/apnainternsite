import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import type { PoolClient } from "pg";
import { getRpcDef } from "../aws/server/rpc-registry.js";
import { handleVercelAuthLite } from "../aws/server/vercel-auth-lite.js";
import { getVercelLitePool } from "../aws/server/vercel-lite-pool.js";
import {
  ensureSystemSettingsSchemaVercel,
  isMissingSystemSettingsError,
} from "../aws/server/system-settings-bootstrap.js";
import {
  ensureClassLinkRpc,
  isClassLinkRpc,
  isClassLinkRpcMissingError,
} from "../aws/server/class-link-bootstrap.js";
import {
  ensureCertificateIssueRpc,
  isPublicCertificateVerifyMissingError,
  isPublicCertificateVerifyRpc,
} from "../aws/server/certificate-bootstrap.js";
import {
  ensureAdminRegistrationRpc,
  isRegistrationRpc,
  isRegistrationRpcMismatchError,
} from "../aws/server/registration-bootstrap.js";
import {
  buildWhere,
  parseOrder,
  parseSelect,
} from "../aws/server/vercel-lite-rest-filters.js";

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
  "admin_ensure_system_settings",
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
  const client = await getVercelLitePool().connect();
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

async function tryTsEnsureRpcLite(
  req: VercelRequest,
  res: VercelResponse,
  pathOnly: string
): Promise<boolean> {
  if (req.method !== "POST") return false;
  const m = pathOnly.match(/^\/rest\/v1\/rpc\/([a-z_][a-z0-9_]*)$/i);
  if (!m) return false;
  const name = m[1];
  if (!TS_RPC.has(name)) return false;
  try {
    if (name === "admin_ensure_system_settings") {
      const result = await ensureSystemSettingsSchemaVercel();
      res.status(200).json(result);
      return true;
    }
    const { runTsRpc } = await import("../aws/server/ts-rpc-handlers.js");
    const data = await runTsRpc(name);
    if (data === null) return false;
    res.status(200).json(data);
    return true;
  } catch (err) {
    res.status(400).json({
      message: err instanceof Error ? err.message : String(err),
    });
    return true;
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
    const msg = err instanceof Error ? err.message : String(err);
    if (
      (isRegistrationRpc(name) && isRegistrationRpcMismatchError(err)) ||
      (isClassLinkRpc(name) && isClassLinkRpcMissingError(err)) ||
      (isPublicCertificateVerifyRpc(name) && isPublicCertificateVerifyMissingError(err))
    ) {
      try {
        if (isRegistrationRpc(name)) await ensureAdminRegistrationRpc();
        if (isClassLinkRpc(name)) await ensureClassLinkRpc();
        if (isPublicCertificateVerifyRpc(name)) await ensureCertificateIssueRpc();
        const data = await callRpcLite(name, def.args, rpcBody(req), jwtClaims);
        res.status(200).json(data);
        return true;
      } catch (retryErr) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        res.status(400).json({
          message: retryMsg,
          code: (retryErr as { code?: string }).code,
        });
        return true;
      }
    }
    if (/does not exist/i.test(msg)) {
      return false;
    }
    res.status(400).json({
      message: msg,
      code: (err as { code?: string }).code,
    });
    return true;
  }
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
  const { sql: where, params } = buildWhere(req.query as Record<string, unknown>);
  const order = parseOrder(req.query.order);

  let sql = `SELECT ${cols} FROM public."${table}"`;
  if (where) sql += ` WHERE ${where}`;
  sql += order;
  sql += ` LIMIT ${limit} OFFSET ${offset}`;

  const runSelect = () => getVercelLitePool().query(sql, params);

  try {
    let result = await runSelect();
    if (req.method === "HEAD") {
      res.status(200).end();
      return true;
    }
    res.status(200).json(result.rows);
    return true;
  } catch (err) {
    if (table === "system_settings" && isMissingSystemSettingsError(err)) {
      try {
        await ensureSystemSettingsSchemaVercel();
        const retry = await runSelect();
        if (req.method === "HEAD") {
          res.status(200).end();
          return true;
        }
        res.status(200).json(retry.rows);
        return true;
      } catch (retryErr) {
        res.status(400).json({
          message: retryErr instanceof Error ? retryErr.message : String(retryErr),
        });
        return true;
      }
    }
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const rewritten = portalPathFromRequest(req);
  const pathOnly = rewritten.split("?")[0] || "/";
  const authHandled = await handleVercelAuthLite(req, res, pathOnly);
  if (authHandled) return;

  if (pathOnly.startsWith("/auth/")) {
    res.status(404).json({ message: `Auth route not available on rds-portal: ${pathOnly}` });
    return;
  }

  if (pathOnly.startsWith("/rest/")) {
    const tsEnsureHandled = await tryTsEnsureRpcLite(req, res, pathOnly);
    if (tsEnsureHandled) return;
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
