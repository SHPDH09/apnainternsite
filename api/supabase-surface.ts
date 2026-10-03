import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const mod = await import("./.bundled/supabase-surface.mjs");
  const fn = mod.default as (req: VercelRequest, res: VercelResponse) => Promise<void>;
  await fn(req, res);
}

export const config = {
  maxDuration: 60,
};
