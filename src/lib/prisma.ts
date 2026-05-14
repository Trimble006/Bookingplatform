import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
	if (process.env.NODE_ENV === "production" || process.env.PRISMA_USE_ADAPTER === "1") {
		const adapter = new PrismaPg({ connectionString });
		return new PrismaClient({ adapter });
	}
	return new PrismaClient({});
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
