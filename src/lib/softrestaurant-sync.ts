import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

const db = prisma as any;
const EXTERNAL_SOURCE = "softrestaurant";

export type SoftRestaurantCheque = {
  folio: string;
  fecha?: string;
  cierre?: string;
  mesa?: string;
  nopersonas?: string;
  mesero?: string;
  total?: string;
  subtotal?: string;
  descuento?: string;
  propina?: string;
  propinaincluida?: string;
  totalarticulos?: string;
  cancelado?: string;
  razoncancelado?: string;
  numcheque?: string;
  idturno?: string;
  tipodeservicio?: string;
};

export type SoftRestaurantLine = {
  foliodet: string;
  movimiento?: string;
  cantidad?: string;
  claveprod: string;
  precio?: string;
  descuento?: string;
  impuesto?: string;
  preciocatalogo?: string;
  hora?: string;
  modificador?: string;
  idproductocompuesto?: string;
  productocompuestoprincipal?: string;
  comentario?: string;
  estacion?: string;
  idmeseroproducto?: string;
  comanda?: string;
};

export type SoftRestaurantPayment = {
  folio: string;
  idformadepago?: string;
  importe?: string;
  propina?: string;
  tipodecambio?: string;
  referencia?: string;
};

export type SoftRestaurantChunkInput = {
  businessId: string;
  cashpointId: string;
  userId: string;
  importBatchId: string;
  cheques: SoftRestaurantCheque[];
  cheqdetByFolio: Record<string, SoftRestaurantLine[]>;
  pagosByFolio: Record<string, SoftRestaurantPayment[]>;
  canceladosFolios: string[];
};

export type SoftRestaurantChunkResult = {
  salesCreated: number;
  salesUpdated: number;
  salesSkipped: number;
  salesErrors: number;
  linesCreated: number;
  paymentsCreated: number;
  phantomsCreated: number;
  canceledSales: number;
  errors: Array<{ folio: string; message: string }>;
};

