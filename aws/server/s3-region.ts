/** Resolve AWS S3 client region (distinct from SES/Lambda legacy ap-south-1 defaults). */

export function isHyderabadProductionStack(): boolean {
  const db = String(process.env.DATABASE_URL || "").trim();
  if (/ap-south-2|rds\.amazonaws\.com.*ap-south-2|cpy4aaca6mfv/i.test(db)) return true;
  const canonical = String(process.env.RDS_CANONICAL_DATABASE_URL || "").trim();
  if (/ap-south-2|cpy4aaca6mfv/i.test(canonical)) return true;
  return false;
}

export function resolveS3Region(scope?: "logos" | "consent" | "learning"): string {
  const scoped =
    (scope === "logos" && process.env.S3_BUCKET_LOGOS_REGION?.trim()) ||
    (scope === "consent" && process.env.S3_BUCKET_CONSENT_FORMS_REGION?.trim()) ||
    (scope === "learning" && process.env.S3_BUCKET_LEARNING_MATERIALS_REGION?.trim()) ||
    "";
  if (scoped) return scoped;

  const s3Only =
    process.env.AWS_S3_REGION?.trim() ||
    process.env.S3_REGION?.trim() ||
    process.env.S3_DEFAULT_REGION?.trim() ||
    "";
  if (s3Only) return s3Only;

  // Hyderabad RDS production: S3 buckets are in ap-south-2 while SES/Lambda env may still say ap-south-1.
  if (isHyderabadProductionStack()) return "ap-south-2";

  return (
    process.env.AWS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim() ||
    "ap-south-1"
  );
}

export function isS3RegionMismatchError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name?: string }).name)
      : "";
  return (
    /location constraint is incompatible/i.test(msg) ||
    /must be addressed using the specified endpoint/i.test(msg) ||
    /AuthorizationHeaderMalformed.*region/i.test(msg) ||
    name === "IllegalLocationConstraintException" ||
    name === "PermanentRedirect"
  );
}

export async function withS3RegionRetry<T>(
  op: (region: string) => Promise<T>,
  preferredRegion?: string
): Promise<T> {
  const regions = [
    ...new Set(
      [preferredRegion || resolveS3Region(), "ap-south-2", "ap-south-1"].filter(Boolean)
    ),
  ];
  let last: unknown;
  for (const region of regions) {
    try {
      return await op(region);
    } catch (err) {
      last = err;
      if (!isS3RegionMismatchError(err)) throw err;
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}
