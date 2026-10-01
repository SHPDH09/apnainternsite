/**
 * Internship portal document policy v1.1 — no pre-applied signatures, seals, or stamps
 * on generated previews or downloads (admin + student).
 */
export const SHOW_PREAPPLIED_SIGNATURE_AND_STAMP = false;

export function documentShowPreappliedSignature(): boolean {
  return SHOW_PREAPPLIED_SIGNATURE_AND_STAMP;
}
