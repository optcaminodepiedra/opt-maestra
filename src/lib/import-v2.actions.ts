"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/session";
import type { PaymentMethod } from "@prisma/client";

// ──────────────────────────────────────────────────────────
// Helpers de conversión (inline, sin import circular)
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
// TIPOS de entrada (mismos que client-parser)
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

// ============================================================
// 1. IMPORTAR CATÁLOGOS (chunks pequeños, JSON pre-parseado)
// ============================================================

/** Crea un ImportBatch para una operación de catálogo. */
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
      entityType,
      businessId,
      filename,
      totalRows,
      status: "PROCESSING",
      note,
      createdById: userId,
    },
  });
}

/** Marca un batch como completado */
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

// ---- importGruposV2 ----
export async function importGruposV2(input: {
  businessId: string;
  grupos: GrupoJson[];
  filename: string;
}) {
  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");
  if (!input.businessId) throw new Error("Falta businessId");

  const batch = await createBatch(
    input.businessId, input.filename, "MENU_ITEMS",
    input.grupos.length, `Grupos SR (${input.grupos.length})`, me.id as string
  );

  // Grupos solo se "registran" — sus nombres se aplican al importar productos
  await finalizeBatch(batch.id, input.grupos.length, []);
  revalidatePath("/app/manager/ops/imports-v2");
  return { totalGrupos: input.grupos.length, batchId: batch.id };
}

// ---- importProductosV2 ----
export async function importProductosV2(input: {
  businessId: string;
  productos: ProductoJson[];
  grupos: GrupoJson[];
  filename: string;
}) {
  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");
  if (!input.businessId) throw new Error("Falta businessId");

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

  let created = 0, updated = 0;
  const errors: any[] = [];

  // Procesar en chunks de 100
  const CHUNK = 100;
  for (let i = 0; i < input.productos.length; i += CHUNK) {
    const chunk = input.productos.slice(i, i + CHUNK);
    for (const p of chunk) {
      try {
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
        const existing = await prisma.menuItem.findFirst({
          where: { businessId: input.businessId, externalCode: p.clave },
        });
        if (existing) {
          await prisma.menuItem.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await prisma.menuItem.create({ data });
          created++;
        }
      } catch (e: any) {
        errors.push({ clave: p.clave, reason: e.message });
      }
    }
  }

  await finalizeBatch(batch.id, created + updated, errors);
  revalidatePath("/app/manager/ops/imports-v2");
  return { totalProductos: input.productos.length, created, updated, errors: errors.length, batchId: batch.id };
}

// ---- importMeserosV2 ----
export async function importMeserosV2(input: {
  businessId: string;
  meseros: MeseroJson[];
  filename: string;
}) {
  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");
  if (!input.businessId) throw new Error("Falta businessId");

  const batch = await createBatch(
    input.businessId, input.filename, "EMPLOYEES",
    input.meseros.length, `Meseros SR (${input.meseros.length})`, me.id as string
  );

  let success = 0;
  const errors: any[] = [];
  for (const m of input.meseros) {
    try {
      if (!m.clave) { errors.push({ m, reason: "Sin clave" }); continue; }
      const existing = await prisma.externalUserMapping.findUnique({
        where: {
          businessId_externalSource_externalUserId_kind: {
            businessId: input.businessId,
            externalSource: "softrestaurant",
            externalUserId: m.clave,
            kind: "WAITER",
          },
        },
      });
      if (existing) {
        await prisma.externalUserMapping.update({
          where: { id: existing.id },
          data: { externalUserName: m.nombre || null },
        });
      } else {
        await prisma.externalUserMapping.create({
          data: {
            businessId: input.businessId,
            externalSource: "softrestaurant",
            externalUserId: m.clave,
            externalUserName: m.nombre || null,
            kind: "WAITER",
          },
        });
      }
      success++;
    } catch (e: any) {
      errors.push({ m, reason: e.message });
    }
  }
  await finalizeBatch(batch.id, success, errors);
  revalidatePath("/app/manager/ops/imports-v2");
  return { totalMeseros: input.meseros.length, success, errors: errors.length, batchId: batch.id };
}

