/** PostgREST-style filters for Vercel lite GET /rest/v1/:table (aligned with local-rest.ts). */

const IDENT = /^[a-z_][a-z0-9_]*$/i;

const JSONB_ILIKE_COLUMNS = new Set(["metadata"]);

type Op =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "is"
  | "in";

function unquoteValue(raw: string): string {
  let v = raw.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).replace(/\\"/g, '"');
  }
  return v;
}

function parseInList(raw: string): string[] {
  const inner = raw.trim().replace(/^\(/, "").replace(/\)$/, "");
  if (!inner) return [];
  const items: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '"') {
      inQuote = !inQuote;
      cur += ch;
      continue;
    }
    if (ch === "," && !inQuote) {
      const t = cur.trim();
      if (t) items.push(unquoteValue(t));
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) items.push(unquoteValue(cur.trim()));
  return items;
}

function parseFilterValue(op: Op, raw: string): unknown {
  if (op === "is") {
    if (raw === "null") return null;
    if (raw === "true") return true;
    if (raw === "false") return false;
    return unquoteValue(raw);
  }
  if (op === "in") {
    return parseInList(raw.startsWith("(") ? raw : `(${raw})`);
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  return unquoteValue(raw);
}

function sqlColumn(key: string): string {
  return `"${key}"`;
}

function ilikeExpr(key: string, placeholder: string): string {
  if (JSONB_ILIKE_COLUMNS.has(key)) {
    return `${sqlColumn(key)}::text ILIKE ${placeholder}`;
  }
  return `${sqlColumn(key)} ILIKE ${placeholder}`;
}

export function parseSelect(raw: unknown): string {
  if (raw == null || raw === "" || raw === "*") return "*";
  const s = String(raw);
  const topLevel: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") {
      depth += 1;
      cur += ch;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      cur += ch;
      continue;
    }
    if (ch === "," && depth === 0) {
      topLevel.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) topLevel.push(cur.trim());

  const cols = topLevel
    .map((p) => p.replace(/\s+/g, ""))
    .filter((p) => p && !p.includes("(") && IDENT.test(p));

  if (!cols.length) return "*";
  return cols.map((c) => `"${c}"`).join(", ");
}

export function buildWhere(queryObj: Record<string, unknown>): {
  sql: string;
  params: unknown[];
} {
  const params: unknown[] = [];
  const parts: string[] = [];
  const reserved = new Set([
    "select",
    "order",
    "limit",
    "offset",
    "on_conflict",
    "columns",
    "or",
    "segment",
    "path",
  ]);

  for (const [key, val] of Object.entries(queryObj)) {
    if (reserved.has(key)) continue;
    if (!IDENT.test(key)) continue;
    const v = Array.isArray(val) ? val[0] : val;
    if (v == null) continue;
    const str = String(v);

    const notIn = str.match(/^not\.in\.\((.*)\)$/is);
    if (notIn) {
      const items = parseInList(`(${notIn[1]})`);
      if (!items.length) continue;
      params.push(items);
      parts.push(`NOT (${sqlColumn(key)}::text = ANY($${params.length}::text[]))`);
      continue;
    }

    const inOnly = str.match(/^in\.\((.*)\)$/is);
    if (inOnly) {
      const items = parseInList(`(${inOnly[1]})`);
      if (!items.length) {
        parts.push("FALSE");
        continue;
      }
      params.push(items);
      parts.push(`${sqlColumn(key)}::text = ANY($${params.length}::text[])`);
      continue;
    }

    const m = str.match(/^(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.(.+)$/i);
    if (!m) {
      params.push(unquoteValue(str));
      parts.push(`${sqlColumn(key)} = $${params.length}`);
      continue;
    }

    const negated = Boolean(m[1]);
    const op = m[2].toLowerCase() as Op;
    const raw = m[3];
    const parsed = parseFilterValue(op, raw);

    if (op === "is") {
      let clause = "";
      if (parsed === null) clause = `${sqlColumn(key)} IS NULL`;
      else if (parsed === true) clause = `${sqlColumn(key)} IS TRUE`;
      else if (parsed === false) clause = `${sqlColumn(key)} IS FALSE`;
      else {
        params.push(parsed);
        clause = `${sqlColumn(key)} = $${params.length}`;
      }
      parts.push(negated ? `NOT (${clause})` : clause);
      continue;
    }

    if (op === "in") {
      const arr = parsed as unknown[];
      params.push(arr);
      const clause = `${sqlColumn(key)}::text = ANY($${params.length}::text[])`;
      parts.push(negated ? `NOT (${clause})` : clause);
      continue;
    }

    const sqlOp: Record<string, string> = {
      eq: "=",
      neq: "<>",
      gt: ">",
      gte: ">=",
      lt: "<",
      lte: "<=",
      like: "LIKE",
      ilike: "ILIKE",
    };
    params.push(parsed);
    const ph = `$${params.length}`;
    let clause: string;
    if (op === "ilike") clause = ilikeExpr(key, ph);
    else clause = `${sqlColumn(key)} ${sqlOp[op]} ${ph}`;
    parts.push(negated ? `NOT (${clause})` : clause);
  }

  return { sql: parts.length ? parts.join(" AND ") : "", params };
}

export function parseOrder(raw: unknown): string {
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
