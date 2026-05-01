import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

// On Vercel, VERCEL_URL is auto-set (without protocol). Use as fallback for NEXTAUTH_URL.
if ((!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes("example.com")) && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { tenant: true },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Block login for deactivated tenants (platform admins have no tenant)
        if (user.tenant && !user.tenant.active) return null;

        // Block login for suspended users
        if (user.suspended) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as any).role;
        token.tenantId = (user as any).tenantId;
        token.actingAs = null;
      }
      // Allow client/server to update the actingAs claim via session.update().
      // Only PLATFORM_ADMINs may carry an actingAs claim — defensively strip
      // it for any other role (cannot be used as a privilege escalation vector
      // because hasRole/getEffectiveRole only honour it when realRole is
      // PLATFORM_ADMIN, but we belt-and-brace here too).
      if (trigger === "update" && session && typeof session === "object" && "actingAs" in session) {
        if (token.role === "PLATFORM_ADMIN") {
          token.actingAs = (session as any).actingAs ?? null;
        } else {
          token.actingAs = null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).actingAs = token.role === "PLATFORM_ADMIN" ? (token.actingAs ?? null) : null;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      const u = user as any;
      if (u?.id && u?.role) {
        logAudit({ session: { user: { id: u.id, role: u.role, tenantId: u.tenantId ?? null } }, action: "auth.login", entity: "User", entityId: u.id, tenantId: u.tenantId ?? null });
      }
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};
