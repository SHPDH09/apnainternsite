/**
 * POST /api/payment/ensure-captured — auto-capture authorized Razorpay payments (legacy checkout).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Razorpay from "razorpay";
import { ensurePaymentCaptured } from "../lib/paymentEnrollment.js";
import { getServerDb } from "../lib/getServerDb.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const paymentId = String(req.body?.payment_id || req.body?.razorpay_payment_id || "").trim();
  const amountPaise = Math.round(Number(req.body?.amount_paise ?? req.body?.amount ?? 0));
  if (!paymentId.startsWith("pay_")) {
    return res.status(400).json({ success: false, message: "Valid payment_id (pay_…) required" });
  }

  let db;
  try {
    db = getServerDb();
  } catch (cfgErr: unknown) {
    const msg = cfgErr instanceof Error ? cfgErr.message : String(cfgErr);
    return res.status(500).json({ success: false, message: msg });
  }

  try {
    const { data: config } = await db
      .from("payment_config")
      .select("razorpay_key_id, razorpay_key_secret")
      .eq("id", 1)
      .maybeSingle();

    if (!config?.razorpay_key_id || !config?.razorpay_key_secret) {
      return res.status(503).json({ success: false, message: "Razorpay not configured" });
    }

    const razorpay = new Razorpay({
      key_id: String(config.razorpay_key_id),
      key_secret: String(config.razorpay_key_secret),
    });

    await ensurePaymentCaptured(
      razorpay,
      paymentId,
      Number.isFinite(amountPaise) && amountPaise > 0 ? amountPaise : 100
    );

    const pay = (await razorpay.payments.fetch(paymentId)) as { status?: string };
    return res.status(200).json({
      success: true,
      status: pay.status || "captured",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ensure-captured]", paymentId, message);
    return res.status(502).json({ success: false, message });
  }
}
