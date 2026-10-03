import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  authPathFromVercelRequest,
  handleVercelAuthLite,
} from "../aws/server/vercel-auth-lite.js";

/** Dedicated slim handler for /auth/* rewrites (password + refresh token, no 3MB bundle). */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const pathOnly = authPathFromVercelRequest(req);
  const handled = await handleVercelAuthLite(req, res, pathOnly);
  if (handled) return;
  res.status(404).json({ message: `Unknown auth route: ${pathOnly}` });
}

export const config = {
  maxDuration: 30,
  memory: 512,
};
