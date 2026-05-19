// src/app/api/reports/products/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveManagerScope } from "@/lib/manager-scope";
import {
  getTopProducts, getSlowProducts, getNoMovementProducts,
  getGroupMix, getHourlyHeatmap, getTicketStats, getTicketDistribution,
  getDiscountAnalysis, getCatalogHealth, getEventsVsRegular,
} from "@/lib/products-analytics";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const businessId = sp.get("businessId") || undefined;
  const fromDate = sp.get("from") || undefined;
  const toDate = sp.get("to") || undefined;
  const groupCode = sp.get("group") || undefined;

  const filters = {
    businessId,
    fromDate,
    toDate,
    groupCode,
    includeCanceled: false,
  };

  try {
    // Auth check via manager scope
    const scope = await resolveManagerScope();
    if (!scope.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Cargar TODOS los datos en paralelo
    const [top, slow, noMov, mix, heatmap, stats, dist, disc, events, health] = await Promise.all([
      getTopProducts(filters, { limit: 100, sortBy: "revenue" }),
      getSlowProducts(filters, { limit: 50 }),
      getNoMovementProducts(filters),
      getGroupMix(filters),
      getHourlyHeatmap(filters),
      getTicketStats(filters),
      getTicketDistribution(filters),
      getDiscountAnalysis(filters),
      getEventsVsRegular(filters),
      getCatalogHealth(filters),
    ]);

    // Construir Excel
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // Sheet 1: Resumen
    const summary = [
      { Métrica: "Tickets totales", Valor: stats.count },
      { Métrica: "Ingreso total", Valor: stats.totalRevenue },
      { Métrica: "Ticket promedio", Valor: stats.avgTicket },
      { Métrica: "Mediana ticket", Valor: stats.medianTicket },
      { Métrica: "Items por ticket (prom)", Valor: stats.avgItemsPerTicket },
      { Métrica: "Total items", Valor: stats.totalItems },
      { Métrica: "Eventos (tickets)", Valor: events.events.count },
      { Métrica: "Eventos ingreso", Valor: events.events.revenue },
      { Métrica: "Regular (tickets)", Valor: events.regular.count },
      { Métrica: "Regular ingreso", Valor: events.regular.revenue },
      { Métrica: "Tickets con descuento", Valor: disc.salesWithDiscount },
      { Métrica: "$ Descuentos totales (cheque)", Valor: disc.totalDiscountAmount },
      { Métrica: "$ Descuentos líneas", Valor: disc.lineDiscountAmount },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Resumen");

    // Sheet 2: Top productos
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(top.map(t => ({
      Código: t.productCode,
      Producto: t.productName,
      Grupo: t.groupName || "—",
      Cantidad: t.qty,
      Ingreso: t.revenue,
      Tickets: t.timesSold,
      Descuentos: t.discount,
    }))), "Top productos");

    // Sheet 3: Productos lentos
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(slow.map(s => ({
      Código: s.productCode,
      Producto: s.productName,
      Grupo: s.groupName || "—",
      Cantidad: s.qty,
      Ingreso: s.revenue,
      Tickets: s.timesSold,
    }))), "Productos lentos");

    // Sheet 4: Sin movimiento
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(noMov.map(n => ({
      Código: n.productCode,
      Producto: n.productName,
      Grupo: n.groupName || "—",
      "Precio catálogo": n.priceCents / 100,
    }))), "Sin movimiento");

    // Sheet 5: Categorías
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mix.map(m => ({
      Categoría: m.groupName,
      Ingreso: m.revenue,
      "% Total": m.pctOfTotal,
      Cantidad: m.qty,
      Líneas: m.times,
    }))), "Categorías");

    // Sheet 6: Heat map
    const heatRows = heatmap.map(h => ({
      Día: ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][h.dow],
      Hora: `${h.hour}:00`,
      Tickets: h.tickets,
      Ingreso: h.revenue,
      "Promedio ticket": h.avgTicket,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(heatRows), "Hora x día");

    // Sheet 7: Distribución tickets
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dist.map(b => ({
      Rango: b.label,
      Tickets: b.count,
      Ingreso: b.revenue,
    }))), "Distribución tickets");

    // Sheet 8: Top descuentos
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(disc.topDiscountedProducts.map(p => ({
      Código: p.productCode,
      Producto: p.productName,
      "Veces descontado": p.timesDiscounted,
      Unidades: p.qtyDiscounted,
      "$ Descuento": p.totalDiscount,
    }))), "Descuentos");

    // Sheet 9: Catálogo salud
    const healthRows = [
      ...health.phantoms.map(p => ({ Tipo: "Phantom", Código: p.externalCode || "", Nombre: p.name, Precio: p.priceCents/100 })),
      ...health.noPriced.map(p => ({ Tipo: "Sin precio", Código: p.externalCode || "", Nombre: p.name, Precio: 0 })),
      ...health.duplicateNames.map(d => ({ Tipo: "Duplicado", Código: "", Nombre: d.name, Precio: d.count })),
    ];
    if (healthRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(healthRows), "Salud catálogo");
    }

    // Generar buffer
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    const filename = `reportes_productos_${fromDate || "all"}_a_${toDate || "now"}.xlsx`;
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
