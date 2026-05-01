import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Platform-mode (non-impersonating PLATFORM_ADMIN) users must remain inside
// /dashboard, /dashboard/platform/* and the platform-only API surface. This
// middleware bounces them out of tenant-plane dashboard paths to the picker.
const PLATFORM_ALLOWED_DASHBOARD_PREFIXES = ["/dashboard/platform"];
const PLATFORM_ALLOWED_DASHBOARD_EXACT = new Set(["/dashboard"]);

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token as
      | { role?: string; actingAs?: { tenantId?: string } | null }
      | null;
    if (!token) return NextResponse.next();

    const isPlatformAdmin = token.role === "PLATFORM_ADMIN";
    const isImpersonating = !!token.actingAs;
    const inPlatformMode = isPlatformAdmin && !isImpersonating;
    const { pathname } = req.nextUrl;

    if (inPlatformMode && pathname.startsWith("/dashboard")) {
      const allowed =
        PLATFORM_ALLOWED_DASHBOARD_EXACT.has(pathname) ||
        PLATFORM_ALLOWED_DASHBOARD_PREFIXES.some((p) => pathname.startsWith(p));
      if (!allowed) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: "/auth/login" },
  },
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/bookings/:path*",
    "/api/maintenance/:path*",
    "/api/notifications/:path*",
    "/api/admin/:path*",
    "/api/audit/:path*",
    "/api/messaging/:path*",
    "/api/platform/:path*",
  ],
};
