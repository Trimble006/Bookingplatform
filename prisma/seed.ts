import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Platform admin
  const adminHash = await bcrypt.hash("admin123", 12);
  const platformAdmin = await prisma.user.upsert({
    where: { email: "admin@wlbooking.com" },
    update: {},
    create: {
      email: "admin@wlbooking.com",
      name: "Platform Admin",
      passwordHash: adminHash,
      role: "PLATFORM_ADMIN",
    },
  });
  console.log("Platform admin:", platformAdmin.email);

  // Demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "lakeview-bowls" },
    update: {},
    create: {
      name: "Lakeview Bowls Club",
      slug: "lakeview-bowls",
      brandColor: "#16a34a",
      locale: "en",
      seasonStart: "2026-04-01",
      seasonEnd: "2026-09-30",
      openingTime: "09:00",
      closingTime: "18:00",
    },
  });

  // Greens & rinks
  const green = await prisma.green.upsert({
    where: { id: "seed-green-1" },
    update: {},
    create: {
      id: "seed-green-1",
      name: "Main Green",
      tenantId: tenant.id,
    },
  });

  for (let i = 1; i <= 6; i++) {
    await prisma.rink.upsert({
      where: { id: `seed-rink-${i}` },
      update: {},
      create: {
        id: `seed-rink-${i}`,
        name: `Rink ${i}`,
        greenId: green.id,
      },
    });
  }

  // Tenant admin user
  const tenantAdminHash = await bcrypt.hash("club123", 12);
  await prisma.user.upsert({
    where: { email: "admin@lakeview.club" },
    update: {},
    create: {
      email: "admin@lakeview.club",
      name: "Lakeview Admin",
      passwordHash: tenantAdminHash,
      role: "TENANT_ADMIN",
      tenantId: tenant.id,
    },
  });

  // Regular user
  const userHash = await bcrypt.hash("user123", 12);
  await prisma.user.upsert({
    where: { email: "user@lakeview.club" },
    update: {},
    create: {
      email: "user@lakeview.club",
      name: "Doris Smith",
      passwordHash: userHash,
      role: "USER",
      tenantId: tenant.id,
    },
  });

  // Maintenance user
  await prisma.user.upsert({
    where: { email: "maint@lakeview.club" },
    update: {},
    create: {
      email: "maint@lakeview.club",
      name: "Kevin Grounds",
      passwordHash: userHash,
      role: "MAINTENANCE",
      tenantId: tenant.id,
    },
  });

  // Feature flags
  for (const key of ["liveStreaming", "messaging", "events"]) {
    await prisma.featureFlag.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: {},
      create: { tenantId: tenant.id, key, enabled: false },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
