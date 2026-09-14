import type { BulkCustomMailResult } from "@/lib/bulkCustomMailSend";
import { toast } from "sonner";

/** Show toast for bulk mail outcome; returns whether send fully succeeded. */
export function toastBulkMailResult(
  result: BulkCustomMailResult,
  totalTargets: number,
  opts?: { onFullSuccess?: () => void }
): boolean {
  const detail = result.lastError?.trim();

  if (result.rateLimited) {
    toast.error(
      result.sent > 0
        ? `Mail rate limit after ${result.sent} sent. Wait ~1 hour, then send the remaining ${Math.max(0, totalTargets - result.sent - result.failed)} in smaller batches.${detail ? ` (${detail})` : ""}`
        : `Mail rate limit — wait before retrying.${detail ? ` ${detail}` : ""}`
    );
    return false;
  }

  if (result.sent === 0 && totalTargets > 0) {
    toast.error(
      detail ||
        "Email could not be sent. Check that SMTP is configured on the server (SMTP_USER / SMTP_PASS)."
    );
    return false;
  }

  if (result.failed > 0) {
    toast.warning(
      `Sent ${result.sent} of ${totalTargets}. ${result.failed} failed.${detail ? ` Last error: ${detail}` : ""}`
    );
    return false;
  }

  toast.success(`Sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"}.`);
  opts?.onFullSuccess?.();
  return true;
}
