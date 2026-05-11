"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { userCanAccessBusiness } from "@/lib/restaurant-resolve";
import {
  buildCustomerReceipt,
  buildKitchenTicket,
  type ReceiptData,
  type KitchenTicketData,
} from "@/lib/escpos";

/**
 * Crea PrintJobs para una orden cuando se envía a cocina.
 * Genera comandas separadas para KITCHEN y BAR según los items.
 */
export async function createKitchenPrintJobs(orderId: string): Promise<void> {
  const order = await prisma.restaurantOrder.findUnique({
    where: { id: orderId },
    include: {
      business: {
        select: { id: true, name: true },
      },
      table: { select: { name: true, area: true } },
      user: { select: { fullName: true } },
      items: {
        where: { kitchenStatus: "PREPARING" }, // solo los recién enviados
        include: {
          menuItem: { select: { name: true, station: true } as any },
        },
      },
    },
  });

  if (!order) return;

  const tableName = order.table?.name ?? "?";
  const tableArea = order.table?.area ?? null;
  const mesero = order.user?.fullName ?? "?";
  const orderShort = order.id.slice(-6).toUpperCase();

  // Separar items por estación
  const kitchenItems = order.items.filter(
    (i) => (i.menuItem as any).station === "KITCHEN"
  );
  const barItems = order.items.filter(
    (i) => (i.menuItem as any).station === "BAR"
  );

  // ─── PrintJob KITCHEN ────────────────────────────────────────
  if (kitchenItems.length > 0) {
    const kitchenPrinter = await prisma.printer.findFirst({
      where: { businessId: order.businessId, role: "KITCHEN", isActive: true },
    });

    const data: KitchenTicketData = {
      station: "KITCHEN",
      businessName: order.business.name,
      tableName,
      tableArea,
      mesero,
      orderId: order.id,
      orderShort,
      timestamp: new Date(),
      orderNote: order.note,
      items: kitchenItems.map((i) => ({
        qty: i.qty,
        name: (i.menuItem as any).name,
        note: i.note,
      })),
    };

    const bytes = buildKitchenTicket(data);

    await prisma.printJob.create({
      data: {
        businessId: order.businessId,
        printerId: kitchenPrinter?.id ?? null,
        type: "KITCHEN_TICKET",
        status: "PENDING",
        orderId: order.id,
        payload: data as any,
        rawBytes: bytes.toString("base64"),
      },
    });
  }

  // ─── PrintJob BAR ────────────────────────────────────────────
  if (barItems.length > 0) {
    const barPrinter = await prisma.printer.findFirst({
      where: { businessId: order.businessId, role: "BAR", isActive: true },
    });

    const data: KitchenTicketData = {
      station: "BAR",
      businessName: order.business.name,
      tableName,
      tableArea,
      mesero,
      orderId: order.id,
      orderShort,
      timestamp: new Date(),
      orderNote: order.note,
      items: barItems.map((i) => ({
        qty: i.qty,
        name: (i.menuItem as any).name,
        note: i.note,
      })),
    };

    const bytes = buildKitchenTicket(data);

    await prisma.printJob.create({
      data: {
        businessId: order.businessId,
        printerId: barPrinter?.id ?? null,
        type: "BAR_TICKET",
        status: "PENDING",
        orderId: order.id,
        payload: data as any,
        rawBytes: bytes.toString("base64"),
      },
    });
  }
}

/**
 * Crea PrintJob para ticket de cliente cuando se cobra.
 */
