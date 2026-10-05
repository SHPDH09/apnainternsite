/**
 * Lightweight Supabase-compatible storage for Vercel (no Express / RDS bootstraps).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import Busboy from "busboy";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { isS3RegionMismatchError, resolveS3Region, withS3RegionRetry } from "./s3-region.js";

const REGION = resolveS3Region();

const BUCKET_MAP: Record<string, string> = {
  "consent-forms": process.env.S3_BUCKET_CONSENT_FORMS || "ezyintern-staging-consent-forms",
  logos: process.env.S3_BUCKET_LOGOS || "ezyintern-staging-logos",
  "learning-materials":
    process.env.S3_BUCKET_LEARNING_MATERIALS || "ezyintern-staging-learning-materials",
  "assignment-uploads":
    process.env.S3_BUCKET_ASSIGNMENT_UPLOADS || "ezyintern-staging-learning-materials",
};

function getS3(region = REGION): S3Client {
  return new S3Client({ region });
}

function resolveS3Bucket(appBucket: string): string | null {
  return BUCKET_MAP[appBucket] || null;
}

function scopeForAppBucket(appBucket: string): "logos" | "consent" | "learning" | undefined {
  if (appBucket === "logos") return "logos";
  if (appBucket === "consent-forms") return "consent";
  if (appBucket === "learning-materials" || appBucket === "assignment-uploads") return "learning";
  return undefined;
}

function storageSubPath(url: string): string {
  const full = url.split("?")[0];
  const idx = full.indexOf("/storage/v1/");
  return idx >= 0 ? full.slice(idx + "/storage/v1/".length) : "";
}

function decodeObjectKey(segments: string[]): string {
  return decodeURIComponent(segments.join("/")).replace(/^\/+/, "");
}

function isReservedObjectSegment(segment: string): boolean {
  return segment === "public" || segment === "sign" || segment === "upload";
}

function setStorageCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = String(req.headers.origin || "").trim();
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Headers",
    String(req.headers["access-control-request-headers"] || "") ||
      "Authorization, Content-Type, apikey, x-upsert, x-client-info, cache-control"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,DELETE,OPTIONS");
}

async function readUploadBody(req: IncomingMessage): Promise<{ buffer: Buffer; contentType: string }> {
  const ct = String(req.headers["content-type"] || "application/octet-stream");
  const raw = (req as IncomingMessage & { body?: unknown }).body;

  if (Buffer.isBuffer(raw)) {
    return { buffer: raw, contentType: ct };
  }
  if (typeof raw === "string" && raw.length > 0) {
    return { buffer: Buffer.from(raw, "binary"), contentType: ct };
  }

  if (ct.includes("multipart/form-data")) {
    return new Promise((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers });
      let fileBuffer: Buffer | null = null;
      let fileType = "application/octet-stream";
      busboy.on("file", (_name, stream, info) => {
        fileType = info.mimeType || fileType;
        const chunks: Buffer[] = [];
        stream.on("data", (c: Buffer) => chunks.push(c));
        stream.on("end", () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });
      busboy.on("finish", () => {
        if (!fileBuffer) reject(new Error("No file in upload"));
        else resolve({ buffer: fileBuffer, contentType: fileType });
      });
      busboy.on("error", reject);
      req.pipe(busboy);
    });
  }

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve());
    req.on("error", reject);
  });
  return { buffer: Buffer.concat(chunks), contentType: ct };
}

function alternateObjectKeys(objectKey: string): string[] {
  const keys = [objectKey.replace(/^\/+/, "")];
  const base = keys[0];
  if (base.includes("/")) {
    const tail = base.split("/").pop();
    if (tail && !keys.includes(tail)) keys.push(tail);
  }
  if (/^popups\//i.test(base)) {
    const withoutPopupId = base.replace(/^popups\/[^/]+\//, "");
    if (withoutPopupId && !keys.includes(withoutPopupId)) keys.push(withoutPopupId);
    const popupsOnly = base.replace(/^popups\//, "");
    if (popupsOnly && !keys.includes(popupsOnly)) keys.push(popupsOnly);
  }
  return keys;
}

async function streamS3Object(
  req: IncomingMessage,
  res: ServerResponse,
  appBucket: string,
  s3Bucket: string,
  objectKey: string
): Promise<void> {
  let lastErr: unknown;
  for (const key of alternateObjectKeys(objectKey)) {
    try {
      await streamS3ObjectOnce(req, res, appBucket, s3Bucket, key);
      return;
    } catch (err) {
      lastErr = err;
      const name = String((err as { name?: string })?.name || "");
      const code = String((err as { Code?: string; code?: string })?.Code || (err as { code?: string })?.code || "");
      if (name !== "NoSuchKey" && code !== "NoSuchKey" && code !== "NotFound") {
        throw err;
      }
    }
  }
  throw lastErr ?? new Error("Object not found");
}

async function streamS3ObjectOnce(
  req: IncomingMessage,
  res: ServerResponse,
  appBucket: string,
  s3Bucket: string,
  objectKey: string
): Promise<void> {
  const result = await withS3RegionRetry(
    (region) => getS3(region).send(new GetObjectCommand({ Bucket: s3Bucket, Key: objectKey })),
    resolveS3Region(scopeForAppBucket(appBucket))
  );
  const contentType = result.ContentType || "application/octet-stream";
  if (result.ContentLength != null) {
    res.setHeader("Content-Length", String(result.ContentLength));
  }
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=300");

  if (req.method === "HEAD") {
    res.statusCode = 200;
    res.end();
    return;
  }

  const body = result.Body;
  if (!body) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not_found", message: "Object not found" }));
    return;
  }

  const bytes = await body.transformToByteArray();
  res.statusCode = 200;
  res.end(Buffer.from(bytes));
}

export async function handleVercelStorageRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  setStorageCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const sub = storageSubPath(req.url || "/");
  const parts = sub.split("/").filter(Boolean);

  try {
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      parts[0] === "object" &&
      parts[1] === "public" &&
      parts.length >= 4
    ) {
      const appBucket = parts[2];
      const objectKey = decodeObjectKey(parts.slice(3));
      const s3Bucket = resolveS3Bucket(appBucket);
      if (!s3Bucket) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Bucket not found" }));
        return;
      }
      await streamS3Object(req, res, appBucket, s3Bucket, objectKey);
      return;
    }

    if (
      (req.method === "GET" || req.method === "HEAD") &&
      parts[0] === "object" &&
      parts.length >= 3 &&
      !isReservedObjectSegment(parts[1])
    ) {
      const appBucket = parts[1];
      const objectKey = decodeObjectKey(parts.slice(2));
      const s3Bucket = resolveS3Bucket(appBucket);
      if (!s3Bucket) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Bucket not found" }));
        return;
      }
      await streamS3Object(req, res, appBucket, s3Bucket, objectKey);
      return;
    }

    if (req.method === "GET" && parts[0] === "bucket") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(Object.keys(BUCKET_MAP).map((name) => ({ id: name, name, public: true }))));
      return;
    }

    if (req.method === "DELETE" && parts[0] === "object" && parts.length >= 2) {
      const appBucket = parts[1];
      const s3Bucket = resolveS3Bucket(appBucket);
      if (!s3Bucket) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Bucket not found" }));
        return;
      }
      let body: { prefixes?: string[] } = {};
      const raw = (req as IncomingMessage & { body?: unknown }).body;
      if (raw && typeof raw === "object") body = raw as { prefixes?: string[] };
      const prefixes: string[] = Array.isArray(body.prefixes) ? body.prefixes.map(String) : [];
      if (!prefixes.length) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "prefixes required" }));
        return;
      }
      const scope = scopeForAppBucket(appBucket);
      if (prefixes.length === 1) {
        await withS3RegionRetry(
          (region) =>
            getS3(region).send(
              new DeleteObjectCommand({ Bucket: s3Bucket, Key: prefixes[0].replace(/^\/+/, "") })
            ),
          resolveS3Region(scope)
        );
      } else {
        await withS3RegionRetry(
          (region) =>
            getS3(region).send(
              new DeleteObjectsCommand({
                Bucket: s3Bucket,
                Delete: { Objects: prefixes.map((p) => ({ Key: p.replace(/^\/+/, "") })) },
              })
            ),
          resolveS3Region(scope)
        );
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify([]));
      return;
    }

    if (
      (req.method === "POST" || req.method === "PUT") &&
      parts[0] === "object" &&
      parts.length >= 3 &&
      !isReservedObjectSegment(parts[1])
    ) {
      const appBucket = parts[1];
      const objectKey = decodeObjectKey(parts.slice(2));
      const s3Bucket = resolveS3Bucket(appBucket);
      if (!s3Bucket) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Bucket not found", message: appBucket }));
        return;
      }
      const { buffer, contentType } = await readUploadBody(req);
      await withS3RegionRetry(
        (region) =>
          getS3(region).send(
            new PutObjectCommand({
              Bucket: s3Bucket,
              Key: objectKey,
              Body: buffer,
              ContentType: contentType,
            })
          ),
        resolveS3Region(scopeForAppBucket(appBucket))
      );
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ Key: `${appBucket}/${objectKey}`, Id: objectKey }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not_found", message: `Storage route not implemented: ${sub}` }));
  } catch (err) {
    console.error("[vercel-storage]", err);
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        statusCode: "500",
        error: "storage_error",
        message: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

export function appBucketToS3Bucket(appBucket: string): string | null {
  return resolveS3Bucket(appBucket);
}

export { BUCKET_MAP, REGION };
