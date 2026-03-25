import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ExportView from "./ExportView";

export default async function ExportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // Traer todos los movimientos del mes actual
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: startOfMonth } },
    include: { business: true, user: true },
    orderBy: { createdAt: "desc" }
  });

  const expenses = await prisma.expense.findMany({
    where: { createdAt: { gte: startOfMonth } },
    include: { business: true, user: true },
    orderBy: { createdAt: "desc" }
  });

  // Mapeamos los datos con los nombres de columnas exactos que queremos en el Excel
  const data = [
    ...sales.map(s => ({
      ID: s.id,
      Tipo: "INGRESO",
      Concepto: s.concept,
      Monto: s.amountCents / 100,
      Fecha: s.createdAt.toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
      Sucursal: s.business?.name || "General",
      Usuario: s.user?.fullName || "Sistema",
      Estatus: "VERIFICADO"
    })),
    ...expenses.map(e => ({
      ID: e.id,
      Tipo: "EGRESO",
      Concepto: e.category,
      Monto: e.amountCents / 100,
      Fecha: e.createdAt.toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
      Sucursal: e.business?.name || "General",
      Usuario: e.user?.fullName || "Sistema",
      Estatus: e.evidenceUrl ? "VERIFICADO" : "SIN TICKET"
    }))
  ].sort((a, b) => new Date(b.Fecha).getTime() - new Date(a.Fecha).getTime());

  return <ExportView data={data} />;
}