// ============================================================
// 2. IMPORTAR VENTAS (en chunks, con sesión persistente)
// ============================================================

// Se hace en 3 fases sucesivas (cada una su propia llamada):
//
// Fase A: startImport — crea el batch padre y devuelve batchId
// Fase B: importChequesChunk — recibe chunk de N cheques+sus_lineas+sus_pagos
// Fase C: finishImport — finaliza el batch y devuelve stats finales

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
  if (!input.businessId) throw new Error("Falta businessId");

  // Resolver cashpoint
  let cashpointId = input.cashpointId;
  if (!cashpointId) {
    const cp = await prisma.cashpoint.findFirst({
      where: { businessId: input.businessId },
      orderBy: { createdAt: "asc" },
    });
    if (!cp) throw new Error("El negocio no tiene cashpoint. Crea uno primero.");
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

// Chunk de cheques con sus líneas y pagos correspondientes
export type ChunkInput = {
  businessId: string;
  batchId: string;
  cashpointId: string;
  userId: string;
  cheques: ChequeJson[];
  // Solo se pasan líneas/pagos cuyo folio esté en este chunk
  cheqdetByFolio: Record<string, CheqdetJson[]>;
  pagosByFolio: Record<string, ChequePagoJson[]>;
  canceladosFolios: string[];
};

export async function importChequesChunk(input: ChunkInput) {
  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");
  if (!input.businessId || !input.batchId) throw new Error("Falta batchId");

  const userId = input.userId || (me.id as string);
  const canceladosSet = new Set(input.canceladosFolios);

  // Cache de MenuItems por externalCode (lo cargamos cada chunk porque el cache no persiste entre llamadas)
  type MenuItemMini = {
    id: string; externalCode: string | null; name: string;
    groupCode: string | null; groupName: string | null;
  };
  const menuItemCache = await prisma.menuItem.findMany({
    where: { businessId: input.businessId, externalCode: { not: null } },
    select: { id: true, externalCode: true, name: true, groupCode: true, groupName: true },
  });
  const menuItemByCode = new Map<string, MenuItemMini>(
    menuItemCache.map((mi: MenuItemMini) => [mi.externalCode!, mi])
  );

  let salesCreated = 0;
  let salesSkipped = 0;
  let salesErrors = 0;
  let totalLines = 0;
  let totalPagos = 0;
  let phantoms = 0;
  let canceled = 0;
  const errors: any[] = [];

  for (const cheque of input.cheques) {
    try {
      const folio = cheque.folio;
      if (!folio) { salesErrors++; continue; }

      // Anti-duplicado
      const existing = await prisma.sale.findFirst({
        where: {
          businessId: input.businessId,
          externalSource: "softrestaurant",
          externalFolio: folio,
        },
        select: { id: true },
      });
      if (existing) { salesSkipped++; continue; }

      // Método dominante
      const pagos = input.pagosByFolio[folio] || [];
      let method: PaymentMethod = "CASH";
      if (pagos.length > 0) {
        pagos.sort((a, b) => asNum(b.importe) - asNum(a.importe));
        const m = normalizePaymentMethod(pagos[0].idformadepago);
        if (m) method = m;
      }

      const fecha = asDate(cheque.fecha) || new Date();
      const cierre = asDate(cheque.cierre);
      const totalCents = asCents(cheque.total);
      const subtotalCents = asCents(cheque.subtotal);
      const descuentoCents = asCents(cheque.descuento);
      const propinaCents = asCents(cheque.propina) || asCents(cheque.propinaincluida);
      const isCanceled = asBool(cheque.cancelado) || canceladosSet.has(folio);
      if (isCanceled) canceled++;

      const sale = await prisma.sale.create({
        data: {
          businessId: input.businessId,
          cashpointId: input.cashpointId,
          userId,
          amountCents: totalCents,
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
          subtotalCents: subtotalCents || null,
          discountCents: descuentoCents || null,
          tipCents: propinaCents || null,
          isCanceled,
          canceledReason: cheque.razoncancelado || null,
          ticketRef: cheque.numcheque || null,
          serviceType: cheque.tipodeservicio || null,
          externalSource: "softrestaurant",
          externalFolio: folio,
          importBatchId: input.batchId,
        },
      });

      // Líneas
      const lines = input.cheqdetByFolio[folio] || [];
      for (const line of lines) {
        const claveprod = line.claveprod?.trim();
        if (!claveprod) continue;
        let menuItem: MenuItemMini | undefined = menuItemByCode.get(claveprod);
        if (!menuItem) {
          const phantom = await prisma.menuItem.create({
            data: {
              businessId: input.businessId,
              name: `[?] Producto ${claveprod}`,
              category: "Sin catálogo",
              priceCents: asCents(line.preciocatalogo) || asCents(line.precio),
              isActive: true,
              externalCode: claveprod,
              isPhantom: true,
            },
            select: { id: true, externalCode: true, name: true, groupCode: true, groupName: true },
          });
          menuItem = phantom;
          menuItemByCode.set(claveprod, phantom);
          phantoms++;
        }
        const mi = menuItem!;
        const qty = asNum(line.cantidad) || 1;
        const unitPrice = asCents(line.precio);
        const discount = asCents(line.descuento);
        const amountCents = Math.round(qty * (unitPrice - discount));
        await prisma.saleLine.create({
          data: {
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
          },
        });
        totalLines++;
      }

      // Pagos
      for (const pago of pagos) {
        await prisma.salePayment.create({
          data: {
            saleId: sale.id,
            businessId: input.businessId,
            externalPaymentType: pago.idformadepago || null,
            method: normalizePaymentMethod(pago.idformadepago) || null,
            amountCents: asCents(pago.importe),
            tipCents: asCents(pago.propina),
            reference: pago.referencia || null,
            exchangeRate: asNum(pago.tipodecambio) || 1.0,
            importBatchId: input.batchId,
          },
        });
        totalPagos++;
      }

      salesCreated++;
    } catch (e: any) {
      salesErrors++;
      errors.push({ folio: cheque.folio, reason: e.message?.slice(0, 200) });
    }
  }

  return {
    salesCreated, salesSkipped, salesErrors,
    totalLines, totalPagos, phantoms, canceled,
    errors: errors.slice(0, 20),
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
// 3. IMPORTAR TURNOS
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

  let success = 0;
  const errors: any[] = [];
  for (const r of input.turnos) {
    try {
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
      const existing = await prisma.softRestaurantShift.findUnique({
        where: { businessId_externalShiftId: { businessId: input.businessId, externalShiftId: r.idturno } },
      });
      if (existing) {
        await prisma.softRestaurantShift.update({ where: { id: existing.id }, data });
      } else {
        await prisma.softRestaurantShift.create({ data });
      }
      success++;
    } catch (e: any) {
      errors.push({ r, reason: e.message });
    }
  }
  await finalizeBatch(batch.id, success, errors);
  revalidatePath("/app/manager/ops/imports-v2");
  return { totalTurnos: input.turnos.length, success, errors: errors.length, batchId: batch.id };
}

// ============================================================
// 4. RESET (mismo que antes, solo lo mantenemos por completitud)
// ============================================================
export async function resetBusinessSalesV2(input: {
  businessId: string;
  confirmText: string;
}) {
  if (input.confirmText !== "BORRAR VENTAS") {
    throw new Error("Texto de confirmación incorrecto");
  }
  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");
  const role = me.role as string;
  if (!["MASTER_ADMIN", "OWNER", "SUPERIOR"].includes(role)) {
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
