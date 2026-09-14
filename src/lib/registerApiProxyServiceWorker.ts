/** Remove legacy api-proxy-sw (cross-origin fetch caused CORS console errors). */
export async function unregisterLegacyApiProxyServiceWorker(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((reg) => reg.active?.scriptURL.includes("api-proxy-sw"))
        .map((reg) => reg.unregister()),
    );
  } catch {
    /* ignore */
  }
}
