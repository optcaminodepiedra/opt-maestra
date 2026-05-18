"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/session";
import type { PaymentMethod } from "@prisma/client";

// ──────────────────────────────────────────────────────────
// Helpers de conversión
// ──────────────────────────────────────────────────────────
function asNum(s?: string | null): number {
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function asInt(s?: string | null): number {
  if (!s) return 0;
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}
function asCents(s?: string | null): number {
  if (!s) return 0;
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}
function asBool(s?: string | null): boolean {
  return s === "true" || s === "1";
}
function asDate(s?: string | null): Date | null {
  if (!s || s.trim() === "") return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function normalizePaymentMethod(c?: string | null): "CASH" | "CARD" | "TRANSFER" | null {
  if (!c) return null;
  const code = c.toUpperCase().trim();
  if (code === "EF" || code.startsWith("EFEC")) return "CASH";
  const cards = ["VISA","MASTER","MC","AMEX","AMERIC","TARJ","TC","TD","CRED","DEB",
    "BANCOM","BANAM","BBVA","HSBC","SANTANDER","AZTECA","BANORTE","SCOTIA",
    "MERCADO","CLIP","STRIPE"];
  if (cards.some(p => code.includes(p))) return "CARD";
  const transfers = ["TRANSF","SPEI","DEPO","PAYPAL","TR","CR"];
  if (transfers.includes(code) || transfers.some(p => code.includes(p))) return "TRANSFER";
  if (code === "VAL" || code.includes("VALE")) return "CARD";
  return null;
}

// ──────────────────────────────────────────────────────────
// TIPOS
// ──────────────────────────────────────────────────────────
type ChequeJson = {
  folio: string;
  fecha?: string; cierre?: string;
  mesa?: string; nopersonas?: string; mesero?: string;
  total?: string; subtotal?: string; descuento?: string;
  propina?: string; propinaincluida?: string;
  totalarticulos?: string;
  cancelado?: string; razoncancelado?: string;
  numcheque?: string; idturno?: string; tipodeservicio?: string;
};
type CheqdetJson = {
  foliodet: string;
  movimiento?: string; cantidad?: string; claveprod: string;
  precio?: string; descuento?: string; impuesto?: string;
  preciocatalogo?: string; hora?: string;
  modificador?: string; idproductocompuesto?: string;
  productocompuestoprincipal?: string;
  comentario?: string; estacion?: string;
  idmeseroproducto?: string; comanda?: string;
};
type ChequePagoJson = {
  folio: string;
  idformadepago?: string; importe?: string;
  propina?: string; tipodecambio?: string; referencia?: string;
};
type ProductoJson = {
  clave: string; descripcion: string;
  grupo?: string; precio?: string; bloqueado?: string;
};
type GrupoJson = { clave: string; descripcion: string };
type MeseroJson = { clave: string; nombre?: string };
type TurnoJson = {
  idturno: string;
  apertura?: string; cierre?: string;
  fondo?: string; cajero?: string; estacion?: string;
  efectivo?: string; tarjeta?: string; vales?: string; credito?: string;
};

async function createBatch(
  businessId: string,
  filename: string,
  entityType: any,
  totalRows: number,
  note: string,
  userId: string
) {
  return prisma.importBatch.create({
    data: {
      entityType, businessId, filename, totalRows,
      status: "PROCESSING", note, createdById: userId,
    },
  });
}

async function finalizeBatch(batchId: string, success: number, errors: any[]) {
  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      successRows: success,
      errorRows: errors.length,
      status: errors.length > 0 && success === 0 ? "FAILED" : "COMPLETED",
      completedAt: new Date(),
      errors: errors.length > 0 ? errors.slice(0, 50) : undefined,
    },
  });
}

// ============================================================
// CATÁLOGOS — bulk
// ============================================================

