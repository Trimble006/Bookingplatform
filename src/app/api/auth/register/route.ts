import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { email, password, name, tenantSlug } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  let tenantId: string | null = null;
  if (tenantSlug) {
    const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug, active: true } });
    if (!tenant) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }
    tenantId = tenant.id;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, name, passwordHash, tenantId, role: "USER" },
    select: { id: true, email: true, name: true, role: true, tenantId: true },
  });

  return NextResponse.json(user, { status: 201 });
}
