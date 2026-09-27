/** Shown on Razorpay checkout, UPI apps, and payment receipts. */
export const RAZORPAY_MERCHANT_DISPLAY_NAME = "Apna Intern";

/** Short token some UPI apps show when space is limited. */
export const RAZORPAY_MERCHANT_SHORT_NAME = "ApnaIntern";

export function razorpayOrderNotes(extra?: Record<string, string | undefined>): Record<string, string> {
  const base: Record<string, string> = {
    brand: RAZORPAY_MERCHANT_DISPLAY_NAME,
    merchant: RAZORPAY_MERCHANT_SHORT_NAME,
  };
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      const s = String(v ?? "").trim();
      if (s) base[k] = s;
    }
  }
  return base;
}

/** Order create payload — always auto-capture (never manual authorize-only). */
export function buildRazorpayOrderCreateBody(
  amountPaise: number,
  receipt: string,
  notes?: Record<string, string>
): Record<string, unknown> {
  return {
    amount: Math.round(amountPaise),
    currency: "INR",
    receipt,
    payment_capture: 1,
    notes: razorpayOrderNotes(notes),
  };
}
