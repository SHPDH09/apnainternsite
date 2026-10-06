/**
 * Supabase Storage-compatible API → AWS S3 (local RDS mode).
 */
import type { Request, Response, NextFunction } from "express";
import Busboy from "busboy";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { resolveS3Region, withS3RegionRetry } from "./s3-region.js";

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

function scopeForAppBucket(appBucket: string): "logos" | "consent" | "learning" | undefined {
  if (appBucket === "logos") return "logos";
  if (appBucket === "consent-forms") return "consent";
  if (appBucket === "learning-materials" || appBucket === "assignment-uploads") return "learning";
  return undefined;
}

function resolveS3Bucket(appBucket: string): string | null {
  return BUCKET_MAP[appBucket] || null;
}

export function publicObjectUrl(appBucket: string, objectKey: string): string {
  const s3Bucket = resolveS3Bucket(appBucket);
  if (!s3Bucket) return "";
  const key = objectKey.replace(/^\/+/, "");
  return `https://${s3Bucket}.s3.${REGION}.amazonaws.com/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function storageSubPath(req: Request): string {
  const full = req.originalUrl.split("?")[0];
  const idx = full.indexOf("/storage/v1/");
  return idx >= 0 ? full.slice(idx + "/storage/v1/".length) : "";
}

async function readUploadBody(req: Request): Promise<{ buffer: Buffer; contentType: string }> {
  const ct = String(req.headers["content-type"] || "application/octet-stream");

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

  if (Buffer.isBuffer(req.body)) {
    return { buffer: req.body, contentType: ct };
  }

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve());
    req.on("error", reject);
  });
  return { buffer: Buffer.concat(chunks), contentType: ct };
}

export function storageRawBody(req: Request, res: Response, next: NextFunction) {
  if (!req.originalUrl.startsWith("/storage/v1/object/")) return next();
  if (req.method !== "POST" && req.method !== "PUT") return next();
  if (String(req.headers["content-type"] || "").includes("multipart/form-data")) return next();

  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(Buffer.from(c)));
  req.on("end", () => {
    (req as Request & { body: Buffer }).body = Buffer.concat(chunks);
    next();
  });
  req.on("error", next);
}

function decodeObjectKey(segments: string[]): string {
  return decodeURIComponent(segments.join("/")).replace(/^\/+/, "");
}

function isReservedObjectSegment(segment: string): boolean {
  return segment === "public" || segment === "sign" || segment === "upload";
}

async function streamS3Object(
  req: Request,
  res: Response,
  appBucket: string,
  s3Bucket: string,
  objectKey: string
): Promise<void> {
  try {
    const result = await withS3RegionRetry(
      (region) =>
        getS3(region).send(new GetObjectCommand({ Bucket: s3Bucket, Key: objectKey })),
      resolveS3Region(scopeForAppBucket(appBucket))
    );
    const contentType = result.ContentType || "application/octet-stream";
    if (result.ContentLength != null) {
      res.setHeader("Content-Length", String(result.ContentLength));
    }
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=300");

    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }

    const body = result.Body;
    if (!body) {
      res.status(404).json({ error: "not_found", message: "Object not found" });
      return;
    }

    const bytes = await body.transformToByteArray();
    res.status(200).send(Buffer.from(bytes));
  } catch (err: unknown) {
    const code =
      err && typeof err === "object"
        ? String((err as { name?: string; Code?: string }).name || (err as { Code?: string }).Code || "")
        : "";
    const status =
      err && typeof err === "object"
        ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        : undefined;
    if (code === "NoSuchKey" || code === "NotFound" || status === 404) {
      res.status(404).json({ error: "not_found", message: "Object not found" });
      return;
    }
    throw err;
  }
}

export async function handleStorageRequest(req: Request, res: Response) {
  const sub = storageSubPath(req);
  const parts = sub.split("/").filter(Boolean);

  try {
    // GET/HEAD public object → stream from S3 (works for private buckets via Lambda creds)
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
        res.status(404).json({ error: "Bucket not found" });
        return;
      }
      await streamS3Object(req, res, appBucket, s3Bucket, objectKey);
      return;
    }

    // GET/HEAD authenticated object download: object/{bucket}/{key...}
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
        res.status(404).json({ error: "Bucket not found" });
        return;
      }
      await streamS3Object(req, res, appBucket, s3Bucket, objectKey);
      return;
    }

    // LIST buckets
    if (req.method === "GET" && parts[0] === "bucket") {
      res.json(
        Object.keys(BUCKET_MAP).map((name) => ({ id: name, name, public: true }))
      );
      return;
    }

    // DELETE objects
    if (req.method === "DELETE" && parts[0] === "object" && parts.length >= 2) {
      const appBucket = parts[1];
      const s3Bucket = resolveS3Bucket(appBucket);
      if (!s3Bucket) {
        res.status(404).json({ error: "Bucket not found" });
        return;
      }
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const prefixes: string[] = Array.isArray(body.prefixes)
        ? body.prefixes.map(String)
        : [];
      if (!prefixes.length) {
        res.status(400).json({ error: "prefixes required" });
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
      res.status(200).json([]);
      return;
    }

    // POST/PUT upload: object/{bucket}/{key...}
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
        res.status(404).json({ error: "Bucket not found", message: appBucket });
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
      res.status(200).json({ Key: `${appBucket}/${objectKey}`, Id: objectKey });
      return;
    }

    res.status(404).json({ error: "not_found", message: `Storage route not implemented: ${sub}` });
  } catch (err) {
    console.error("[s3/storage]", err);
    res.status(500).json({
      statusCode: "500",
      error: "storage_error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
