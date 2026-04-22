import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  DollarSign, TrendingDown, Wallet, ArrowRight, Calendar,
  CreditCard, Banknote, ArrowLeftRight,
} from "lucide-react";

type SaleRow = {
  id: string;
  amountCents: number;
  method: "CASH" | "CARD" | "TRANSFER";
  concept: string;
  createdAt: Date;
  userName: string;
  cashpointName: string;
  businessName: string;
};

type ExpenseRow = {
  id: string;
  amountCents: number;
  category: string;
  note: string | null;
  createdAt: Date;
  userName: string;
  businessName: string;
};

type WithdrawalRow = {
  id: string;
  amountCents: number;
  reason: string | null;
  status: "REQUESTED" | "APPROVED" | "REJECTED";
  kind: "PETTY_CASH" | "LARGE_REQUEST";
  createdAt: Date;
  cashpointName: string | null;
  businessName: string;
  requestedByName: string;
};

type Props = {
  salesToday: SaleRow[];
  salesMonthTotalCents: number;
  salesTodayByMethod: { CASH: number; CARD: number; TRANSFER: number };
  expensesRecent: ExpenseRow[];
  expensesMonthTotalCents: number;
  withdrawalsRecent: WithdrawalRow[];
  withdrawalsPettyTodayCents: number;
  withdrawalsLargePendingCount: number;
  showBusinessName: boolean;
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

const METHOD_CONFIG = {
  CASH:     { label: "Efectivo",    icon: Banknote,        color: "text-green-600" },
  CARD:     { label: "Tarjeta",     icon: CreditCard,      color: "text-blue-600" },
  TRANSFER: { label: "Transferencia", icon: ArrowLeftRight, color: "text-purple-600" },
};

export function FinancesPanel({
  salesToday,
  salesMonthTotalCents,
  salesTodayByMethod,
  expensesRecent,
  expensesMonthTotalCents,
  withdrawalsRecent,
  withdrawalsPettyTodayCents,
  withdrawalsLargePendingCount,
  showBusinessName,
}: Props) {
  const salesTodayTotal = salesToday.reduce((sum, s) => sum + s.amountCents, 0);
  const netToday = salesTodayTotal - expensesRecent
    .filter(e => isSameDay(e.createdAt))
    .reduce((sum, e) => sum + e.amountCents, 0);

  return (
    <div className="space-y-4">
      {/* KPIs principales */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-green-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ventas hoy</CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(salesTodayTotal)}</div>
            <p className="text-xs text-muted-foreground">{salesToday.length} transacciones</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ventas mes</CardTitle>
            <Calendar className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(salesMonthTotalCents)}</div>
            <p className="text-xs text-muted-foreground">Acumulado del mes</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Gastos mes</CardTitle>
            <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(expensesMonthTotalCents)}</div>
            <p className="text-xs text-muted-foreground">
              {fmt(withdrawalsPettyTodayCents)} caja chica hoy
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Neto hoy</CardTitle>
            <DollarSign className={`h-3.5 w-3.5 ${netToday >= 0 ? "text-green-500" : "text-red-500"}`} />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className={`text-xl font-bold ${netToday >= 0 ? "" : "text-red-600"}`}>
              {fmt(netToday)}
            </div>
            <p className="text-xs text-muted-foreground">Ventas − gastos</p>
          </CardContent>
        </Card>
      </div>

      {/* Desglose por método de pago */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ventas de hoy por método de pago</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {(["CASH", "CARD", "TRANSFER"] as const).map((method) => {
              const cfg = METHOD_CONFIG[method];
              const Icon = cfg.icon;
              const amount = salesTodayByMethod[method];
              const pct = salesTodayTotal > 0 ? (amount / salesTodayTotal) * 100 : 0;
              return (
                <div key={method} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                    <p className="text-xs font-medium">{cfg.label}</p>
                  </div>
                  <p className="text-lg font-bold">{fmt(amount)}</p>
                  <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% del total</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Transacciones recientes (2 columnas) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Últimas ventas */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Últimas ventas</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/app/accounting">
                  Ver todas <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {salesToday.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Aún no hay ventas hoy.
              </div>
            ) : (
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {salesToday.slice(0, 15).map((s) => {
                  const cfg = METHOD_CONFIG[s.method];
                  const Icon = cfg.icon;
                  return (
                    <div key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{s.concept}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {s.userName} · {s.cashpointName}
                          {showBusinessName && ` · ${s.businessName}`}
                          {" · "}
                          {new Date(s.createdAt).toLocaleTimeString("es-MX", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Icon className={`w-3 h-3 ${cfg.color}`} />
                        <span className="text-sm font-bold">{fmt(s.amountCents)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Últimos gastos */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Últimos gastos</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/app/manager/expenses/new">
                  Nuevo gasto <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {expensesRecent.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Sin gastos registrados recientemente.
              </div>
            ) : (
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {expensesRecent.slice(0, 15).map((e) => (
                  <div key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{e.category}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {e.note && `${e.note} · `}
                        {e.userName}
                        {showBusinessName && ` · ${e.businessName}`}
                        {" · "}
                        {new Date(e.createdAt).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-red-600 shrink-0">
                      −{fmt(e.amountCents)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Retiros */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Retiros de caja
              {withdrawalsLargePendingCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {withdrawalsLargePendingCount} pendientes
                </Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {withdrawalsRecent.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Sin retiros recientes.
            </div>
          ) : (
            <div className="divide-y max-h-[300px] overflow-y-auto">
              {withdrawalsRecent.slice(0, 15).map((w) => {
                const statusBadge = (
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      w.status === "APPROVED" ? "bg-green-50 text-green-700 border-green-200" :
                      w.status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {w.status === "APPROVED" ? "Aprobado" :
                     w.status === "REJECTED" ? "Rechazado" : "Pendiente"}
                  </Badge>
                );
                return (
                  <div key={w.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {w.reason ?? "Sin concepto"}
                        </p>
                        <Badge variant="secondary" className="text-[9px]">
                          {w.kind === "PETTY_CASH" ? "Caja chica" : "Retiro grande"}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {w.requestedByName}
                        {w.cashpointName && ` · Caja: ${w.cashpointName}`}
                        {showBusinessName && ` · ${w.businessName}`}
                        {" · "}
                        {new Date(w.createdAt).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge}
                      <span className="text-sm font-bold">{fmt(w.amountCents)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function isSameDay(d: Date): boolean {
  const today = new Date();
  const date = new Date(d);
  return (
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth() &&
    today.getDate() === date.getDate()
  );
}
