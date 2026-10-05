/**
 * Lightweight POST/PATCH/DELETE for CMS + site_visits on Vercel rds-portal.
 * Avoids loading the heavy bundled rest-surface (504 timeouts on blog save).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolClient } from "pg";
import {
  ensureCmsTable,
  ensureSiteVisitsTable,
  isCmsTable,
  isMissingRelationError,
  isSiteVisitsTable,
} from "./cms-bootstrap.js";
import { buildWhere } from "./vercel-lite-rest-filters.js";
import { getVercelLitePool } from "./vercel-lite-pool.js";

const IDENT = /^[a-z_][a-z0-9_]*$/i;

export type VercelJwtClaims = {
  sub: string;
  email?: string;
  role?: string;
};

function restTableFromPath(pathOnly: string): string | null {
  const m = pathOnly.match(/^\/rest\/v1\/([a-z_][a-z0-9_]*)/i);
  if (!m) return null;
  const table = m[1];
  if (!IDENT.test(table)) return null;
  return table;
}

export function isVercelLiteRestMutateTable(table: string): boolean {
  return isCmsTable(table) || isSiteVisitsTable(table);
}

async function applyJwtClaims(client: PoolClient, jwtClaims: VercelJwtClaims | null): Promise<void> {
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

async function ensureBootstrapTable(table: string): Promise<void> {
  if (isCmsTable(table)) await ensureCmsTable(table);
  else if (isSiteVisitsTable(table)) await ensureSiteVisitsTable();
}

async function withBootstrapRetry<T>(table: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isMissingRelationError(err, table) && isVercelLiteRestMutateTable(table)) {
      await ensureBootstrapTable(table);
      return await run();
    }
    throw err;
  }
}

function requestBody(req: VercelRequest): unknown {
  if (req.body !== undefined && req.body !== null) return req.body;
  return {};
}

function preferReturn(req: VercelRequest): boolean {
  const p = String(req.headers.prefer || "");
  return /return=representation/i.test(p);
}

function bindWriteValue(
  val: unknown,
  paramIndex: number
): { placeholder: string; value: unknown } {
  if (val === null || val === undefined) {
    return { placeholder: `$${paramIndex}`, value: null };
  }
  if (typeof val === "boolean" || typeof val === "number" || typeof val === "string") {
    return { placeholder: `$${paramIndex}`, value: val };
  }
  if (val instanceof Date) {
    return { placeholder: `$${paramIndex}`, value: val.toISOString() };
  }
  return {
    placeholder: `$${paramIndex}::jsonb`,
    value: JSON.stringify(val),
  };
}

async function runQuery(
  jwtClaims: VercelJwtClaims | null,
  sql: string,
  params: unknown[]
): Promise<{ rows: Record<string, unknown>[] }> {
  const client = await getVercelLitePool().connect();
  try {
    await client.query("BEGIN");
    await applyJwtClaims(client, jwtClaims);
    const result = await client.query<Record<string, unknown>>(sql, params);
    await client.query("COMMIT");
    return { rows: result.rows };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function handlePost(
  req: VercelRequest,
  res: VercelResponse,
  table: string,
  jwtClaims: VercelJwtClaims | null
): Promise<void> {
  const body = requestBody(req);
  const rowsIn = Array.isArray(body) ? body : [body];
  if (!rowsIn.length || typeof rowsIn[0] !== "object" || rowsIn[0] === null) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }

  const cols = Object.keys(rowsIn[0] as object).filter((k) => IDENT.test(k));
  if (!cols.length) {
    res.status(400).json({ message: "No columns" });
    return;
  }

  const values: unknown[] = [];
  const valueSql: string[] = [];
  for (const row of rowsIn) {
    const placeholders: string[] = [];
    for (const c of cols) {
      const bound = bindWriteValue((row as Record<string, unknown>)[c], values.length + 1);
      values.push(bound.value);
      placeholders.push(bound.placeholder);
    }
    valueSql.push(`(${placeholders.join(",")})`);
  }

  let sql = `INSERT INTO public."${table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES ${valueSql.join(",")}`;
  if (preferReturn(req)) sql += ` RETURNING *`;

  const { rows } = await withBootstrapRetry(table, () => runQuery(jwtClaims, sql, values));
  if (preferReturn(req)) {
    const accept = String(req.headers.accept || "");
    if (/vnd\.pgrst\.object/.test(accept) || !Array.isArray(body)) {
      res.status(201).json(rows[0] ?? null);
      return;
    }
    res.status(201).json(rows);
    return;
  }
  res.status(201).json(null);
}

async function handlePatch(
  req: VercelRequest,
  res: VercelResponse,
  table: string,
  jwtClaims: VercelJwtClaims | null
): Promise<void> {
  const patch = requestBody(req);
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const cols = Object.keys(patch as object).filter((k) => IDENT.test(k));
  if (!cols.length) {
    res.status(400).json({ message: "No columns to update" });
    return;
  }

  const { sql: where, params } = buildWhere(req.query as Record<string, unknown>);
  if (!where) {
    res.status(400).json({ message: "PATCH requires filters" });
    return;
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  cols.forEach((c, i) => {
    const bound = bindWriteValue((patch as Record<string, unknown>)[c], i + 1);
    values.push(bound.value);
    sets.push(`"${c}" = ${bound.placeholder}`);
  });
  const whereShifted = where.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + values.length}`);
  let sql = `UPDATE public."${table}" SET ${sets.join(", ")} WHERE ${whereShifted}`;
  if (preferReturn(req)) sql += ` RETURNING *`;

  const { rows } = await withBootstrapRetry(table, () =>
    runQuery(jwtClaims, sql, [...values, ...params])
  );
  if (preferReturn(req)) {
    res.status(200).json(rows.length === 1 ? rows[0] : rows);
    return;
  }
  res.status(200).json(null);
}

async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  table: string,
  jwtClaims: VercelJwtClaims | null
): Promise<void> {
  const { sql: where, params } = buildWhere(req.query as Record<string, unknown>);
  if (!where) {
    res.status(400).json({ message: "DELETE requires filters" });
    return;
  }
  let sql = `DELETE FROM public."${table}" WHERE ${where}`;
  if (preferReturn(req)) sql += ` RETURNING *`;

  const { rows } = await withBootstrapRetry(table, () => runQuery(jwtClaims, sql, params));
  if (preferReturn(req)) {
    res.status(200).json(rows);
    return;
  }
  res.status(200).json(null);
}

export async function tryVercelLiteRestMutate(
  req: VercelRequest,
  res: VercelResponse,
  pathOnly: string,
  jwtClaims: VercelJwtClaims | null
): Promise<boolean> {
  const method = req.method || "GET";
  if (method !== "POST" && method !== "PATCH" && method !== "DELETE") return false;

  const table = restTableFromPath(pathOnly);
  if (!table || !isVercelLiteRestMutateTable(table)) return false;

  try {
    if (method === "POST") await handlePost(req, res, table, jwtClaims);
    else if (method === "PATCH") await handlePatch(req, res, table, jwtClaims);
    else await handleDelete(req, res, table, jwtClaims);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code;
    res.status(400).json({ message, code });
    return true;
  }
}
