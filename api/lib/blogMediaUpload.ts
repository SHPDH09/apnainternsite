const S3_REGION = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || "ap-south-1";
const LOGOS_BUCKET = process.env.S3_BUCKET_LOGOS || "ezyintern-staging-logos";
/** Raw file size when sending base64 through Vercel (~4.5 MB request cap). */
export const BLOG_IMAGE_VERCEL_MAX_BYTES = 3_300_000;
export const BLOG_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export function decodeImageBase64(raw: string): Buffer {
  const trimmed = raw.trim();
  const data = trimmed.includes(",") ? trimmed.split(",").pop() || "" : trimmed;
  const buf = Buffer.from(data, "base64");
  if (buf.length < 8) {
    throw new Error("Invalid image data");
  }
  return buf;
}

function publicLogoObjectUrl(objectKey: string): string {
  const key = objectKey.replace(/^\/+/, "");
  return `https://${LOGOS_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/")}`;
}

export type BlogMediaSubfolder = "cover" | "content";

export async function uploadBlogImageToS3(input: {
  postId: string;
  subfolder: BlogMediaSubfolder;
  fileName: string;
  contentType: string;
  imageBuffer: Buffer;
}): Promise<{ url: string; path: string }> {
  if (!process.env.AWS_ACCESS_KEY_ID?.trim() || !process.env.AWS_SECRET_ACCESS_KEY?.trim()) {
    throw new Error("Image upload is not configured on the server. Contact support.");
  }
  if (!input.postId.trim()) {
    throw new Error("post_id required");
  }
  if (input.imageBuffer.length > BLOG_IMAGE_MAX_BYTES) {
    throw new Error("Image must be 8 MB or smaller.");
  }
  const ct = (input.contentType || "application/octet-stream").toLowerCase();
  if (!ct.startsWith("image/")) {
    throw new Error("Please upload an image file (JPG, PNG, WebP, etc.).");
  }

  const safeName = String(input.fileName || "image")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 180);
  const stamp = Date.now();
  const pid = input.postId.trim();
  const primary = `blog/${pid}/${input.subfolder}/${stamp}-${safeName}`;
  const fallback = `staff-profiles/blog/${pid}/${input.subfolder}/${stamp}-${safeName}`;
  const contentType = input.contentType || "application/octet-stream";

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Image upload is not configured on the server. Contact support.");
  }

  const { PutObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: S3_REGION,
    credentials: { accessKeyId, secretAccessKey },
  });

  const put = async (key: string) => {
    await s3.send(
      new PutObjectCommand({
        Bucket: LOGOS_BUCKET,
        Key: key,
        Body: input.imageBuffer,
        ContentType: contentType,
      })
    );
    return key;
  };

  try {
    const path = await put(primary);
    return { url: publicLogoObjectUrl(path), path };
  } catch (primaryErr) {
    const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    if (!/access denied|accessdenied|403/i.test(msg)) throw primaryErr;
    const path = await put(fallback);
    return { url: publicLogoObjectUrl(path), path };
  }
}
