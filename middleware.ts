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

  if (pathname.startsWith("/rest/")) {
    url.pathname = `/api/rest/${pathname.slice("/rest/".length)}`;
    return rewrite(url);
  }
  if (pathname.startsWith("/auth/")) {
    url.pathname = `/api/auth/${pathname.slice("/auth/".length)}`;
    return rewrite(url);
  }
  if (pathname.startsWith("/storage/")) {
    url.pathname = `/api/storage/${pathname.slice("/storage/".length)}`;
    return rewrite(url);
  }
  if (pathname.startsWith("/api/rest/") || pathname.startsWith("/api/auth/") || pathname.startsWith("/api/storage/")) {
    return rewrite(url);
  }

  return rewrite(url);
}
