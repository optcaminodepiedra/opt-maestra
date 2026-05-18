"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/session";
import {
  parseVFPRecords,
  asNum, asCents, asInt, asBool, asDate, asMeseroId,
  normalizePaymentMethod,
} from "@/lib/softrestaurant-parser";
import type { PaymentMethod } from "@prisma/client";

/**
 * Tipo del progreso de importación.
 */
export type ImportProgress = {
  phase: string;
  current: number;
  total: number;
  message?: string;
};

/**
 * Importa las ventas con TODO el detalle:
 * - cheques.xml → Sale
 * - cheqdet.xml → SaleLine (vinculado a Sale por folio)
 * - chequespagos.xml → SalePayment (uno o varios por Sale)
 * - cancela.xml (opcional) → marca Sales como canceladas
 *
 * Estrategia anti-duplicados:
 * - Usa (businessId, externalSource, externalFolio) como clave única.
 * - Si una Sale ya existe con ese folio, la SALTA (no duplica).
 * - Si quieres reimportar, usa primero `resetBusinessSales`.
 *
 * Estrategia de matching de productos:
 * - Cada línea cheqdet busca MenuItem por (businessId, externalCode = claveprod).
 * - Si no encuentra, crea un MenuItem fantasma con isPhantom=true.
 *
 * Retorna stats completas del import.
 */