export async function importGruposV2(input: {
  businessId: string;
  grupos: GrupoJson[];
  filename: string;
}) {
  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");
  const batch = await createBatch(
    input.businessId, input.filename, "MENU_ITEMS",
    input.grupos.length, `Grupos SR (${input.grupos.length})`, me.id as string
  );
  await finalizeBatch(batch.id, input.grupos.length, []);
  revalidatePath("/app/manager/ops/imports-v2");
  return { totalGrupos: input.grupos.length, batchId: batch.id };
}

export async function importProductosV2(input: {
  businessId: string;
  productos: ProductoJson[];
  grupos: GrupoJson[];
  filename: string;
}) {
  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");

  const groupNames = new Map<string, string>();
  for (const g of input.grupos) {
    if (g.clave) groupNames.set(g.clave, g.descripcion || g.clave);
  }

  const batch = await createBatch(
    input.businessId, input.filename, "MENU_ITEMS",
    input.productos.length,
    `Productos SR (${input.productos.length} productos, ${groupNames.size} grupos)`,
    me.id as string
  );

  const existing = await prisma.menuItem.findMany({
    where: {
      businessId: input.businessId,
      externalCode: { in: input.productos.map(p => p.clave).filter(Boolean) },
    },
    select: { id: true, externalCode: true },
  });
  const existingByCode = new Map<string, string>(existing.map((e: any) => [e.externalCode, e.id]));

  let created = 0, updated = 0;
  const errors: any[] = [];
  const toCreate: any[] = [];
  const toUpdate: { id: string; data: any }[] = [];

  for (const p of input.productos) {
    if (!p.clave || !p.descripcion) {
      errors.push({ clave: p.clave, reason: "Sin clave/desc" });
      continue;
    }
    const data = {
      businessId: input.businessId,
      name: p.descripcion,
      category: groupNames.get(p.grupo || "") || p.grupo || "Sin categoría",
      priceCents: asCents(p.precio),
      isActive: !asBool(p.bloqueado),
      externalCode: p.clave,
      groupCode: p.grupo || null,
      groupName: groupNames.get(p.grupo || "") || null,
      isPhantom: false,
    };
    const existingId = existingByCode.get(p.clave);
    if (existingId) toUpdate.push({ id: existingId, data });
    else toCreate.push(data);
  }

  if (toCreate.length > 0) {
    const r = await prisma.menuItem.createMany({ data: toCreate, skipDuplicates: true });
    created = r.count;
  }
  if (toUpdate.length > 0) {
    const batchSize = 20;
    for (let i = 0; i < toUpdate.length; i += batchSize) {
      const slice = toUpdate.slice(i, i + batchSize);
      await Promise.all(
        slice.map(u => prisma.menuItem.update({ where: { id: u.id }, data: u.data }))
      );
      updated += slice.length;
    }
  }

  await finalizeBatch(batch.id, created + updated, errors);
  revalidatePath("/app/manager/ops/imports-v2");
  return { totalProductos: input.productos.length, created, updated, errors: errors.length, batchId: batch.id };
}

export async function importMeserosV2(input: {
  businessId: string;
  meseros: MeseroJson[];
  filename: string;
}) {
  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");

  const batch = await createBatch(
    input.businessId, input.filename, "EMPLOYEES",
    input.meseros.length, `Meseros SR (${input.meseros.length})`, me.id as string
  );

  const existing = await prisma.externalUserMapping.findMany({
    where: {
      businessId: input.businessId,
      externalSource: "softrestaurant",
      kind: "WAITER",
      externalUserId: { in: input.meseros.map(m => m.clave).filter(Boolean) },
    },
    select: { id: true, externalUserId: true },
  });
  const existingByCode = new Map<string, string>(existing.map((e: any) => [e.externalUserId, e.id]));

  const toCreate: any[] = [];
  const toUpdate: { id: string; data: any }[] = [];
  const errors: any[] = [];

  for (const m of input.meseros) {
    if (!m.clave) { errors.push({ m, reason: "Sin clave" }); continue; }
    const data = {
      businessId: input.businessId,
      externalSource: "softrestaurant",
      externalUserId: m.clave,
      externalUserName: m.nombre || null,
      kind: "WAITER",
    };
    const id = existingByCode.get(m.clave);
    if (id) toUpdate.push({ id, data: { externalUserName: m.nombre || null } });
    else toCreate.push(data);
  }

  let success = 0;
  if (toCreate.length > 0) {
    const r = await prisma.externalUserMapping.createMany({ data: toCreate, skipDuplicates: true });
    success += r.count;
  }
  if (toUpdate.length > 0) {
    await Promise.all(toUpdate.map(u =>
      prisma.externalUserMapping.update({ where: { id: u.id }, data: u.data })
    ));
    success += toUpdate.length;
  }

  await finalizeBatch(batch.id, success, errors);
  revalidatePath("/app/manager/ops/imports-v2");
  return { totalMeseros: input.meseros.length, success, errors: errors.length, batchId: batch.id };
}

