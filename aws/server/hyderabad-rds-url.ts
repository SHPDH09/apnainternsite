/** Single Hyderabad Aurora writer (password auth). Override via DATABASE_URL in env. */
export const HYDERABAD_RDS_HOST = "ezyintern.cpy4aaca6mfv.ap-south-2.rds.amazonaws.com";

export function hyderabadDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim() || process.env.RDS_CANONICAL_DATABASE_URL?.trim();
  if (fromEnv && isHyderabadDatabaseUrl(fromEnv) && !isStaleRdsDatabaseUrl(fromEnv)) {
    return fromEnv;
  }
  const user = process.env.AWS_RDS_USER?.trim() || "postgres";
  const pass =
    process.env.AWS_RDS_PASSWORD?.trim() ||
    process.env.RDS_PASSWORD?.trim() ||
    process.env.PGPASSWORD?.trim() ||
    "";
  if (!pass) {
    throw new Error(
      "AWS_RDS_PASSWORD (or DATABASE_URL) is required to connect to Hyderabad RDS"
    );
  }
  const db = process.env.AWS_RDS_DATABASE?.trim() || "ezyintern";
  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(pass);
  return `postgresql://${encUser}:${encPass}@${HYDERABAD_RDS_HOST}:5432/${db}?sslmode=require`;
}

export function isHyderabadDatabaseUrl(url: string): boolean {
  return (
    /ezyintern\.cpy4aaca6mfv\.ap-south-2\.rds\.amazonaws\.com/i.test(url) ||
    /database-1(\.cluster|-ro|\.instance-1)?\.cpy4aaca6mfv\.ap-south-2\.rds\.amazonaws\.com/i.test(url)
  );
}

/** Legacy password-less URLs (postgresql://ezyintern@host) — not valid for serverless. */
export function isStaleRdsDatabaseUrl(url: string): boolean {
  return /\/\/ezyintern@/i.test(url);
}

export function isAwsRdsDatabaseUrl(url: string): boolean {
  return /rds\.amazonaws\.com/i.test(url);
}

export function isMumbaiStagingRdsDatabaseUrl(url: string): boolean {
  return /ezyintern-staging-db\.c5makww6eq8y\.ap-south-1\.rds\.amazonaws\.com/i.test(url);
}