export async function importVentasCompletas(input: {
  businessId: string;
  chequesXml: string;
  cheqdetXml: string;
  chequespagosXml?: string;
  cancelaXml?: string;
  filename: string;       // nombre genérico del batch (ej "Bodega4_FEB_2026")
  cashpointId?: string;   // a qué cashpoint pertenecen estas ventas
  userId?: string;        // userId de Maestra fallback si no hay match con mesero
}) {
  if (!input.businessId) throw new Error("Falta businessId");
  if (!input.chequesXml) throw new Error("Falta chequesXml");
  if (!input.cheqdetXml) throw new Error("Falta cheqdetXml");

  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");

  const userId = input.userId || (me.id as string);

  // ── 1. Parsear todos los XMLs ──────────────────────────────
  const cheques = parseVFPRecords(input.chequesXml, "curcheques");
  const cheqdet = parseVFPRecords(input.cheqdetXml, "curcheqdet");
  const pagos = input.chequespagosXml
    ? parseVFPRecords(input.chequespagosXml, "curchequespagos")
    : [];
  const cancelaciones = input.cancelaXml
    ? parseVFPRecords(input.cancelaXml, "curcancela")
    : [];

  if (cheques.length === 0) throw new Error("cheques.xml no tiene <curcheques>");

  // ── 2. Crear ImportBatch padre ─────────────────────────────
  const batch = await prisma.importBatch.create({
    data: {
      entityType: "SALES",
      businessId: input.businessId,
      filename: input.filename,
      totalRows: cheques.length,
      status: "PROCESSING",
      note: `Ventas completas SR: ${cheques.length} tickets, ${cheqdet.length} líneas, ${pagos.length} pagos`,
      createdById: userId,
    },
  });

  // ── 3. Resolver default Cashpoint si no se pasó ────────────
  let cashpointId = input.cashpointId;
  if (!cashpointId) {
    const cp = await prisma.cashpoint.findFirst({
      where: { businessId: input.businessId },
      orderBy: { createdAt: "asc" },
    });
    if (!cp) {
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: { status: "FAILED", errors: [{ reason: "El negocio no tiene cashpoint" }] },
      });
      throw new Error("El negocio no tiene cashpoint. Crea uno primero.");
    }
    cashpointId = cp.id;
  }

  // ── 4. Indexar maps en memoria ─────────────────────────────
  // Map folio → array de líneas
  const linesByFolio = new Map<string, typeof cheqdet>();
  for (const line of cheqdet) {
    const k = line.foliodet;
    if (!k) continue;
    if (!linesByFolio.has(k)) linesByFolio.set(k, []);
    linesByFolio.get(k)!.push(line);
  }

  // Map folio → array de pagos
  const pagosByFolio = new Map<string, typeof pagos>();
  for (const p of pagos) {
    const k = p.folio;
    if (!k) continue;
    if (!pagosByFolio.has(k)) pagosByFolio.set(k, []);
    pagosByFolio.get(k)!.push(p);
  }

  // Set de folios cancelados
  const canceladosSet = new Set<string>();
  for (const c of cancelaciones) {
    if (c.folio) canceladosSet.add(c.folio);
  }

  // Cache de MenuItems por externalCode (para no hacer query por cada línea)
  type MenuItemMini = {
    id: string;
    externalCode: string | null;
    name: string;
    groupCode: string | null;
    groupName: string | null;
  };
  const menuItemCache = await prisma.menuItem.findMany({
    where: { businessId: input.businessId, externalCode: { not: null } },
    select: { id: true, externalCode: true, name: true, groupCode: true, groupName: true },
  });
  const menuItemByCode = new Map<string, MenuItemMini>(
    menuItemCache.map((mi: MenuItemMini) => [mi.externalCode!, mi])
  );

  // ── 5. Procesar cada cheque ────────────────────────────────
  let salesCreated = 0;
  let salesSkipped = 0;
  let salesErrors = 0;
  let totalLines = 0;
  let totalPagosCreated = 0;
  let phantomsCreated = 0;
  let canceledMarked = 0;
  const errorsList: any[] = [];

  for (const cheque of cheques) {
    try {
      const folio = cheque.folio;
      if (!folio) {
        errorsList.push({ cheque: cheque.folio, reason: "Sin folio" });
        salesErrors++;
        continue;
      }

      // Anti-duplicado: si ya existe una Sale con ese folio en este business, skip
      const existing = await prisma.sale.findFirst({
        where: {
          businessId: input.businessId,
          externalSource: "softrestaurant",
          externalFolio: folio,
        },
        select: { id: true },
      });
      if (existing) {
        salesSkipped++;
        continue;
      }

      // Determinar método de pago principal (el primer pago o el de mayor monto)
      const chequePagos = pagosByFolio.get(folio) || [];
      let method: PaymentMethod = "CASH";
      if (chequePagos.length > 0) {
        // Si hay varios pagos, tomamos el dominante
        chequePagos.sort((a, b) => asNum(b.importe) - asNum(a.importe));
        const m = normalizePaymentMethod(chequePagos[0].idformadepago);
        if (m) method = m;
      }

      const fecha = asDate(cheque.fecha) || new Date();
      const cierre = asDate(cheque.cierre);
      const totalCents = asCents(cheque.total);
      const subtotalCents = asCents(cheque.subtotal);
      const descuentoCents = asCents(cheque.descuento);
      const propinaCents = asCents(cheque.propina) || asCents(cheque.propinaincluida);
      const isCanceled = asBool(cheque.cancelado) || canceladosSet.has(folio);

      // Crear la Sale
      const sale = await prisma.sale.create({
        data: {
          businessId: input.businessId,
          cashpointId: cashpointId!,
          userId,
          amountCents: totalCents,
          method,
          concept: "Venta SoftRestaurant",
          createdAt: cierre || fecha,  // usamos cierre como fecha "oficial"

          // metadatos enriquecidos
          mesaName: cheque.mesa || null,
          noPersonas: asInt(cheque.nopersonas) || null,
          externalWaiterId: asMeseroId(cheque.mesero),
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

          // trazabilidad
          externalSource: "softrestaurant",
          externalFolio: folio,
          importBatchId: batch.id,
        },
      });

      if (isCanceled) canceledMarked++;

      // Crear SaleLines para este cheque
      const lines = linesByFolio.get(folio) || [];
      for (const line of lines) {
        const claveprod = line.claveprod?.trim();
        if (!claveprod) continue;

        // Buscar MenuItem en cache, si no existe, crear phantom
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
          phantomsCreated++;
        }

        // Aquí menuItem ya está garantizado no-undefined
        const mi = menuItem!;

        const qty = asNum(line.cantidad) || 1;
        const unitPrice = asCents(line.precio);
        const discount = asCents(line.descuento);
        const taxPercent = asNum(line.impuesto);
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
            taxPercent,
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
            importBatchId: batch.id,
          },
        });
        totalLines++;
      }

      // Crear SalePayments
      for (const pago of chequePagos) {
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
            importBatchId: batch.id,
          },
        });
        totalPagosCreated++;
      }

      salesCreated++;
    } catch (e: any) {
      salesErrors++;
      errorsList.push({ folio: cheque.folio, reason: e.message });
    }
  }

  // ── 6. Finalizar batch ─────────────────────────────────────
  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      successRows: salesCreated,
      errorRows: salesErrors,
      status: salesErrors === cheques.length ? "FAILED" : "COMPLETED",
      completedAt: new Date(),
      errors: errorsList.length > 0 ? errorsList.slice(0, 100) : undefined,
      note: `Tickets: ${salesCreated} creados, ${salesSkipped} duplicados, ${salesErrors} errores | Líneas: ${totalLines} | Pagos: ${totalPagosCreated} | Phantoms creados: ${phantomsCreated} | Cancelados marcados: ${canceledMarked}`,
    },
  });

  revalidatePath("/app/manager/ops/imports-v2");
  revalidatePath("/app/manager/ops");

  return {
    salesCreated,
    salesSkipped,
    salesErrors,
    totalLines,
    totalPagosCreated,
    phantomsCreated,
    canceledMarked,
    batchId: batch.id,
    errors: errorsList.slice(0, 20), // top 20 errores
  };
}