// ============================================================
// VENTAS — ULTRA OPTIMIZADO
// ============================================================

export type StartImportInput = {
  businessId: string;
  filename: string;
  totalCheques: number;
  totalCheqdet: number;
  totalPagos: number;
  cashpointId?: string;
};

export async function startVentasImport(input: StartImportInput) {
  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");

  let cashpointId = input.cashpointId;
  if (!cashpointId) {
    const cp = await prisma.cashpoint.findFirst({
      where: { businessId: input.businessId },
      orderBy: { createdAt: "asc" },
    });
    if (!cp) throw new Error("El negocio no tiene cashpoint");
    cashpointId = cp.id;
  }

  const batch = await prisma.importBatch.create({
    data: {
      entityType: "SALES",
      businessId: input.businessId,
      filename: input.filename,
      totalRows: input.totalCheques,
      status: "PROCESSING",
      note: `Inicio: ${input.totalCheques} tickets / ${input.totalCheqdet} líneas / ${input.totalPagos} pagos`,
      createdById: me.id as string,
    },
  });

  return { batchId: batch.id, cashpointId };
}

export type ChunkInput = {
  businessId: string;
  batchId: string;
  cashpointId: string;
  userId: string;
  cheques: ChequeJson[];
  cheqdetByFolio: Record<string, CheqdetJson[]>;
  pagosByFolio: Record<string, ChequePagoJson[]>;
  canceladosFolios: string[];
};

