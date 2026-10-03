import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";

const TABLE = /^[a-z_][a-z0-9_]*$/i;
const IDENT = /^[a-z_][a-z0-9_]*$/i;

let pool: Pool | null = null;

function connectionString(): string {
  const raw = String(process.env.DATABASE_URL || "").trim();
  if (!raw) throw new Error("DATABASE_URL missing");
  return raw
    .replace(/([?&])sslmode=[^&]*/gi, "$1")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?");
}

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString(),
      max: 2,
      connectionTimeoutMillis: 12_000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
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

/** Minimal PostgREST-style filters: col=eq.val, col=neq.val */
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
    let rhs = m[2];
    if (rhs === "true") rhs = "true";
    else if (rhs === "false") rhs = "false";
    else if (rhs === "null") {
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

export async function tryVercelRestLite(req: VercelRequest, res: VercelResponse, pathOnly: string): Promise<boolean> {
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
    const { rows } = await getPool().query(sql, params);
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
