function isLocalBrowserHost(): boolean {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
}

/** Register SW so same-origin API calls reach Lambda /staging (bypasses broken edge proxy). */
export async function registerApiProxyServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (isLocalBrowserHost()) return;

  try {
    const reg = await navigator.serviceWorker.register("/api-proxy-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller && reg.active) {
      await reg.update();
    }
  } catch (err) {
    console.warn("[apnaintern] API proxy service worker failed to register:", err);
  }
}