export async function createCustomerReceiptPrintJob(input: {
  orderId: string;
  saleId: string;
  tipCents: number;
  paymentMethod: "CASH" | "CARD" | "TRANSFER";
}): Promise<void> {
  const order = await prisma.restaurantOrder.findUnique({
    where: { id: input.orderId },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          ticketHeader: true as any,
          ticketTagline: true as any,
          ticketFooter: true as any,
          ticketPhone: true as any,
          ticketAddress: true as any,
          ticketWebsite: true as any,
        } as any,
      },
      table: { select: { name: true } },
      user: { select: { fullName: true } },
      items: {
        include: {
          menuItem: { select: { name: true } },
        },
      },
    },
  });

  if (!order) return;

  const sale = await prisma.sale.findUnique({
    where: { id: input.saleId },
    select: { id: true, createdAt: true },
  });
  if (!sale) return;

  const cashierPrinter = await prisma.printer.findFirst({
    where: { businessId: order.businessId, role: "CASHIER", isActive: true },
  });

  const subtotal = order.items.reduce((s, i) => s + i.qty * i.priceCents, 0);

  // Generar número de ticket corto del saleId
  const ticketNumber = sale.id.slice(-4).toUpperCase();

  const business = order.business as any;

  const data: ReceiptData = {
    businessName: business.ticketHeader ?? business.name,
    tagline: business.ticketTagline ?? undefined,
    phone: business.ticketPhone ?? undefined,
    address: business.ticketAddress ?? undefined,
    website: business.ticketWebsite ?? undefined,
    footer: business.ticketFooter ?? "Gracias por su visita",
    saleId: sale.id,
    ticketNumber,
    date: sale.createdAt,
    mesero: order.user?.fullName ?? "?",
    tableName: order.table?.name ?? "?",
    items: order.items.map((i) => ({
      qty: i.qty,
      name: i.menuItem.name,
      note: i.note,
      priceCents: i.priceCents,
      subtotalCents: i.qty * i.priceCents,
    })),
    subtotalCents: subtotal,
    tipCents: input.tipCents,
    totalCents: subtotal + input.tipCents,
    paymentMethod: input.paymentMethod,
    qrUrl: business.ticketWebsite ? `https://${business.ticketWebsite}` : undefined,
  };

  const bytes = buildCustomerReceipt(data);

  await prisma.printJob.create({
    data: {
      businessId: order.businessId,
      printerId: cashierPrinter?.id ?? null,
      type: "CUSTOMER_RECEIPT",
      status: "PENDING",
      orderId: order.id,
      saleId: sale.id,
      payload: data as any,
      rawBytes: bytes.toString("base64"),
    },
  });
}

/**
 * Lista PrintJobs recientes (para admin).
 */
