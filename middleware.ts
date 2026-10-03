import { rewrite } from "@vercel/functions";

/**
 * Browser Supabase client calls /rest, /auth, /storage on the site origin.
 * Ensure those hit Vercel serverless Express (/api/rest/*) before SPA fallback.
 */
export const config = {
  matcher: [
    "/rest/:path*",
    "/auth/:path*",
    "/storage/:path*",
    "/api/rest/:path*",
    "/api/auth/:path*",
    "/api/storage/:path*",
  ],
};

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const { pathname } = url;

  const shim = (surface: "rest" | "auth" | "storage", prefix: string) => {
    const sub = pathname.slice(prefix.length);
    url.pathname = "/api/rds-supabase-shim";
    url.searchParams.set("__surface", surface);
    url.searchParams.set("__path", sub.replace(/^\//, ""));
    return rewrite(url);
  };
  if (pathname.startsWith("/rest/")) return shim("rest", "/rest/");
  if (pathname.startsWith("/auth/")) return shim("auth", "/auth/");
  if (pathname.startsWith("/storage/")) return shim("storage", "/storage/");
  if (pathname.startsWith("/api/rest/")) return shim("rest", "/api/rest/");
  if (pathname.startsWith("/api/auth/")) return shim("auth", "/api/auth/");
  if (pathname.startsWith("/api/storage/")) return shim("storage", "/api/storage/");

  return rewrite(url);
}
