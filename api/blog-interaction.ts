/**
 * POST /api/blog-interaction — public blog views + reader lead capture (RDS).
 * Whitelisted on Vercel (not proxied to Lambda). Self-contained — no aws/server imports.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { QueryResultRow } from "pg";
import { BLOG_ENGAGEMENT_BOOTSTRAP_SQL } from "./lib/blogEngagementBootstrap.js";

let pool: import("pg").Pool | null = null;
let engagementReady: Promise<void> | null = null;

function pgPoolConfig(databaseUrl: string) {
  return {
    connectionString: databaseUrl
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/[?&]$/, ""),
    ssl: /rds\.amazonaws\.com/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: 1,
    connectionTimeoutMillis: 20000,
  };
}

async function getPool(): Promise<import("pg").Pool> {
  if (pool) return pool;
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not configured");
  }
  const pg = await import("pg");
  pool = new pg.default.Pool(pgPoolConfig(databaseUrl));
  return pool;
}

async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
  const p = await getPool();
  return p.query<T>(text, params);
}

function normalizePhone(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.slice(-10);
}

async function ensureEngagementSchema(): Promise<void> {
  if (!engagementReady) {
    engagementReady = (async () => {
      await query(BLOG_ENGAGEMENT_BOOTSTRAP_SQL);
    })();
  }
  await engagementReady;
}

async function incrementView(postId: string): Promise<number> {
  const { rows } = await query<{ view_count: string }>(
    `UPDATE public.site_blog_posts
     SET view_count = view_count + 1
     WHERE id = $1::uuid AND is_active = true
     RETURNING view_count`,
    [postId]
  );
  return Number(rows[0]?.view_count ?? 0);
}

async function fetchViewCount(postId: string): Promise<number> {
  const { rows } = await query<{ view_count: string }>(
    `SELECT view_count FROM public.site_blog_posts WHERE id = $1::uuid LIMIT 1`,
    [postId]
  );
  return Number(rows[0]?.view_count ?? 0);
}

async function submitLead(body: Record<string, unknown>): Promise<string> {
  const postId = String(body.post_id || "").trim();
  const fullName = String(body.full_name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = normalizePhone(body.phone);
  const collegeName = String(body.college_name || "").trim() || null;

  if (!postId) throw new Error("post_id is required");
  if (!fullName) throw new Error("Name is required");
  if (!email || !email.includes("@")) throw new Error("Valid email is required");
  if (!phone) throw new Error("Valid phone is required");

  const meta = await query<{ slug: string; title: string }>(
    `SELECT slug, title FROM public.site_blog_posts WHERE id = $1::uuid LIMIT 1`,
    [postId]
  );
  const slug = meta.rows[0]?.slug ?? null;
  const title = meta.rows[0]?.title ?? null;

  const { rows } = await query<{ id: string }>(
    `INSERT INTO public.site_blog_leads (
       post_id, post_slug, post_title, full_name, email, phone, college_name
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [postId, slug, title, fullName, email, phone, collegeName]
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Lead save failed");
  return id;
}

async function lookupAutofill(phoneRaw: unknown): Promise<{
  full_name: string;
  email: string;
  college_name: string;
}> {
  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return { full_name: "", email: "", college_name: "" };
  }

  const student = await query<{ full_name: string; email: string; college_name: string }>(
    `SELECT full_name, email, college_name
     FROM public.students
     WHERE right(regexp_replace(coalesce(contact_number, ''), '\\D', '', 'g'), 10) = $1
     ORDER BY created_at DESC NULLS LAST
     LIMIT 1`,
    [phone]
  );
  const s = student.rows[0];
  if (s && (s.full_name || s.email)) {
    return {
      full_name: s.full_name || "",
      email: s.email || "",
      college_name: s.college_name || "",
    };
  }

  const lead = await query<{ email: string; payload: Record<string, unknown> }>(
    `SELECT email, payload
     FROM public.registration_leads
     WHERE right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = $1
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 1`,
    [phone]
  );
  const row = lead.rows[0];
  if (row) {
    const p = row.payload && typeof row.payload === "object" ? row.payload : {};
    const name = String(p.full_name || p.name || p.student_name || "").trim();
    const email = String(row.email || p.email || "").trim();
    const college = String(p.college_name || p.college || "").trim();
    return { full_name: name, email, college_name: college };
  }

  return { full_name: "", email: "", college_name: "" };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const action = String(body.action || "").trim();

  try {
    await ensureEngagementSchema();

    if (action === "increment_view") {
      const postId = String(body.post_id || "").trim();
      if (!postId) return res.status(400).json({ ok: false, message: "post_id required" });
      const view_count = await incrementView(postId);
      return res.status(200).json({ ok: true, view_count });
    }

    if (action === "get_view") {
      const postId = String(body.post_id || "").trim();
      if (!postId) return res.status(400).json({ ok: false, message: "post_id required" });
      const view_count = await fetchViewCount(postId);
      return res.status(200).json({ ok: true, view_count });
    }

    if (action === "submit_lead") {
      const id = await submitLead(body);
      return res.status(201).json({ ok: true, id });
    }

    if (action === "lookup_phone") {
      const profile = await lookupAutofill(body.phone);
      return res.status(200).json({ ok: true, profile });
    }

    return res.status(400).json({ ok: false, message: "Unknown action" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[blog-interaction]", action, message);
    return res.status(503).json({ ok: false, message: message || "Blog interaction unavailable" });
  }
}
