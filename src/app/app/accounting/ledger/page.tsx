import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LedgerTable from "./LedgerTable";

export default async function LedgerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // Traemos los últimos 150 ingresos y 150 egresos para no saturar la memoria
  const sales = await prisma.sale.findMany({
    take: 150,
    orderBy: { createdAt: "desc" },
    include: { business: true, user: true }
  });

  const expenses = await prisma.expense.findMany({
    take: 150,
    orderBy: { createdAt: "desc" },
    include: { business: true, user: true }
  });

  // Unificamos todo en un solo formato estándar para la tabla
  const unifiedTransactions = [
    ...sales.map(s => ({
      id: `sale-${s.id}`,
      type: "INCOME" as const,
      concept: s.concept,
      amount: s.amountCents / 100,
      date: s.createdAt,
      businessName: s.business?.name || "General",
      userName: s.user?.fullName || "Sistema",
      status: "VERIFIED"
    })),
    ...expenses.map(e => ({
      id: `exp-${e.id}`,
      type: "EXPENSE" as const,
      concept: e.category,
      amount: e.amountCents / 100,
      date: e.createdAt,
      businessName: e.business?.name || "General",
      userName: e.user?.fullName || "Sistema",
      status: e.evidenceUrl ? "VERIFIED" : "PENDING"
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime()); // Ordenamos del más nuevo al más viejo

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Libro Mayor</h1>
        <p className="text-muted-foreground mt-1">
          Historial completo de transacciones, ingresos y egresos de todas las unidades.
        </p>
      </div>
      
      {/* Pasamos los datos unificados a nuestra tabla interactiva */}
      <LedgerTable data={unifiedTransactions} />
    </div>
  );
}