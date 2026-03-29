import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/auth/login" },
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/bookings/:path*", "/api/maintenance/:path*", "/api/notifications/:path*", "/api/admin/:path*"],
};
