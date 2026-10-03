import { Signer } from "@aws-sdk/rds-signer";

export function rdsIamAuthEnabled(): boolean {
  return /^(1|true|yes)$/i.test(String(process.env.RDS_IAM_AUTH || "").trim());
}

function parseDatabaseUrl(raw: string) {
  const u = new URL(raw.replace(/^postgresql:/, "http:"));
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: decodeURIComponent(u.username || "postgres"),
    database: u.pathname.replace(/^\//, "") || "postgres",
  };
}

export async function getRdsIamAuthToken(databaseUrl: string): Promise<string> {
  const { host, port, user } = parseDatabaseUrl(databaseUrl);
  const region =
    process.env.AWS_RDS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "ap-south-2";
  const signer = new Signer({
    hostname: host,
    port,
    username: user,
    region,
  });
  return signer.getAuthToken();
}
