import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionOrFail, assertRoleOrFail, jsonError } from "@/lib/api-utils";

/** List all tenants (platform admin). */
export async function GET() {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertRoleOrFail(session, "PLATFORM_ADMIN");
  if (roleErr) return roleErr;

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, greens: true } } },
  });
  return NextResponse.json(tenants);
}

/** Create a new tenant with initial admin user and greens. */
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;
  const roleErr = assertRoleOrFail(session, "PLATFORM_ADMIN");
  if (roleErr) return roleErr;

  const body = await req.json();
  const { name, slug, brandColor, logoUrl, locale, adminEmail, adminPassword, greens } = body;

  if (!name || !slug || !adminEmail || !adminPassword) {
    return jsonError("name, slug, adminEmail, adminPassword are required");
  }

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) return jsonError("Slug already taken", 409);

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      brandColor: brandColor ?? "#16a34a",
      logoUrl,
      locale: locale ?? "en",
      users: {
        create: {
          email: adminEmail,
          name: `${name} Admin`,
          passwordHash,
          role: "TENANT_ADMIN",
        },
      },
      greens: greens?.length
        ? {
            create: (greens as { name: string; rinks: { name: string }[] }[]).map((g) => ({
              name: g.name,
              rinks: { create: g.rinks?.map((r) => ({ name: r.name })) ?? [] },
            })),
          }
        : undefined,
    },
    include: { users: { select: { id: true, email: true, role: true } }, greens: { include: { rinks: true } } },
  });

  return NextResponse.json(tenant, { status: 201 });
}
