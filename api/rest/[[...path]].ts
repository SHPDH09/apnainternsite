import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runExpressOnVercel } from "../lib/expressVercelBridge.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return runExpressOnVercel(req, res, { stripPrefix: "/api/rest", mount: "/rest" });
}

export const config = {
  api: { bodyParser: false },
};
