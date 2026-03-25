import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingDown, Wallet, FileText, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AccountingDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // DATOS SIMULADOS (Pronto los conectaremos a tus modelos de Sale y Expense)
  const stats = {
    incomeMonth: 125400.50,
    expensesMonth: 48200.00,
    netProfit: 77200.50,
    pendingExpenses: 3,
  };

  const recentTransactions = [
    { id: "1", type: "INCOME", concept: "Corte de Caja - Restaurante", amount: 12500, date: "Hoy, 10:30 AM", status: "VERIFIED" },
    { id: "2", type: "EXPENSE", concept: "Compra de Insumos - Coca Cola", amount: 3400, date: "Hoy, 11:15 AM", status: "PENDING" },
    { id: "3", type: "INCOME", concept: "Anticipo Reserva Hotel - Hab 102", amount: 2500, date: "Ayer, 18:45 PM", status: "VERIFIED" },
    { id: "4", type: "EXPENSE", concept: "Pago Mantenimiento - Plomero", amount: 800, date: "Ayer, 14:20 PM", status: "PENDING" },
  ];

  // Formateador de moneda para que se vea como $ 1,000.00
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ENCABEZADO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel Contable</h1>
          <p className="text-muted-foreground mt-1">
            Resumen financiero, auditoría de gastos y flujo de caja.
          </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" asChild>
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
            <div className="text-2xl font-bold">{formatMoney(stats.incomeMonth)}</div>
            <p className="text-xs text-muted-foreground mt-1">Ventas, reservas y abonos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Egresos del Mes</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(stats.expensesMonth)}</div>
            <p className="text-xs text-muted-foreground mt-1">Compras y gastos operativos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Flujo Neto</CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(stats.netProfit)}</div>
            <p className="text-xs text-muted-foreground mt-1">Ingresos - Egresos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Gastos por Aprobar</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingExpenses}</div>
            <p className="text-xs text-muted-foreground mt-1">Requieren revisión</p>
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
            <div className="space-y-4">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg bg-muted/20 gap-3">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full shrink-0 ${tx.type === 'INCOME' ? 'bg-green-100' : 'bg-red-100'}`}>
                      {tx.type === 'INCOME' 
                        ? <DollarSign className="h-5 w-5 text-green-600" /> 
                        : <TrendingDown className="h-5 w-5 text-red-600" />
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{tx.concept}</p>
                      <p className="text-xs text-muted-foreground">{tx.date}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 self-start sm:self-auto">
                    <span className={`font-bold ${tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}{formatMoney(tx.amount)}
                    </span>
                    {tx.status === "VERIFIED" ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Verificado</Badge>
                    ) : (
                      <Button size="sm" variant="secondary" className="h-7 text-xs">Aprobar Gasto</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4 text-primary">
              Ver historial completo <ArrowRight className="w-4 h-4 ml-2" />
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
              
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <h4 className="font-semibold text-orange-800 text-sm mb-1">Gastos sin Comprobante</h4>
                  <p className="text-xs text-orange-700 mb-3">Hay 3 gastos registrados esta semana que no tienen foto de ticket o factura adjunta.</p>
                  <Button size="sm" variant="outline" className="w-full border-orange-300 text-orange-700 hover:bg-orange-100">
                      Revisar Tickets
                  </Button>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-800 text-sm mb-1">Cierre de Mes</h4>
                  <p className="text-xs text-blue-700 mb-3">Febrero no ha sido "bloqueado". Los gerentes aún pueden editar movimientos atrasados.</p>
                  <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
                      Cerrar Periodo
                  </Button>
              </div>
              
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}