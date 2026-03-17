import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL || "(no definida)");

  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  for (const b of businesses) {
    const total = await prisma.menuItem.count({ where: { businessId: b.id, isActive: true } });
    console.log(`\n${b.name} -> ${total} items activos`);

    const cps = await prisma.cashpoint.findMany({
      where: { businessId: b.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    const general = await prisma.menuItem.count({
      where: { businessId: b.id, isActive: true, cashpointId: null },
    });
    console.log(`  GENERAL (cashpointId=null): ${general}`);

    for (const cp of cps) {
      const c = await prisma.menuItem.count({
        where: { businessId: b.id, isActive: true, cashpointId: cp.id },
      });
      console.log(`  ${cp.name}: ${c}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
