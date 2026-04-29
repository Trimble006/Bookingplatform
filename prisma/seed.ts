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
  const enabledFlags = ["messaging", "events", "eventsShareExternal", "eventsShowExternal", "analytics", "publicContent", "publicEvents", "publicAvailability"];
  const disabledFlags = ["liveStreaming"];
  for (const key of enabledFlags) {
    await prisma.featureFlag.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: {},
      create: { tenantId: tenant.id, key, enabled: true },
    });
  }
  for (const key of disabledFlags) {
    await prisma.featureFlag.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: {},
      create: { tenantId: tenant.id, key, enabled: false },
    });
  }

  // Sample events
  const tenantAdmin = await prisma.user.findUnique({ where: { email: "admin@lakeview.club" } });
  if (tenantAdmin) {
    const existingEvents = await prisma.event.count({ where: { tenantId: tenant.id } });
    if (existingEvents === 0) {
      await prisma.event.createMany({
        data: [
          {
            tenantId: tenant.id,
            title: "Summer Open Day",
            description: "Come and try bowls! Free taster sessions for new players of all ages.",
            category: "OPEN_DAY",
            date: "2026-06-15",
            startTime: "10:00",
            endTime: "16:00",
            visibility: "PUBLIC",
            status: "PUBLISHED",
            createdById: tenantAdmin.id,
          },
          {
            tenantId: tenant.id,
            title: "Club Pairs Championship",
            description: "Annual pairs knockout competition. Entry fee includes lunch.",
            category: "COMPETITION",
            format: "KNOCKOUT",
            playerCount: "PAIRS",
            date: "2026-07-12",
            startTime: "09:00",
            endTime: "17:00",
            capacity: 32,
            entryFee: 1500,
            contactName: "Lakeview Admin",
            contactEmail: "admin@lakeview.club",
            visibility: "MEMBERS_ONLY",
            status: "PUBLISHED",
            createdById: tenantAdmin.id,
          },
          {
            tenantId: tenant.id,
            title: "Friday Social Roll-Up",
            description: "Casual Friday afternoon social bowling. All welcome, no need to book.",
            category: "SOCIAL",
            date: "2026-06-20",
            startTime: "14:00",
            endTime: "17:00",
            visibility: "MEMBERS_ONLY",
            status: "DRAFT",
            createdById: tenantAdmin.id,
          },
        ],
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