export async function listRecentPrintJobs(businessId: string, limit: number = 50) {
  const me = await getMe();
  const role = (me as any).role as string;
  const ok = await userCanAccessBusiness((me as any).id, role, businessId);
  if (!ok) throw new Error("Sin acceso");

  return prisma.printJob.findMany({
    where: { businessId },
    include: {
      printer: { select: { name: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Re-encola un PrintJob fallido.
 */
export async function retryPrintJob(printJobId: string) {
  const me = await getMe();
  const role = (me as any).role as string;

  const job = await prisma.printJob.findUnique({
    where: { id: printJobId },
    select: { businessId: true, status: true },
  });
  if (!job) throw new Error("Trabajo no encontrado");

  const ok = await userCanAccessBusiness((me as any).id, role, job.businessId);
  if (!ok) throw new Error("Sin acceso");

  await prisma.printJob.update({
    where: { id: printJobId },
    data: {
      status: "PENDING",
      claimedAt: null,
      lastError: null,
    },
  });

  revalidatePath("/app/admin/printers");
  return { ok: true };
}

/**
 * Vista previa de un ticket SIN imprimir.
 * Útil para que veas cómo va a quedar antes de configurar la impresora.
 */
export async function getPreviewReceipt(orderId: string): Promise<{
  bytes: string; // base64
  asText: string; // representación texto para preview
}> {
  const order = await prisma.restaurantOrder.findUnique({
    where: { id: orderId },
    include: {
      business: { select: {
        name: true, ticketHeader: true, ticketTagline: true, ticketFooter: true,
        ticketPhone: true, ticketAddress: true, ticketWebsite: true,
      } as any },
      table: { select: { name: true } },
      user: { select: { fullName: true } },
      items: { include: { menuItem: { select: { name: true } } } },
    },
  });

  if (!order) throw new Error("Orden no encontrada");

  const subtotal = order.items.reduce((s, i) => s + i.qty * i.priceCents, 0);
  const business = order.business as any;

  const data: ReceiptData = {
    businessName: business.ticketHeader ?? business.name,
    tagline: business.ticketTagline ?? undefined,
    phone: business.ticketPhone ?? undefined,
    address: business.ticketAddress ?? undefined,
    website: business.ticketWebsite ?? undefined,
    footer: business.ticketFooter ?? "Gracias por su visita",
    saleId: "preview",
    ticketNumber: "PREV",
    date: new Date(),
    mesero: order.user?.fullName ?? "?",
    tableName: order.table?.name ?? "?",
    items: order.items.map((i) => ({
      qty: i.qty,
      name: i.menuItem.name,
      note: i.note,
      priceCents: i.priceCents,
      subtotalCents: i.qty * i.priceCents,
    })),
    subtotalCents: subtotal,
    tipCents: 0,
    totalCents: subtotal,
    paymentMethod: "CASH",
    qrUrl: business.ticketWebsite ? `https://${business.ticketWebsite}` : undefined,
  };

  const bytes = buildCustomerReceipt(data);

  return {
    bytes: bytes.toString("base64"),
    asText: renderTicketAsText(data),
  };
}

/**
 * Renderiza un ticket como texto plano para vista previa.
 */
function renderTicketAsText(data: ReceiptData): string {
  const W = 48;
  const lines: string[] = [];
  const center = (s: string) => {
    const pad = Math.max(0, Math.floor((W - s.length) / 2));
    return " ".repeat(pad) + s;
  };
  const twoCol = (l: string, r: string) => {
    const space = Math.max(1, W - l.length - r.length);
    return l + " ".repeat(space) + r;
  };
  const fmt = (c: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c / 100);

  lines.push(center("================================================="));
  lines.push(center(data.businessName));
  if (data.tagline) lines.push(center(data.tagline));
  if (data.address) lines.push(center(data.address));
  if (data.phone) lines.push(center(`Tel: ${data.phone}`));
  if (data.website) lines.push(center(data.website));
  lines.push("=".repeat(W));
  lines.push(twoCol("Ticket:", `#${data.ticketNumber}`));
  lines.push(twoCol("Fecha:", new Date(data.date).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })));
  lines.push(twoCol("Mesa:", data.tableName));
  lines.push(twoCol("Atendió:", data.mesero));
  lines.push("-".repeat(W));
  lines.push(twoCol("Producto", "Importe"));
  lines.push("-".repeat(W));
  for (const item of data.items) {
    const qtyStr = `${item.qty}x `;
    const price = fmt(item.subtotalCents);
    const maxName = W - qtyStr.length - price.length - 1;
    const name = item.name.length > maxName ? item.name.slice(0, maxName - 1) + "…" : item.name;
    const space = W - qtyStr.length - name.length - price.length;
    lines.push(qtyStr + name + " ".repeat(Math.max(1, space)) + price);
    if (item.note) lines.push(`   * ${item.note}`);
  }
  lines.push("-".repeat(W));
  lines.push(twoCol("Subtotal:", fmt(data.subtotalCents)));
  if (data.tipCents && data.tipCents > 0) lines.push(twoCol("Propina:", fmt(data.tipCents)));
  lines.push(twoCol("TOTAL:", fmt(data.totalCents)));
  lines.push(twoCol("Pago:", { CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Otro" }[data.paymentMethod]));

  if (!data.tipCents || data.tipCents === 0) {
    lines.push("-".repeat(W));
    lines.push(center("Propina sugerida"));
    lines.push(twoCol("  10%:", fmt(Math.round(data.subtotalCents * 0.10))));
    lines.push(twoCol("  15%:", fmt(Math.round(data.subtotalCents * 0.15))));
    lines.push(twoCol("  20%:", fmt(Math.round(data.subtotalCents * 0.20))));
  }

  lines.push("=".repeat(W));
  if (data.qrUrl) {
    lines.push(center("[ QR ]"));
    lines.push(center(data.qrUrl));
  }
  if (data.footer) lines.push(center(data.footer));
  lines.push(center("¡Te esperamos pronto!"));
  return lines.join("\n");
}
