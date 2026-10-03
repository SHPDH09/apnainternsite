import { Signer } from "@aws-sdk/rds-signer";

export function rdsIamAuthEnabled(): boolean {
  const raw = process.env.DATABASE_URL?.trim() || "";
  if (/:\/\/[^/@]+:[^/@]+@/.test(raw)) return false;
  return /^(1|true|yes)$/i.test(String(process.env.RDS_IAM_AUTH || "").trim());
}

export async function refreshVercelRdsIamPassword(): Promise<void> {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw || !rdsIamAuthEnabled()) return;
  const u = new URL(raw.replace(/^postgresql:/, "http:"));
  const region =
    process.env.AWS_RDS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "ap-south-2";
  const signer = new Signer({
    hostname: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    username: decodeURIComponent(u.username || "postgres"),
    region,
  });
  process.env.PGPASSWORD = await signer.getAuthToken();
}
