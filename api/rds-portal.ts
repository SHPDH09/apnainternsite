import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";

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
    params.push(rhs);
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

  let sql = `SELECT ${cols} FROM public."${table}"`;
  if (where) sql += ` WHERE ${where}`;
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const rewritten = portalPathFromRequest(req);
  const pathOnly = rewritten.split("?")[0] || "/";
  if (pathOnly === "/auth/v1/settings") {
    authSettingsFast(req, res);
    return;
  }

  if (pathOnly.startsWith("/rest/")) {
    const handled = await tryRestLite(req, res, pathOnly);
    if (handled) return;
  }

  req.url = rewritten;
  const fn = await loadStorageHandler();
  await fn(req, res);
}

export const config = {
  maxDuration: 60,
  memory: 1024,
};
