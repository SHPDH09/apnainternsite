const CANONICAL_ORIGIN = "https://apnaintern.in";

/** Legacy domains serve stale builds where OTP mail API crashes — redirect before app boot. */
export function redirectLegacyDomainsToCanonical(): void {
  if (typeof window === "undefined") return;
  const host = window.location.hostname.toLowerCase();
  if (
    host === "www.ezyintern.in" ||
    host === "ezyintern.in" ||
    host === "www.apnaintern.in"
  ) {
    const target =
      CANONICAL_ORIGIN +
      window.location.pathname +
      window.location.search +
      window.location.hash;
    window.location.replace(target);
  }
}

export function getCanonicalMailApiUrl(path = "/api/send-mail"): string {
  if (typeof window === "undefined") return path;
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    return path;
  }
  return `${CANONICAL_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}