export async function importChequesChunk(input: ChunkInput) {
  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");
  const userId = input.userId || (me.id as string);
  const canceladosSet = new Set(input.canceladosFolios);

  // 1. UNA query para detectar duplicados
  const folios = input.cheques.map(c => c.folio).filter(Boolean);
  const existingSales = await prisma.sale.findMany({
    where: {
      businessId: input.businessId,
      externalSource: "softrestaurant",
      externalFolio: { in: folios },
    },
    select: { externalFolio: true },
  });
  const existingFoliosSet = new Set(existingSales.map(s => s.externalFolio));
  const chequesToCreate = input.cheques.filter(c => !existingFoliosSet.has(c.folio));
  const salesSkipped = input.cheques.length - chequesToCreate.length;

  if (chequesToCreate.length === 0) {
    return {
      salesCreated: 0, salesSkipped, salesErrors: 0,
      totalLines: 0, totalPagos: 0, phantoms: 0, canceled: 0,
      errors: [],
    };
  }

  // 2. UNA query para cargar MenuItems
  const allCodes = new Set<string>();
  for (const c of chequesToCreate) {
    const lines = input.cheqdetByFolio[c.folio] || [];
    for (const l of lines) {
      if (l.claveprod) allCodes.add(l.claveprod.trim());
    }
  }
  const menuItemCache = await prisma.menuItem.findMany({
    where: {
      businessId: input.businessId,
      externalCode: { in: Array.from(allCodes) },
    },
    select: { id: true, externalCode: true, name: true, groupCode: true, groupName: true },
  });
  type MenuItemMini = typeof menuItemCache[number];
  const menuItemByCode = new Map<string, MenuItemMini>(
    menuItemCache.map(mi => [mi.externalCode!, mi])
  );

  // 3. Phantoms en batch
  const phantomCodes = Array.from(allCodes).filter(c => !menuItemByCode.has(c));
  let phantoms = 0;
  if (phantomCodes.length > 0) {
    const phantomData = phantomCodes.map(code => {
      let priceCents = 0;
      for (const c of chequesToCreate) {
        const lines = input.cheqdetByFolio[c.folio] || [];
        const line = lines.find(l => l.claveprod?.trim() === code);
        if (line) {
          priceCents = asCents(line.preciocatalogo) || asCents(line.precio);
          break;
        }
      }
      return {
        businessId: input.businessId,
        name: `[?] Producto ${code}`,
        category: "Sin catálogo",
        priceCents,
        isActive: true,
        externalCode: code,
        isPhantom: true,
      };
    });
    await prisma.menuItem.createMany({ data: phantomData, skipDuplicates: true });
    phantoms = phantomCodes.length;
    const newPhantoms = await prisma.menuItem.findMany({
      where: { businessId: input.businessId, externalCode: { in: phantomCodes } },
      select: { id: true, externalCode: true, name: true, groupCode: true, groupName: true },
    });
    for (const p of newPhantoms) menuItemByCode.set(p.externalCode!, p);
  }

  // 4. Preparar Sales con IDs locales generados con función simple
  // (formato similar a cuid: prefijo + random + timestamp)
  function genId(): string {
    const ts = Date.now().toString(36);
    const rnd = Math.random().toString(36).substring(2, 12);
    return `imp_${ts}${rnd}`;
  }

  type SaleData = { id: string; folio: string; data: any };
  const salesToInsert: SaleData[] = [];
  const lineErrors: any[] = [];
  let canceled = 0;

  for (const cheque of chequesToCreate) {
    try {
      const folio = cheque.folio;
      const pagos = input.pagosByFolio[folio] || [];
      let method: PaymentMethod = "CASH";
      if (pagos.length > 0) {
        const sorted = [...pagos].sort((a, b) => asNum(b.importe) - asNum(a.importe));
        const m = normalizePaymentMethod(sorted[0].idformadepago);
        if (m) method = m;
      }
      const fecha = asDate(cheque.fecha) || new Date();
      const cierre = asDate(cheque.cierre);
      const isCanceled = asBool(cheque.cancelado) || canceladosSet.has(folio);
      if (isCanceled) canceled++;

      const id = genId();
      salesToInsert.push({
        id,
        folio,
        data: {
          id,
          businessId: input.businessId,
          cashpointId: input.cashpointId,
          userId,
          amountCents: asCents(cheque.total),
          method,
          concept: "Venta SoftRestaurant",
          createdAt: cierre || fecha,
          mesaName: cheque.mesa || null,
          noPersonas: asInt(cheque.nopersonas) || null,
          externalWaiterId: cheque.mesero || null,
          externalShiftId: cheque.idturno || null,
          openedAt: fecha,
          closedAt: cierre,
          totalItems: asNum(cheque.totalarticulos),
          subtotalCents: asCents(cheque.subtotal) || null,
          discountCents: asCents(cheque.descuento) || null,
          tipCents: (asCents(cheque.propina) || asCents(cheque.propinaincluida)) || null,
          isCanceled,
          canceledReason: cheque.razoncancelado || null,
          ticketRef: cheque.numcheque || null,
          serviceType: cheque.tipodeservicio || null,
          externalSource: "softrestaurant",
          externalFolio: folio,
          importBatchId: input.batchId,
        },
      });
    } catch (e: any) {
      lineErrors.push({ folio: cheque.folio, reason: e.message?.slice(0, 200) });
    }
  }

  // 5. createMany Sales
  if (salesToInsert.length > 0) {
    await prisma.sale.createMany({
      data: salesToInsert.map(s => s.data),
      skipDuplicates: true,
    });
  }

  // 6. Preparar SaleLines
  const saleLinesToInsert: any[] = [];
  let totalLines = 0;
  for (const sale of salesToInsert) {
    const lines = input.cheqdetByFolio[sale.folio] || [];
    for (const line of lines) {
      const claveprod = line.claveprod?.trim();
      if (!claveprod) continue;
      const mi = menuItemByCode.get(claveprod);
      if (!mi) continue;
      const qty = asNum(line.cantidad) || 1;
      const unitPrice = asCents(line.precio);
      const discount = asCents(line.descuento);
      const amountCents = Math.round(qty * (unitPrice - discount));
      saleLinesToInsert.push({
        saleId: sale.id,
        businessId: input.businessId,
        menuItemId: mi.id,
        productCode: claveprod,
        productName: mi.name,
        groupCode: mi.groupCode || null,
        groupName: mi.groupName || null,
        qty,
        unitPriceCents: unitPrice,
        discountCents: discount,
        taxPercent: asNum(line.impuesto),
        amountCents,
        movimiento: asInt(line.movimiento) || null,
        comanda: line.comanda || null,
        comentario: line.comentario || null,
        estacion: line.estacion || null,
        isModifier: asBool(line.modificador),
        isCompoundChild: !!line.idproductocompuesto,
        isCompoundPrincipal: asBool(line.productocompuestoprincipal),
        soldAt: asDate(line.hora),
        externalWaiterId: line.idmeseroproducto || null,
        externalSource: "softrestaurant",
        externalFolioDet: line.foliodet || null,
        externalMovimiento: asInt(line.movimiento) || null,
        importBatchId: input.batchId,
      });
      totalLines++;
    }
  }

  // 7. createMany SaleLines en batches de 500
  if (saleLinesToInsert.length > 0) {
    const BATCH = 500;
    for (let i = 0; i < saleLinesToInsert.length; i += BATCH) {
      await prisma.saleLine.createMany({
        data: saleLinesToInsert.slice(i, i + BATCH),
      });
    }
  }

  // 8. Preparar y crear SalePayments
  const salePaymentsToInsert: any[] = [];
  let totalPagosCreated = 0;
  for (const sale of salesToInsert) {
    const pagos = input.pagosByFolio[sale.folio] || [];
    for (const pago of pagos) {
      salePaymentsToInsert.push({
        saleId: sale.id,
        businessId: input.businessId,
        externalPaymentType: pago.idformadepago || null,
        method: normalizePaymentMethod(pago.idformadepago) || null,
        amountCents: asCents(pago.importe),
        tipCents: asCents(pago.propina),
        reference: pago.referencia || null,
        exchangeRate: asNum(pago.tipodecambio) || 1.0,
        importBatchId: input.batchId,
      });
      totalPagosCreated++;
    }
  }

  if (salePaymentsToInsert.length > 0) {
    const BATCH = 500;
    for (let i = 0; i < salePaymentsToInsert.length; i += BATCH) {
      await prisma.salePayment.createMany({
        data: salePaymentsToInsert.slice(i, i + BATCH),
      });
    }
  }

  return {
    salesCreated: salesToInsert.length,
    salesSkipped,
    salesErrors: lineErrors.length,
    totalLines,
    totalPagos: totalPagosCreated,
    phantoms,
    canceled,
    errors: lineErrors.slice(0, 20),
  };
}

