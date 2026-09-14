import { createRdsAdapter, type ServerDbLike } from "./rdsAdapter.js";
import { useRds } from "./useRds.js";

export type ServerDb = ServerDbLike;

/** Server DB: RDS only (DATABASE_URL + LOCAL_SUPABASE in .env.awsrds.local). */
export function getServerDb(): ServerDb {
  if (useRds()) {
    return createRdsAdapter();
  }

  throw new Error(
    "Database not configured. Set DATABASE_URL in .env.awsrds.local and run npm run aws:api."
  );
}

export function isRdsMode(): boolean {
  return useRds();
}
