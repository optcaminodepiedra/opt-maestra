import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingDown, Wallet, FileText, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma"; // IMPORTANTE: Agregamos Prisma

export default async function AccountingDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // 1. OBTENER LAS FECHAS DEL MES ACTUAL (Del día 1 al último minuto de hoy)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // 2. CONSULTAS A LA BASE DE DATOS REAL (Ventas, Gastos y Retiros)
  
  // A. Sumar todas las ventas (Sales) del mes actual
  const currentMonthSales = await prisma.sale.aggregate({
    where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
    _sum: { amountCents: true }
  });
  const totalIncome = (currentMonthSales._sum.amountCents || 0) / 100;

  // B. Sumar todos los gastos operativos (Expenses) del mes actual
  const currentMonthExpenses = await prisma.expense.aggregate({
    where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
    _sum: { amountCents: true }
  });
  const totalExpenses = (currentMonthExpenses._sum.amountCents || 0) / 100;

  // C. Contar cuántos retiros (Withdrawals) están pendientes de aprobar
  const pendingWithdrawalsCount = await prisma.withdrawal.count({
    where: { status: "REQUESTED" }
  });

  // D. Obtener los últimos 6 movimientos combinados (Ventas y Gastos recientes)
  const recentSales = await prisma.sale.findMany({
    take: 3,
    orderBy: { createdAt: "desc" },
    select: { id: true, concept: true, amountCents: true, createdAt: true }
  });
  const recentExpenses = await prisma.expense.findMany({
    take: 3,
    orderBy: { createdAt: "desc" },
    select: { id: true, category: true, amountCents: true, createdAt: true, evidenceUrl: true }
  });

  // Formatear las transacciones para mezclarlas en una sola lista visual
  const combinedTransactions = [
    ...recentSales.map(s => ({
      id: `sale-${s.id}`,
      type: "INCOME",
      concept: s.concept,
      amount: s.amountCents / 100,
      date: s.createdAt,
      status: "VERIFIED" // Asumimos que las ventas en caja ya están cobradas
    })),
    ...recentExpenses.map(e => ({
      id: `exp-${e.id}`,
      type: "EXPENSE",
      concept: e.category,
      amount: e.amountCents / 100,
      date: e.createdAt,
      status: e.evidenceUrl ? "VERIFIED" : "PENDING" // Si tiene foto de ticket, está verificado
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6); // Mezclar, ordenar por fecha y dejar las 6 más nuevas

  // 3. CÁLCULO DE UTILIDAD NETA
  const netProfit = totalIncome - totalExpenses;

  // Formateador de moneda (MXN)
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
  };
  
  // Formateador de fecha relativa (Hoy 10:30, Ayer 15:20)
  const formatDate = (date: Date) => {
    return date.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ENCABEZADO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel Contable</h1>
          <p className="text-muted-foreground mt-1">
            Resumen financiero, auditoría de gastos y flujo de caja en tiempo real.
          </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" asChild>
              {/* OJO: Esta ruta aún no existe, pero la dejaremos preparada */}
              <Link href="/app/accounting/exports">
                <FileText className="w-4 h-4 mr-2" />
                Exportar Excel
              </Link>
            </Button>
            <Button className="bg-primary hover:bg-primary/90" asChild>
              <Link href="/app/owner/expenses">+ Registrar Gasto</Link>
            </Button>
        </div>
      </div>

      {/* TARJETAS DE MÉTRICAS (KPIs) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totalIncome)}</div>
            <p className="text-xs text-muted-foreground mt-1">Ventas registradas en POS</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Egresos del Mes</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">Compras operativas e insumos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Flujo Neto</CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit < 0 ? 'text-red-600' : ''}`}>
              {formatMoney(netProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ingresos - Egresos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Retiros Solicitados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingWithdrawalsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Esperando autorización</p>
          </CardContent>
        </Card>
      </div>

      {/* SECCIÓN DE TRANSACCIONES Y AUDITORÍA */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        
        {/* LISTA DE MOVIMIENTOS RECIENTES */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Últimos Movimientos</CardTitle>
          </CardHeader>
          <CardContent>
            {combinedTransactions.length === 0 ? (
              <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
                No hay transacciones registradas este mes.
              </div>
            ) : (
              <div className="space-y-4">
                {combinedTransactions.map((tx) => (
                  <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg bg-muted/20 gap-3">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full shrink-0 ${tx.type === 'INCOME' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {tx.type === 'INCOME' 
                          ? <DollarSign className="h-5 w-5 text-green-600" /> 
                          : <TrendingDown className="h-5 w-5 text-red-600" />
                        }
                      </div>
                      <div>
                        <p className="font-semibold text-sm capitalize">{tx.concept}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 self-start sm:self-auto">
                      <span className={`font-bold ${tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatMoney(tx.amount)}
                      </span>
                      {tx.status === "VERIFIED" ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Verificado</Badge>
                      ) : (
                        // Asumimos que si no está verificado es porque es un gasto sin ticket
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Sin Ticket</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <Button variant="ghost" className="w-full mt-4 text-primary" asChild>
               {/* OJO: Esta ruta la crearemos después */}
              <Link href="/app/accounting/ledger">
                Ver libro mayor completo <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* MÓDULO DE ALERTAS Y CIERRES */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Auditoría y Cierres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Acciones sugeridas para mantener la salud financiera al día.
              </p>
              
              {pendingWithdrawalsCount > 0 ? (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <h4 className="font-semibold text-orange-800 text-sm mb-1">Cortes de Caja Pendientes</h4>
                    <p className="text-xs text-orange-700 mb-3">Hay {pendingWithdrawalsCount} solicitud(es) de retiro de efectivo esperando autorización de un gerente.</p>
                    <Button size="sm" variant="outline" className="w-full border-orange-300 text-orange-700 hover:bg-orange-100" asChild>
                        <Link href="/app/owner/withdrawals">Autorizar Retiros</Link>
                    </Button>
                </div>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-green-800 text-sm mb-1">Cajas al Corriente</h4>
                    <p className="text-xs text-green-700">No hay solicitudes de retiro pendientes de revisión.</p>
                </div>
              )}

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-800 text-sm mb-1">Cierre de Mes</h4>
                  <p className="text-xs text-blue-700 mb-3">El mes actual sigue abierto. Los gerentes pueden registrar gastos atrasados.</p>
                  <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 opacity-50 cursor-not-allowed">
                      Cerrar Periodo (Pronto)
                  </Button>
              </div>
              
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}