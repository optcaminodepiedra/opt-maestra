/* prisma/seed.cjs */
require("dotenv").config();

const { PrismaClient, Role, PaymentMethod } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

function cents(mx) {
  return Math.round(Number(mx || 0) * 100);
}

async function hash(pw) {
  return bcrypt.hash(pw, 10);
}

async function main() {
  // ==============================
  // ✅ Negocios (Business)
  // ==============================
  const businesses = [
    "Hotel Camino de Piedra",
    "Tierra Adentro Hotel Fashion Grill & Spa",
    "Rancho El Milagrito",
    "Bodega 4",
    "Bar San Antonio",
    "Museo Casa de los Lamentos",
    "Museo Las Catacumbas",
  ];

  const biz = new Map();
  for (const name of businesses) {
    const b = await prisma.business.upsert({
      where: { name },
      update: {},
      create: { name },
      select: { id: true },
    });
    biz.set(name, b.id);
  }

  // ==============================
  // ✅ Cashpoints (Cajas/Puntos)
  // ==============================
  const cashpointsSpec = [
    ["Bodega 4", ["Caja", "Restaurante", "Barra"]],
    ["Hotel Camino de Piedra", ["Recepción/Caja"]],
    ["Museo Casa de los Lamentos", ["Caja"]],
    ["Museo Las Catacumbas", ["Caja"]],
    ["Rancho El Milagrito", ["Hospedaje", "Restaurante Los Jabalíes", "Cantina Lobo Aullador"]],
    ["Bar San Antonio", ["Piso 1", "Piso 2", "Piso 3"]],
    ["Tierra Adentro Hotel Fashion Grill & Spa", ["Hospedaje", "Restaurante"]],
  ];

  const cashpointIdByBizAndName = new Map(); // key: `${bizId}:${cpName}` => cpId

  for (const [businessName, points] of cashpointsSpec) {
    const businessId = biz.get(businessName);
    for (const cpName of points) {
      const cp = await prisma.cashpoint.upsert({
        where: { businessId_name: { businessId, name: cpName } },
        update: {},
        create: { businessId, name: cpName },
        select: { id: true, businessId: true, name: true },
      });
      cashpointIdByBizAndName.set(`${cp.businessId}:${cp.name}`, cp.id);
    }
  }

  // ==============================
  // ✅ Usuarios (con PIN POS)
  // ==============================
  const defaultPwHash = await hash("Camino2026!");
  const defaultPinHash = await bcrypt.hash("1234", 10);

  const users = [
    { fullName: "Arroiz", username: "arroiz", role: Role.MASTER_ADMIN, primaryBusiness: "Hotel Camino de Piedra" },

    { fullName: "Alejandro N", username: "alejandro.n", role: Role.OWNER },
    { fullName: "Saul N", username: "saul.n", role: Role.OWNER },
    { fullName: "Sabina N", username: "sabina.n", role: Role.OWNER },
    { fullName: "Samantha S", username: "samantha.s", role: Role.OWNER },

    { fullName: "Judith R", username: "judith.r", role: Role.SUPERIOR, primaryBusiness: "Bodega 4" },
    { fullName: "Claudia O", username: "claudia.o", role: Role.SUPERIOR, primaryBusiness: "Tierra Adentro Hotel Fashion Grill & Spa" },
    { fullName: "Hazael A", username: "hazael.a", role: Role.SUPERIOR, primaryBusiness: "Rancho El Milagrito" },

    { fullName: "Saul P", username: "saul.p", role: Role.MANAGER },
    { fullName: "Iris", username: "iris", role: Role.MANAGER },

    { fullName: "Carlos P", username: "carlos.p", role: Role.STAFF_KITCHEN, primaryBusiness: "Bodega 4" },
    { fullName: "Daniela", username: "daniela", role: Role.STAFF_KITCHEN },
    { fullName: "Sabrina P", username: "sabrina.p", role: Role.STAFF_BAR, primaryBusiness: "Bar San Antonio" },

    { fullName: "Carlos", username: "carlos", role: Role.STAFF_WAITER, primaryBusiness: "Bodega 4" },
    { fullName: "Francisco", username: "francisco", role: Role.STAFF_WAITER, primaryBusiness: "Bodega 4" },
    { fullName: "Vanessa", username: "vanessa", role: Role.STAFF_WAITER, primaryBusiness: "Bodega 4" },

    { fullName: "Ana", username: "ana", role: Role.STAFF_RECEPTION, primaryBusiness: "Hotel Camino de Piedra" },

    { fullName: "Paulo", username: "paulo", role: Role.MANAGER, primaryBusiness: "Tierra Adentro Hotel Fashion Grill & Spa" },

    { fullName: "Cristian", username: "cristian", role: Role.STAFF_EXPERIENCES, primaryBusiness: "Rancho El Milagrito" },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        fullName: u.fullName,
        role: u.role,
        isActive: true,
        primaryBusinessId: u.primaryBusiness ? biz.get(u.primaryBusiness) : null,
        passwordHash: defaultPwHash,
        pinHash: defaultPinHash,
        pinUpdatedAt: new Date(),
      },
      create: {
        fullName: u.fullName,
        username: u.username,
        role: u.role,
        isActive: true,
        primaryBusinessId: u.primaryBusiness ? biz.get(u.primaryBusiness) : null,
        passwordHash: defaultPwHash,
        pinHash: defaultPinHash,
        pinUpdatedAt: new Date(),
      },
    });
  }

  // ==============================
  // ✅ Seed Restaurante (Mesas + Menú) SEPARADO por:
  // - Business (unidad)
  // - Cashpoint (local/caja) cuando aplique (Rancho y opcional)
  // ==============================

  async function ensureTables({ businessName, cashpointName, tableNames }) {
    const businessId = biz.get(businessName);
    const cashpointId = cashpointName
      ? cashpointIdByBizAndName.get(`${businessId}:${cashpointName}`)
      : null;

    for (const name of tableNames) {
      await prisma.restaurantTable.upsert({
        where: { businessId_name: { businessId, name } },
        update: {
          isActive: true,
          cashpointId: cashpointId || null,
        },
        create: {
          businessId,
          name,
          capacity: 4,
          isActive: true,
          cashpointId: cashpointId || null,
          sortOrder: 0,
        },
      });
    }
  }

  async function ensureMenu({ businessName, cashpointName, items }) {
    const businessId = biz.get(businessName);
    const cashpointId = cashpointName
      ? cashpointIdByBizAndName.get(`${businessId}:${cashpointName}`)
      : null;

    for (const it of items) {
      // ✅ ID estable para seed (NO recomendado para prod, pero útil para no duplicar)
      const stableId = `${businessId}:${cashpointId || "GENERAL"}:${it.category}:${it.name}`;

      await prisma.menuItem.upsert({
        where: { id: stableId },
        update: {
          businessId,
          cashpointId: cashpointId || null,
          category: it.category,
          name: it.name,
          priceCents: cents(it.price),
          isActive: true,
        },
        create: {
          id: stableId,
          businessId,
          cashpointId: cashpointId || null,
          category: it.category,
          name: it.name,
          priceCents: cents(it.price),
          isActive: true,
        },
      });
    }
  }

  // --- Bodega 4 (menú general del negocio, y puedes separar por "Restaurante" / "Barra" si quieres después)
  await ensureTables({
    businessName: "Bodega 4",
    cashpointName: "Restaurante",
    tableNames: ["M1", "M2", "M3", "M4", "Terraza 1", "Terraza 2"],
  });

  await ensureMenu({
    businessName: "Bodega 4",
    cashpointName: "Restaurante",
    items: [
      { category: "Entradas", name: "Guacamole", price: 120 },
      { category: "Entradas", name: "Papas gajo", price: 110 },
      { category: "Hamburguesas", name: "Hamburguesa Clásica", price: 190 },
      { category: "Hamburguesas", name: "Hamburguesa BBQ", price: 220 },
      { category: "Bebidas", name: "Refresco", price: 45 },
      { category: "Bebidas", name: "Agua natural", price: 35 },
    ],
  });

  // --- Tierra Adentro (Restaurante)
  await ensureTables({
    businessName: "Tierra Adentro Hotel Fashion Grill & Spa",
    cashpointName: "Restaurante",
    tableNames: ["TA1", "TA2", "TA3", "TA4", "TA5"],
  });

  await ensureMenu({
    businessName: "Tierra Adentro Hotel Fashion Grill & Spa",
    cashpointName: "Restaurante",
    items: [
      { category: "Entradas", name: "Ensalada", price: 160 },
      { category: "Platos", name: "Corte Grill", price: 420 },
      { category: "Bebidas", name: "Refresco", price: 55 },
    ],
  });

  // --- Rancho: Los Jabalíes (Restaurante) y Cantina (MENÚS SEPARADOS)
  await ensureTables({
    businessName: "Rancho El Milagrito",
    cashpointName: "Restaurante Los Jabalíes",
    tableNames: ["RJ1", "RJ2", "RJ3", "RJ4", "Exterior 1", "Exterior 2"],
  });

  await ensureMenu({
    businessName: "Rancho El Milagrito",
    cashpointName: "Restaurante Los Jabalíes",
    items: [
      { category: "Entradas", name: "Nachos", price: 140 },
      { category: "Platos", name: "Arrachera", price: 320 },
      { category: "Bebidas", name: "Agua", price: 35 },
    ],
  });

  await ensureTables({
    businessName: "Rancho El Milagrito",
    cashpointName: "Cantina Lobo Aullador",
    tableNames: ["CL1", "CL2", "CL3", "Barra 1", "Barra 2"],
  });

  await ensureMenu({
    businessName: "Rancho El Milagrito",
    cashpointName: "Cantina Lobo Aullador",
    items: [
      { category: "Alcohol", name: "Cerveza", price: 75 },
      { category: "Alcohol", name: "Michelada", price: 110 },
      { category: "Mixología", name: "Coctel de la casa", price: 160 },
    ],
  });

  // ==============================
  // ✅ Demo ventas/gastos (opcional)
  // ==============================
  const bodegaId = biz.get("Bodega 4");
  const barId = biz.get("Bar San Antonio");

  const bodegaCaja = await prisma.cashpoint.findFirst({ where: { businessId: bodegaId, name: "Caja" } });
  const barP1 = await prisma.cashpoint.findFirst({ where: { businessId: barId, name: "Piso 1" } });

  const judith = await prisma.user.findUnique({ where: { username: "judith.r" } });
  const sabrina = await prisma.user.findUnique({ where: { username: "sabrina.p" } });

  if (bodegaCaja && judith) {
    const shiftBodega = await prisma.shift.create({
      data: {
        businessId: bodegaId,
        cashpointId: bodegaCaja.id,
        openedById: judith.id,
        notes: "Turno demo",
      },
    });

    await prisma.sale.createMany({
      data: [
        { businessId: bodegaId, cashpointId: bodegaCaja.id, shiftId: shiftBodega.id, userId: judith.id, amountCents: cents(1860), method: PaymentMethod.CARD, concept: "Restaurante" },
        { businessId: bodegaId, cashpointId: bodegaCaja.id, shiftId: shiftBodega.id, userId: judith.id, amountCents: cents(740), method: PaymentMethod.CASH, concept: "Barra" },
      ],
    });

    await prisma.expense.createMany({
      data: [
        { businessId: bodegaId, userId: judith.id, amountCents: cents(320), category: "Compras urgentes", note: "Hielo / insumo" },
        { businessId: bodegaId, userId: judith.id, amountCents: cents(150), category: "Caja chica", note: "Imprevisto" },
      ],
    });
  }

  if (barP1 && sabrina) {
    const shiftBar = await prisma.shift.create({
      data: {
        businessId: barId,
        cashpointId: barP1.id,
        openedById: sabrina.id,
        notes: "Turno demo bar piso 1",
      },
    });

    await prisma.sale.createMany({
      data: [
        { businessId: barId, cashpointId: barP1.id, shiftId: shiftBar.id, userId: sabrina.id, amountCents: cents(560), method: PaymentMethod.CASH, concept: "Coctelería" },
        { businessId: barId, cashpointId: barP1.id, shiftId: shiftBar.id, userId: sabrina.id, amountCents: cents(920), method: PaymentMethod.CARD, concept: "Botella" },
      ],
    });
  }

  console.log("Seed completo ✅ (PIN POS: 1234)");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
