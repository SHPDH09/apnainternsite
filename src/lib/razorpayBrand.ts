export const RAZORPAY_MERCHANT_DISPLAY_NAME = "Apna Intern";
export const RAZORPAY_MERCHANT_SHORT_NAME = "ApnaIntern";

export function razorpayCheckoutBaseOptions(description?: string): {
  name: string;
  description: string;
  theme: { color: string };
} {
  return {
    name: RAZORPAY_MERCHANT_DISPLAY_NAME,
    description: description || `${RAZORPAY_MERCHANT_DISPLAY_NAME} · Official payment`,
    theme: { color: "#2563eb" },
  };
}