function asNum(value?: string | null): number {
  if (!value) return 0;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function asInt(value?: string | null): number {
  if (!value) return 0;
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : 0;
}

function asCents(value?: string | null): number {
  return Math.round(asNum(value) * 100);
}

function asBool(value?: string | null): boolean {
  return value === "true" || value === "1" || value?.toLowerCase() === "yes";
}

function asDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePaymentMethod(value?: string | null): "CASH" | "CARD" | "TRANSFER" | null {
  if (!value) return null;
  const code = value.toUpperCase().trim();

  if (code === "EF" || code.startsWith("EFEC")) return "CASH";

  const cards = [
    "VISA", "MASTER", "MC", "AMEX", "AMERIC", "TARJ", "TC", "TD", "CRED", "DEB",
    "BANCOM", "BANAM", "BBVA", "HSBC", "SANTANDER", "AZTECA", "BANORTE", "SCOTIA",
    "MERCADO", "CLIP", "STRIPE", "VAL", "VALE",
  ];
  if (cards.some((candidate) => code.includes(candidate))) return "CARD";

  const transfers = ["TRANSF", "SPEI", "DEPO", "PAYPAL", "TR", "CR"];
  if (transfers.includes(code) || transfers.some((candidate) => code.includes(candidate))) {
    return "TRANSFER";
  }

  return null;
}

function createImportedId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function getPaymentMethod(payments: SoftRestaurantPayment[]) {
  if (!payments.length) return "CASH" as const;
  const dominant = [...payments].sort((a, b) => asNum(b.importe) - asNum(a.importe))[0];
  return normalizePaymentMethod(dominant?.idformadepago) ?? "CASH";
}

/**
 * Importa un bloque pequeño enviado por el agente local.
 * No usa sesión web: la autorización se resuelve en la ruta API mediante el token del conector.
 * Cada bloque se procesa dentro de una transacción para no dejar ventas sin líneas o pagos.
 */
export async function importSoftRestaurantSalesChunk(
  input: SoftRestaurantChunkInput,
): Promise<SoftRestaurantChunkResult> {
  const errors: Array<{ folio: string; message: string }> = [];
  const cheques = input.cheques.filter((item) => item?.folio?.trim());
  const canceladosSet = new Set(input.canceladosFolios.map((folio) => String(folio).trim()).filter(Boolean));
  const allFolios = Array.from(new Set([
    ...cheques.map((item) => item.folio.trim()),
    ...canceladosSet,
  ]));

  if (allFolios.length === 0) {
    return {
      salesCreated: 0,
      salesUpdated: 0,
      salesSkipped: 0,
      salesErrors: 0,
      linesCreated: 0,
      paymentsCreated: 0,
      phantomsCreated: 0,
      canceledSales: 0,
      errors: [],
    };
  }

  return db.$transaction(async (tx: any) => {
    const existingSales = await tx.sale.findMany({
      where: {
        businessId: input.businessId,
        externalSource: EXTERNAL_SOURCE,
        externalFolio: { in: allFolios },
      },
      select: {
        id: true,
        externalFolio: true,
        isCanceled: true,
      },
    });

    const existingByFolio = new Map<string, { id: string; isCanceled: boolean }>();
    for (const sale of existingSales) {
      if (sale.externalFolio) existingByFolio.set(sale.externalFolio, sale);
    }

    let salesUpdated = 0;
    let canceledSales = 0;

    // Las cancelaciones pueden llegar después de haber importado la venta.
    for (const folio of canceladosSet) {
      const existing = existingByFolio.get(folio);
      if (!existing || existing.isCanceled) continue;
      await tx.sale.update({
        where: { id: existing.id },
        data: {
          isCanceled: true,
          canceledAt: new Date(),
          canceledReason: "Cancelado en SoftRestaurant",
        },
      });
      existing.isCanceled = true;
      salesUpdated += 1;
      canceledSales += 1;
    }

    const chequesToCreate = cheques.filter((cheque) => !existingByFolio.has(cheque.folio.trim()));
    const salesSkipped = cheques.length - chequesToCreate.length;

    const productCodes = new Set<string>();
    for (const cheque of chequesToCreate) {
      const lines = input.cheqdetByFolio[cheque.folio] ?? [];
      for (const line of lines) {
        const code = line.claveprod?.trim();
        if (code) productCodes.add(code);
      }
    }

    const currentItems = productCodes.size
      ? await tx.menuItem.findMany({
          where: {
            businessId: input.businessId,
            externalCode: { in: Array.from(productCodes) },
          },
          select: {
            id: true,
            externalCode: true,
            name: true,
            groupCode: true,
            groupName: true,
          },
        })
      : [];

    const itemByCode = new Map<string, any>();
    for (const item of currentItems) {
      if (item.externalCode) itemByCode.set(item.externalCode, item);
    }

    const missingCodes = Array.from(productCodes).filter((code) => !itemByCode.has(code));
    if (missingCodes.length) {
      const phantomRows = missingCodes.map((code) => {
        let priceCents = 0;
        for (const cheque of chequesToCreate) {
          const line = (input.cheqdetByFolio[cheque.folio] ?? []).find(
            (candidate) => candidate.claveprod?.trim() === code,
          );
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

      await tx.menuItem.createMany({ data: phantomRows, skipDuplicates: true });

      const refreshedItems = await tx.menuItem.findMany({
        where: {
          businessId: input.businessId,
          externalCode: { in: missingCodes },
        },
        select: {
          id: true,
          externalCode: true,
          name: true,
          groupCode: true,
          groupName: true,
        },
      });
      for (const item of refreshedItems) {
        if (item.externalCode && !itemByCode.has(item.externalCode)) {
          itemByCode.set(item.externalCode, item);
        }
      }
    }

    const salesToCreate: Array<{ id: string; folio: string; data: Record<string, unknown> }> = [];

    for (const cheque of chequesToCreate) {
      const folio = cheque.folio.trim();
      try {
        const openedAt = asDate(cheque.fecha);
        const closedAt = asDate(cheque.cierre);
        const isCanceled = asBool(cheque.cancelado) || canceladosSet.has(folio);
        const payments = input.pagosByFolio[folio] ?? [];
        const id = createImportedId("srs");

        salesToCreate.push({
          id,
          folio,
          data: {
            id,
            businessId: input.businessId,
            cashpointId: input.cashpointId,
            userId: input.userId,
            amountCents: asCents(cheque.total),
            method: getPaymentMethod(payments),
            concept: "Venta SoftRestaurant",
            createdAt: closedAt ?? openedAt ?? new Date(),
            mesaName: cheque.mesa?.trim() || null,
            noPersonas: asInt(cheque.nopersonas) || null,
            externalWaiterId: cheque.mesero?.trim() || null,
            externalShiftId: cheque.idturno?.trim() || null,
            openedAt,
            closedAt,
            totalItems: asNum(cheque.totalarticulos) || null,
            subtotalCents: asCents(cheque.subtotal) || null,
            discountCents: asCents(cheque.descuento) || null,
            tipCents: asCents(cheque.propina) || asCents(cheque.propinaincluida) || null,
            isCanceled,
            canceledAt: isCanceled ? closedAt ?? openedAt ?? new Date() : null,
            canceledReason: isCanceled
              ? cheque.razoncancelado?.trim() || "Cancelado en SoftRestaurant"
              : null,
            ticketRef: cheque.numcheque?.trim() || null,
            serviceType: cheque.tipodeservicio?.trim() || null,
            externalSource: EXTERNAL_SOURCE,
            externalFolio: folio,
            importBatchId: input.importBatchId,
          },
        });

        if (isCanceled) canceledSales += 1;
      } catch (error: any) {
        errors.push({ folio, message: error?.message?.slice(0, 240) || "No se pudo preparar la venta" });
      }
    }

    if (salesToCreate.length) {
      await tx.sale.createMany({
        data: salesToCreate.map((sale) => sale.data),
      });
    }

    const linesToCreate: Record<string, unknown>[] = [];
    const paymentsToCreate: Record<string, unknown>[] = [];

    for (const sale of salesToCreate) {
      const lines = input.cheqdetByFolio[sale.folio] ?? [];
      for (const line of lines) {
        const code = line.claveprod?.trim();
        if (!code) continue;
        const item = itemByCode.get(code);
        if (!item) {
          errors.push({ folio: sale.folio, message: `No se pudo resolver el producto ${code}` });
          continue;
        }

        const quantity = asNum(line.cantidad) || 1;
        const unitPriceCents = asCents(line.precio);
        const discountCents = asCents(line.descuento);

        linesToCreate.push({
          saleId: sale.id,
          businessId: input.businessId,
          menuItemId: item.id,
          productCode: code,
          productName: item.name,
          groupCode: item.groupCode || null,
          groupName: item.groupName || null,
          qty: quantity,
          unitPriceCents,
          discountCents,
          taxPercent: asNum(line.impuesto),
          amountCents: Math.round(quantity * (unitPriceCents - discountCents)),
          movimiento: asInt(line.movimiento) || null,
          comanda: line.comanda?.trim() || null,
          comentario: line.comentario?.trim() || null,
          estacion: line.estacion?.trim() || null,
          isModifier: asBool(line.modificador),
          isCompoundChild: Boolean(line.idproductocompuesto?.trim()),
          isCompoundPrincipal: asBool(line.productocompuestoprincipal),
          soldAt: asDate(line.hora),
          externalWaiterId: line.idmeseroproducto?.trim() || null,
          externalSource: EXTERNAL_SOURCE,
          externalFolioDet: line.foliodet?.trim() || null,
          externalMovimiento: asInt(line.movimiento) || null,
          importBatchId: input.importBatchId,
        });
      }

      const payments = input.pagosByFolio[sale.folio] ?? [];
      for (const payment of payments) {
        paymentsToCreate.push({
          saleId: sale.id,
          businessId: input.businessId,
          externalPaymentType: payment.idformadepago?.trim() || null,
          method: normalizePaymentMethod(payment.idformadepago),
          amountCents: asCents(payment.importe),
          tipCents: asCents(payment.propina),
          reference: payment.referencia?.trim() || null,
          exchangeRate: asNum(payment.tipodecambio) || 1,
          importBatchId: input.importBatchId,
        });
      }
    }

    const createInBatches = async (model: any, rows: Record<string, unknown>[]) => {
      const size = 400;
      for (let index = 0; index < rows.length; index += size) {
        await model.createMany({ data: rows.slice(index, index + size) });
      }
    };

    if (linesToCreate.length) await createInBatches(tx.saleLine, linesToCreate);
    if (paymentsToCreate.length) await createInBatches(tx.salePayment, paymentsToCreate);

    return {
      salesCreated: salesToCreate.length,
      salesUpdated,
      salesSkipped,
      salesErrors: errors.length,
      linesCreated: linesToCreate.length,
      paymentsCreated: paymentsToCreate.length,
      phantomsCreated: missingCodes.length,
      canceledSales,
      errors: errors.slice(0, 25),
    } satisfies SoftRestaurantChunkResult;
  }, { maxWait: 10_000, timeout: 45_000 });
}