export async function finishVentasImport(input: {
  batchId: string;
  finalStats: {
    salesCreated: number; salesSkipped: number; salesErrors: number;
    totalLines: number; totalPagos: number; phantoms: number; canceled: number;
  };
}) {
  await prisma.importBatch.update({
    where: { id: input.batchId },
    data: {
      successRows: input.finalStats.salesCreated,
      errorRows: input.finalStats.salesErrors,
      status: input.finalStats.salesCreated === 0 ? "FAILED" : "COMPLETED",
      completedAt: new Date(),
      note: `Final: ${input.finalStats.salesCreated} creadas, ${input.finalStats.salesSkipped} duplicados, ${input.finalStats.salesErrors} errores | ${input.finalStats.totalLines} líneas | ${input.finalStats.totalPagos} pagos | ${input.finalStats.phantoms} phantoms | ${input.finalStats.canceled} canceladas`,
    },
  });
  revalidatePath("/app/manager/ops");
  revalidatePath("/app/manager/ops/imports-v2");
  return { ok: true };
}

// ============================================================
// TURNOS — Bulk
// ============================================================
export async function importTurnosV2(input: {
  businessId: string;
  turnos: TurnoJson[];
  filename: string;
}) {
  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");

  const batch = await createBatch(
    input.businessId, input.filename, "SALES",
    input.turnos.length, `Turnos SR (${input.turnos.length})`, me.id as string
  );

  const ids = input.turnos.map(t => t.idturno).filter(Boolean);
  const existing = await prisma.softRestaurantShift.findMany({
    where: { businessId: input.businessId, externalShiftId: { in: ids } },
    select: { id: true, externalShiftId: true },
  });
  const existingByCode = new Map<string, string>(existing.map((e: any) => [e.externalShiftId, e.id]));

  const toCreate: any[] = [];
  const toUpdate: { id: string; data: any }[] = [];
  const errors: any[] = [];

  for (const r of input.turnos) {
    if (!r.idturno) { errors.push({ r, reason: "Sin idturno" }); continue; }
    const data = {
      businessId: input.businessId,
      externalShiftId: r.idturno,
      openedAt: asDate(r.apertura),
      closedAt: asDate(r.cierre),
      cashierName: r.cajero || null,
      station: r.estacion || null,
      fondoCents: asCents(r.fondo),
      cashCents: asCents(r.efectivo),
      cardCents: asCents(r.tarjeta),
      valesCents: asCents(r.vales),
      creditCents: asCents(r.credito),
      importBatchId: batch.id,
    };
    const id = existingByCode.get(r.idturno);
    if (id) toUpdate.push({ id, data });
    else toCreate.push(data);
  }

  let success = 0;
  if (toCreate.length > 0) {
    const c = await prisma.softRestaurantShift.createMany({ data: toCreate, skipDuplicates: true });
    success += c.count;
  }
  if (toUpdate.length > 0) {
    const BATCH = 20;
    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const slice = toUpdate.slice(i, i + BATCH);
      await Promise.all(slice.map(u =>
        prisma.softRestaurantShift.update({ where: { id: u.id }, data: u.data })
      ));
      success += slice.length;
    }
  }

  await finalizeBatch(batch.id, success, errors);
  revalidatePath("/app/manager/ops/imports-v2");
  return { totalTurnos: input.turnos.length, success, errors: errors.length, batchId: batch.id };
}

