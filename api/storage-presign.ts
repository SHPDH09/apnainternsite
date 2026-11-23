/**
 * POST /api/storage-presign — presigned S3 PUT for browser uploads (bypasses Vercel 4.5MB body limit).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { resolveS3Region } from "../aws/server/s3-region.js";
import { appBucketToS3Bucket, scopeForAppBucket } from "../aws/server/vercel-storage-request.js";

const ALLOWED_BUCKETS = new Set([
  "learning-materials",
  "assignment-uploads",
  "consent-forms",
  "logos",
]);

function jwtSecret(): string {
  return (
    process.env.LOCAL_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "ezyintern-local-dev-secret-change-me"
  );
}

function bearer(req: VercelRequest): string | null {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function verifyUser(token: string): string | null {
  if (!token.includes(".")) return null;
  try {
    const payload = jwt.verify(token, jwtSecret(), { issuer: "ezyintern-local" }) as jwt.JwtPayload;
    const sub = String(payload?.sub || "").trim();
    return /^[0-9a-f-]{36}$/i.test(sub) ? sub : null;
  } catch {
    try {
      const payload = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
      const sub = String(payload?.sub || "").trim();
      return /^[0-9a-f-]{36}$/i.test(sub) ? sub : null;
    } catch {
      return null;
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const userId = verifyUser(bearer(req) || "");
  if (!userId) {
    res.status(401).json({ error: "Sign in required to upload files." });
    return;
  }

  const body = (req.body && typeof req.body === "object" ? req.body : {}) as {
    bucket?: string;
    objectKey?: string;
    contentType?: string;
  };

  const bucket = String(body.bucket || "").trim();
  const objectKey = String(body.objectKey || "").trim().replace(/^\/+/, "");
  const contentType = String(body.contentType || "application/octet-stream").trim();

  if (!ALLOWED_BUCKETS.has(bucket) || !objectKey || objectKey.includes("..")) {
    res.status(400).json({ error: "Invalid bucket or object key." });
    return;
  }

  const s3Bucket = appBucketToS3Bucket(bucket);
  if (!s3Bucket) {
    res.status(400).json({ error: "Storage bucket is not configured." });
    return;
  }

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) {
    res.status(503).json({ error: "File upload is not configured on the server (AWS credentials)." });
    return;
  }

  const region = resolveS3Region(scopeForAppBucket(bucket));
  const s3 = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey, sessionToken: process.env.AWS_SESSION_TOKEN?.trim() },
    // The browser sends the file after signing. There is no body to checksum here.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });

  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: objectKey,
    ContentType: contentType,
  });

  let uploadUrl: string;
  try {
    uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
  } catch (err) {
    console.error("[storage-presign] Could not sign upload", err);
    res.status(503).json({ error: "Could not prepare the storage upload. Please retry." });
    return;
  }

  res.status(200).json({
    uploadUrl,
    bucket,
    objectKey,
    publicUrl: `https://${s3Bucket}.s3.${region}.amazonaws.com/${objectKey
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
  });
}

export const config = {
  maxDuration: 30,
};
