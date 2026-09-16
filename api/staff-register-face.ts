/**
 * POST /api/staff-register-face — upload face photo to S3 + save descriptor on RDS (Vercel).
 * Avoids Lambda /storage which returns 503 on some mobile clients.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { verifyBearerSession } from "./lib/verifyBearerSession.js";

const REGION = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || "ap-south-1";
const LOGOS_BUCKET = process.env.S3_BUCKET_LOGOS || "ezyintern-staging-logos";

function pgPoolConfig(databaseUrl: string) {
  return {
    connectionString: databaseUrl
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/[?&]$/, ""),
    ssl: /rds\.amazonaws\.com/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: 1,
    connectionTimeoutMillis: 15000,
  };
}

function publicLogoUrl(objectKey: string): string {
  const key = objectKey.replace(/^\/+/, "");
  return `https://${LOGOS_BUCKET}.s3.${REGION}.amazonaws.com/${key
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/")}`;
}

function parseBody(req: VercelRequest): {
  faceDescriptor?: number[];
  imageBase64?: string;
} {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body as { faceDescriptor?: number[]; imageBase64?: string };
  }
  try {
    return JSON.parse(String(req.body || "{}")) as {
      faceDescriptor?: number[];
      imageBase64?: string;
    };
  } catch {
    return {};
  }
}

function decodeImageBase64(raw: string): Buffer {
  const trimmed = raw.trim();
  const data = trimmed.includes(",") ? trimmed.split(",").pop() || "" : trimmed;
  const buf = Buffer.from(data, "base64");
  if (buf.length < 64) {
    throw new Error("Invalid photo data");
  }
  return buf;
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

  const authHeader = req.headers.authorization || req.headers.Authorization;
  const rawAuth = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const token = rawAuth ? String(rawAuth).match(/^Bearer\s+(.+)$/i)?.[1]?.trim() : null;
  if (!token) {
    return res.status(401).json({ ok: false, message: "Authorization Bearer token required" });
  }

  const session = await verifyBearerSession(token);
  if (!session) {
    return res.status(401).json({ ok: false, message: "Invalid or expired session" });
  }

  const body = parseBody(req);
  const faceDescriptor = body.faceDescriptor;
  const imageBase64 = body.imageBase64;

  if (!Array.isArray(faceDescriptor) || faceDescriptor.length < 64) {
    return res.status(400).json({ ok: false, message: "Invalid face data. Look at the camera and try again." });
  }
  if (!imageBase64?.trim()) {
    return res.status(400).json({ ok: false, message: "Profile photo is required for face registration" });
  }

  try {
    const imageBuffer = decodeImageBase64(imageBase64);
    const objectKey = `staff-profiles/${session.sub}-face-${Date.now()}.jpg`;

    const s3 = new S3Client({ region: REGION });
    await s3.send(
      new PutObjectCommand({
        Bucket: LOGOS_BUCKET,
        Key: objectKey,
        Body: imageBuffer,
        ContentType: "image/jpeg",
      })
    );

    const photoUrl = publicLogoUrl(objectKey);

    const pg = await import("pg");
    const { applyStaffFaceRegisterBootstrap } = await import("./staffOfficeApply.js");
    const pool = new pg.default.Pool(pgPoolConfig(databaseUrl));
    const client = await pool.connect();

    try {
      await applyStaffFaceRegisterBootstrap(pool);
      await client.query("BEGIN");
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [session.sub]);
      await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
      if (session.email) {
        await client.query(`SELECT set_config('request.jwt.claim.email', $1, true)`, [session.email]);
      }

      const { rows } = await client.query<{ result: Record<string, unknown> }>(
        `SELECT public.staff_register_face($1::jsonb, $2::text) AS result`,
        [JSON.stringify(faceDescriptor), photoUrl]
      );
      await client.query("COMMIT");

      const result = rows[0]?.result ?? { ok: true, profile_image_url: photoUrl };
      return res.status(200).json(result);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
      await pool.end();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[staff-register-face]", message);
    return res.status(400).json({ ok: false, message });
  }
}