// ============================================================
// RESET
// ============================================================
export async function resetBusinessSalesV2(input: {
  businessId: string;
  confirmText: string;
}) {
  if (input.confirmText !== "BORRAR VENTAS") throw new Error("Texto incorrecto");
  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");
  if (!["MASTER_ADMIN", "OWNER", "SUPERIOR"].includes(me.role as string)) {
    throw new Error("Sin permisos");
  }
  const business = await prisma.business.findUnique({
    where: { id: input.businessId }, select: { id: true, name: true },
  });
  if (!business) throw new Error("Negocio no encontrado");

  const beforeCount = await prisma.sale.count({ where: { businessId: input.businessId } });
  const beforeAmount = await prisma.sale.aggregate({
    where: { businessId: input.businessId }, _sum: { amountCents: true },
  });
  const beforeLines = await prisma.saleLine.count({ where: { businessId: input.businessId } });
  const deleted = await prisma.sale.deleteMany({ where: { businessId: input.businessId } });

  revalidatePath("/app/manager/ops");
  revalidatePath("/app/manager/ops/imports-v2");

  return {
    businessName: business.name,
    salesDeleted: deleted.count,
    linesDeleted: beforeLines,
    totalAmountDeleted: (beforeAmount._sum.amountCents || 0) / 100,
    beforeCount,
  };
}
