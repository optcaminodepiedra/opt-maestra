import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTION_LABELS, SEVERITY_LABELS, ACTION_CATEGORIES } from "@/lib/audit-actions";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role as string;
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const preset = sp.get("preset") ?? "today";
  const now = new Date();
  let from: Date, to: Date;

  switch (preset) {
    case "today": from = new Date(now); from.setHours(0,0,0,0); to = new Date(now); to.setHours(23,59,59,999); break;
    case "yesterday": from = new Date(now); from.setDate(now.getDate()-1); from.setHours(0,0,0,0); to = new Date(from); to.setHours(23,59,59,999); break;
    case "last7days": from = new Date(now); from.setDate(now.getDate()-7); from.setHours(0,0,0,0); to = new Date(now); to.setHours(23,59,59,999); break;
    case "last30days": from = new Date(now); from.setDate(now.getDate()-30); from.setHours(0,0,0,0); to = new Date(now); to.setHours(23,59,59,999); break;
    case "thismonth": from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now); to.setHours(23,59,59,999); break;
    case "custom": {
      from = sp.get("from") ? new Date(sp.get("from") + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1);
      to = sp.get("to") ? new Date(sp.get("to") + "T23:59:59") : new Date(now);
      break;
    }
    default: from = new Date(now); from.setHours(0,0,0,0); to = new Date(now); to.setHours(23,59,59,999);
  }

  // Filtros
  const where: any = { createdAt: { gte: from, lt: to } };
  if (sp.get("userId")) where.userId = sp.get("userId");
  if (sp.get("businessId")) where.businessId = sp.get("businessId");
  if (sp.get("severity")) where.severity = sp.get("severity");
  if (sp.get("action")) where.action = sp.get("action");
  if (sp.get("category")) {
    const cat = sp.get("category")!;
    if (ACTION_CATEGORIES[cat]) where.action = { in: ACTION_CATEGORIES[cat] };
  }
  if (sp.get("search")) {
    const q = sp.get("search")!;
    where.OR = [
      { summary: { contains: q, mode: "insensitive" } },
      { userName: { contains: q, mode: "insensitive" } },
      { action: { contains: q, mode: "insensitive" } },
    ];
  }

  // Cargar eventos (limitar a 10k para no explotar memoria)
  const events = await (prisma as any).auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  const businesses = await prisma.business.findMany({ select: { id: true, name: true } });
  const businessMap = new Map(businesses.map((b: { id: string; name: string }) => [b.id, b.name]));

  // Generar xlsx
  const xlsx: any = await import("xlsx");

  const wb = xlsx.utils.book_new();

  // Hoja 1: Resumen
  const totalActions = events.length;
  const byUser = new Map<string, number>();
  const byAction = new Map<string, number>();
  const bySeverity = new Map<string, number>();
  for (const e of events) {
    byUser.set(e.userName, (byUser.get(e.userName) ?? 0) + 1);
    byAction.set(e.action, (byAction.get(e.action) ?? 0) + 1);
    bySeverity.set(e.severity, (bySeverity.get(e.severity) ?? 0) + 1);
  }

  const summaryData = [
    ["Historial de movimientos - Resumen"],
    [],
    ["Periodo desde", from.toLocaleString("es-MX")],
    ["Periodo hasta", to.toLocaleString("es-MX")],
    ["Total acciones", totalActions],
    ["Usuarios únicos", byUser.size],
    [],
    ["Por severidad"],
    ["Severidad", "Cantidad"],
    ...Array.from(bySeverity.entries()).map(([s, c]) => [SEVERITY_LABELS[s] ?? s, c]),
    [],
    ["Por usuario"],
    ["Usuario", "Cantidad"],
    ...Array.from(byUser.entries()).sort(([, a], [, b]) => b - a).map(([u, c]) => [u, c]),
    [],
    ["Por acción"],
    ["Acción", "Cantidad"],
    ...Array.from(byAction.entries()).sort(([, a], [, b]) => b - a).map(([a, c]) => [ACTION_LABELS[a] ?? a, c]),
  ];
  const wsSummary = xlsx.utils.aoa_to_sheet(summaryData);
  xlsx.utils.book_append_sheet(wb, wsSummary, "Resumen");

  // Hoja 2: Eventos detallados
  const eventsData = [
    ["Fecha", "Usuario", "Rol", "Negocio", "Acción", "Severidad", "Entidad", "Resumen", "IP", "Navegador", "Metadata"],
    ...events.map((e: any) => [
      e.createdAt.toLocaleString("es-MX"),
      e.userName,
      e.userRole ?? "",
      e.businessId ? (businessMap.get(e.businessId) ?? e.businessId) : "",
      ACTION_LABELS[e.action] ?? e.action,
      SEVERITY_LABELS[e.severity] ?? e.severity,
      e.entity + (e.entityId ? ` #${e.entityId.slice(-8)}` : ""),
      e.summary,
      e.ipAddress ?? "",
      e.userAgent ?? "",
      e.metadata ? JSON.stringify(e.metadata) : "",
    ]),
  ];
  const wsEvents = xlsx.utils.aoa_to_sheet(eventsData);
  xlsx.utils.book_append_sheet(wb, wsEvents, "Eventos");

  const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  const fileName = `historial_movimientos_${from.toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