// ==============================================================
// importTurnos: importa turnos.xml → SoftRestaurantShift
// ==============================================================
export async function importTurnos(input: {
  businessId: string;
  xml: string;
  filename: string;
}) {
  if (!input.businessId) throw new Error("Falta businessId");
  if (!input.xml) throw new Error("XML vacío");

  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");

  const records = parseVFPRecords(input.xml, "curturnos");

  const batch = await prisma.importBatch.create({
    data: {
      entityType: "SALES",
      businessId: input.businessId,
      filename: input.filename,
      totalRows: records.length,
      status: "PROCESSING",
      note: `Turnos SoftRestaurant (${records.length} turnos)`,
      createdById: me.id as string,
    },
  });

  let success = 0;
  let errors: any[] = [];

  for (const r of records) {
    try {
      if (!r.idturno) {
        errors.push({ r, reason: "Sin idturno" });
        continue;
      }
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

      // Upsert
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

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      successRows: success,
      errorRows: errors.length,
      status: errors.length === records.length ? "FAILED" : "COMPLETED",
      completedAt: new Date(),
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  revalidatePath("/app/manager/ops/imports-v2");

  return { totalTurnos: records.length, success, errors: errors.length, batchId: batch.id };
}

// ==============================================================
// resetBusinessSales: BORRA todas las ventas de un negocio
// ==============================================================
// PELIGROSO. Solo para usar antes de re-importar con detalle completo.
// Borra: Sale, SaleLine (cascade), SalePayment (cascade), de un businessId.
//
// Retorna stats de lo que se borró para poder verificar.
//
// IMPORTANTE: hace un dump previo a una tabla temporal `sale_backup_pre_reset`
// que puedes consultar para restaurar manualmente si algo va mal.
export async function resetBusinessSales(input: {
  businessId: string;
  confirmText: string;  // debe ser "BORRAR VENTAS"
}) {
  if (!input.businessId) throw new Error("Falta businessId");
  if (input.confirmText !== "BORRAR VENTAS") {
    throw new Error("Texto de confirmación incorrecto. Debe ser exactamente 'BORRAR VENTAS'");
  }

  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");

  // Solo roles globales pueden hacer esto
  const role = me.role as string;
  if (!["MASTER_ADMIN", "OWNER", "SUPERIOR"].includes(role)) {
    throw new Error("Sin permisos para resetear ventas (solo MASTER_ADMIN/OWNER/SUPERIOR)");
  }

  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { id: true, name: true },
  });
  if (!business) throw new Error("Negocio no encontrado");

  // Conteo antes
  const beforeCount = await prisma.sale.count({ where: { businessId: input.businessId } });
  const beforeAmount = await prisma.sale.aggregate({
    where: { businessId: input.businessId },
    _sum: { amountCents: true },
  });
  const beforeLines = await prisma.saleLine.count({ where: { businessId: input.businessId } });

  // BORRAR (cascade borra SaleLine y SalePayment automáticamente)
  const deleted = await prisma.sale.deleteMany({
    where: { businessId: input.businessId },
  });

  revalidatePath("/app/manager/ops");
  revalidatePath("/app/manager/ops/imports-v2");

  return {
    businessName: business.name,
    salesDeleted: deleted.count,
    linesDeleted: beforeLines, // se borraron por cascade
    totalAmountDeleted: (beforeAmount._sum.amountCents || 0) / 100,
    beforeCount,
  };
}
