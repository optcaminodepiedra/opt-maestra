"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveManagerScope } from "@/lib/manager-scope";
import { resolveAnalyticsFilters } from "@/lib/analytics-filters";
import {
  getKpis, getSalesByMethod, getExpensesByCategory, getAnalyticsByBusiness,
} from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

/**
 * Genera un archivo Excel con múltiples hojas:
 *  - Resumen (KPIs)
 *  - Ventas (todas las del período)
 *  - Gastos (todos)
 *  - Por negocio
 *  - Por método de pago
 *  - Por categoría de gasto
 *
 * Devuelve base64 listo para descarga.
 */
export async function exportToExcel(searchParams: Record<string, string | undefined>) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("No autorizado");

  const scope = await resolveManagerScope();
  const filters = resolveAnalyticsFilters(searchParams, scope.businessIds);

  const businessesMap = new Map(scope.businesses.map((b) => [b.id, b.name]));

  // Cargar todo en paralelo
  const [kpis, sales, expenses, byMethod, byCategory, byBusiness] = await Promise.all([
    getKpis(filters.selectedBusinessIds, filters.range),
    prisma.sale.findMany({
      where: {
        businessId: { in: filters.selectedBusinessIds },
        createdAt: { gte: filters.range.from, lt: filters.range.to },
      },
      include: {
        business: { select: { name: true } },
        user: { select: { fullName: true } },
        cashpoint: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    }),
    prisma.expense.findMany({
      where: {
        businessId: { in: filters.selectedBusinessIds },
        createdAt: { gte: filters.range.from, lt: filters.range.to },
      },
      include: {
        business: { select: { name: true } },
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    }),
    getSalesByMethod(filters.selectedBusinessIds, filters.range),
    getExpensesByCategory(filters.selectedBusinessIds, filters.range),
    getAnalyticsByBusiness(filters.selectedBusinessIds, businessesMap, filters.range),
  ]);

  // Import dinámico para que no se incluya en bundle del cliente
  const XLSX = await import("xlsx");

  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen
  const resumen = [
    ["Reporte financiero"],
    [],
    ["Período", filters.range.label],
    ["Desde", filters.range.from.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })],
    ["Hasta", new Date(filters.range.to.getTime() - 86400000).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })],
    ["Negocios", filters.selectedBusinessIds.length === scope.businessIds.length ? "Todos" : filters.selectedBusinessIds.map((id) => businessesMap.get(id)).join(", ")],
    [],
    ["Métrica", "Valor"],
    ["Ventas totales", kpis.salesTotal / 100],
    ["Cantidad de ventas", kpis.salesCount],
    ["Ticket promedio", kpis.avgTicket / 100],
    ["Gastos totales", kpis.expensesTotal / 100],
    ["Retiros aprobados", kpis.withdrawalsTotal / 100],
    ["Neto (Ventas − Gastos)", kpis.netTotal / 100],
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  // Hoja 2: Ventas
  if (sales.length > 0) {
    const ventasData = [
      ["Fecha", "Hora", "Concepto", "Método", "Monto", "Negocio", "Caja", "Usuario"],
      ...sales.map((s) => {
        const d = new Date(s.createdAt);
        return [
          d.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" }),
          d.toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" }),
          s.concept,
          s.method === "CASH" ? "Efectivo" : s.method === "CARD" ? "Tarjeta" : "Transferencia",
          s.amountCents / 100,
          s.business.name,
          s.cashpoint.name,
          s.user.fullName,
        ];
      }),
    ];
    const wsVentas = XLSX.utils.aoa_to_sheet(ventasData);
    XLSX.utils.book_append_sheet(wb, wsVentas, "Ventas");
  }

  // Hoja 3: Gastos
  if (expenses.length > 0) {
    const gastosData = [
      ["Fecha", "Categoría", "Nota", "Monto", "Negocio", "Usuario"],
      ...expenses.map((e) => {
        const d = new Date(e.createdAt);
        return [
          d.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" }),
          e.category,
          e.note ?? "",
          e.amountCents / 100,
          e.business.name,
          e.user.fullName,
        ];
      }),
    ];
    const wsGastos = XLSX.utils.aoa_to_sheet(gastosData);
    XLSX.utils.book_append_sheet(wb, wsGastos, "Gastos");
  }

  // Hoja 4: Por negocio
  if (byBusiness.length > 0) {
    const bizData = [
      ["Negocio", "Ventas", "Cantidad", "Gastos", "Neto"],
      ...byBusiness.map((b) => [b.businessName, b.salesTotal / 100, b.salesCount, b.expensesTotal / 100, b.netTotal / 100]),
    ];
    const wsBiz = XLSX.utils.aoa_to_sheet(bizData);
    XLSX.utils.book_append_sheet(wb, wsBiz, "Por negocio");
  }

  // Hoja 5: Por método de pago
  if (byMethod.length > 0) {
    const methodData = [
      ["Método", "Total", "Tickets", "% del total"],
      ...byMethod.map((m) => [m.label, m.value / 100, m.count ?? 0, m.pct.toFixed(1) + "%"]),
    ];
    const wsMethod = XLSX.utils.aoa_to_sheet(methodData);
    XLSX.utils.book_append_sheet(wb, wsMethod, "Por método pago");
  }

  // Hoja 6: Por categoría de gasto
  if (byCategory.length > 0) {
    const catData = [
      ["Categoría", "Total", "Cantidad", "% del total"],
      ...byCategory.map((c) => [c.label, c.value / 100, c.count ?? 0, c.pct.toFixed(1) + "%"]),
    ];
    const wsCat = XLSX.utils.aoa_to_sheet(catData);
    XLSX.utils.book_append_sheet(wb, wsCat, "Por categoría");
  }

  // Generar buffer
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const base64 = Buffer.from(buffer).toString("base64");

  return {
    base64,
    filename: `reporte-${filters.range.label.replace(/\s+/g, "-")}-${Date.now()}.xlsx`,
  };
}
