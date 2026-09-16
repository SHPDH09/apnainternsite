/**
 * POST /api/staff-register-face — thin alias for staff-office-rpc face registration.
 * Keeps mobile clients working if they call this path; logic lives in staff-office-rpc.ts.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import staffOfficeRpc from "./staff-office-rpc.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return staffOfficeRpc(req, res);
  }

  const raw =
    req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)
      ? (req.body as { faceDescriptor?: number[]; imageBase64?: string })
      : (() => {
          try {
            return JSON.parse(String(req.body || "{}")) as {
              faceDescriptor?: number[];
              imageBase64?: string;
            };
          } catch {
            return {};
          }
        })();

  req.body = {
    name: "staff_register_face",
    args: {
      p_face_descriptor: raw.faceDescriptor,
      p_image_base64: raw.imageBase64,
    },
  };

  return staffOfficeRpc(req, res);
}
