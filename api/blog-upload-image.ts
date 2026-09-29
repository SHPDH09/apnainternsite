/**
 * POST /api/blog-upload-image — admin blog cover/content images → S3 on Vercel.
 * Self-contained (no api/lib imports) — same pattern as staff-office-rpc.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const S3_REGION = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || "ap-south-1";
const LOGOS_BUCKET = process.env.S3_BUCKET_LOGOS || "ezyintern-staging-logos";
const VERCEL_MAX_BYTES = 3_300_000;

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

function bearer(req: VercelRequest): string | null {
  const h = req.headers.authorization || req.headers.Authorization;
  const raw = Array.isArray(h) ? h[0] : h;
  const m = raw ? String(raw).match(/^Bearer\s+(.+)$/i) : null;
  return m?.[1]?.trim() || null;
}

async function verifySession(token: string): Promise<{ sub: string; email?: string } | null> {
  try {
    const jwt = await import("jsonwebtoken");
    const secret =
      process.env.LOCAL_JWT_SECRET ||
      process.env.JWT_SECRET ||
      "ezyintern-local-dev-secret-change-me";
    const payload = jwt.default.verify(token, secret, {
      issuer: "ezyintern-local",
    }) as { sub?: string; email?: string };
    if (payload?.sub) {
      return {
        sub: String(payload.sub),
        email: payload.email ? String(payload.email) : undefined,
      };
    }
  } catch {
    /* Lambda auth fallback */
  }

  const lambdaAuth =
    process.env.LAMBDA_API_URL?.trim()?.replace(/\/$/, "") ||
    "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging";

  try {
    const res = await fetch(`${lambdaAuth}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = (await res.json().catch(() => null)) as {
      id?: string;
      sub?: string;
      email?: string;
    } | null;
    const sub = user?.id || user?.sub;
    return sub
      ? { sub: String(sub), email: user?.email ? String(user.email) : undefined }
      : null;
  } catch {
    return null;
  }
}

async function assertAdmin(databaseUrl: string, userId: string): Promise<void> {
  const pg = await import("pg");
  const pool = new pg.default.Pool(pgPoolConfig(databaseUrl));
  try {
    const { rows } = await pool.query<{ role: string }>(
      `SELECT role::text AS role FROM public.user_roles WHERE user_id = $1::uuid`,
      [userId]
    );
    const ok = rows.some((r) => r.role === "admin" || r.role === "super_admin");
    if (!ok) throw new Error("Admin privileges required.");
  } finally {
    await pool.end();
  }
}

function decodeImageBase64(raw: string): Buffer {
  const trimmed = raw.trim();
  const data = trimmed.includes(",") ? trimmed.split(",").pop() || "" : trimmed;
  const buf = Buffer.from(data, "base64");
  if (buf.length < 8) throw new Error("Invalid image data");
  return buf;
}

function publicLogoUrl(objectKey: string): string {
  const key = objectKey.replace(/^\/+/, "");
  return `https://${LOGOS_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/")}`;
}

async function uploadToS3(input: {
  postId: string;
  subfolder: "cover" | "content";
  fileName: string;
  contentType: string;
  imageBuffer: Buffer;
}): Promise<{ url: string; path: string }> {
  if (!process.env.AWS_ACCESS_KEY_ID?.trim() || !process.env.AWS_SECRET_ACCESS_KEY?.trim()) {
    throw new Error("Image upload is not configured on the server. Contact support.");
  }
  const ct = (input.contentType || "").toLowerCase();
  if (!ct.startsWith("image/")) {
    throw new Error("Please upload an image file (JPG, PNG, WebP, etc.).");
  }

  const safeName = String(input.fileName || "image")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 180);
  const path = `blog/${input.postId.trim()}/${input.subfolder}/${Date.now()}-${safeName}`;

  const { PutObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({ region: S3_REGION });
  await s3.send(
    new PutObjectCommand({
      Bucket: LOGOS_BUCKET,
      Key: path,
      Body: input.imageBuffer,
      ContentType: input.contentType || "application/octet-stream",
    })
  );

  return { url: publicLogoUrl(path), path };
}

function parseBody(req: VercelRequest): Record<string, unknown> {
  const b = req.body as unknown;
  if (b && typeof b === "object" && !Buffer.isBuffer(b)) {
    return b as Record<string, unknown>;
  }
  const s = typeof b === "string" ? b : Buffer.isBuffer(b) ? b.toString("utf8") : "";
  try {
    const parsed = JSON.parse(s) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return res.status(503).json({
      ok: false,
      message: "DATABASE_URL is not configured on this deployment",
    });
  }

  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ ok: false, message: "Authorization Bearer token required" });
  }
  const session = await verifySession(token);
  if (!session?.sub) {
    return res.status(401).json({ ok: false, message: "Invalid or expired session" });
  }

  const body = parseBody(req);
  const postId = String(body.post_id || "").trim();
  const subfolderRaw = String(body.subfolder || "content").trim().toLowerCase();
  const subfolder = subfolderRaw === "cover" ? "cover" : "content";
  const fileName = String(body.file_name || "image.jpg").trim();
  const contentType = String(body.content_type || "image/jpeg").trim();
  const imageBase64 = String(body.image_base64 || "").trim();

  if (!postId) return res.status(400).json({ ok: false, message: "post_id required" });
  if (!imageBase64) return res.status(400).json({ ok: false, message: "image_base64 required" });

  try {
    await assertAdmin(databaseUrl, session.sub);

    const imageBuffer = decodeImageBase64(imageBase64);
    if (imageBuffer.length > VERCEL_MAX_BYTES) {
      return res.status(413).json({
        ok: false,
        message:
          "Image is too large for upload through the site (max ~3 MB). Compress the image or use a smaller file.",
      });
    }

    const result = await uploadToS3({
      postId,
      subfolder,
      fileName,
      contentType,
      imageBuffer,
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[blog-upload-image]", message);
    const status = /admin privileges/i.test(message) ? 403 : 500;
    return res.status(status).json({ ok: false, message: message || "Blog image upload failed" });
  }
}
