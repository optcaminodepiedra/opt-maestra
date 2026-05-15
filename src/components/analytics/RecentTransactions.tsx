"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Banknote, CreditCard, ArrowLeftRight, Eye,
} from "lucide-react";
import { DrillDownModal } from "./DrillDownModal";
import { loadSalesDrillDown, loadExpensesDrillDown } from "@/lib/drill-down.actions";

type SaleRow = {
  id: string;
  amountCents: number;
  method: "CASH" | "CARD" | "TRANSFER";
  concept: string;
  createdAt: string;
  businessName: string;
  userName: string;
  cashpointName: string;
};

type ExpenseRow = {
  id: string;
  amountCents: number;
  category: string;
  note: string | null;
  createdAt: string;
  businessName: string;
  userName: string;
};

type Props = {
  type: "sales" | "expenses";
  title: string;
  rows: (SaleRow | ExpenseRow)[];
  showBusinessName?: boolean;
  /** Para el drill-down: filtros que disparan modal con todos los registros */
  drillDownFilters: {
    fromIso: string;
    toIso: string;
    businessIds: string[];
  };
  rangeLabel: string;
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

const METHOD_CONFIG = {
  CASH: { icon: Banknote, color: "text-green-600" },
  CARD: { icon: CreditCard, color: "text-blue-600" },
  TRANSFER: { icon: ArrowLeftRight, color: "text-purple-600" },
};

export function RecentTransactions({
  type, title, rows, showBusinessName, drillDownFilters, rangeLabel,
}: Props) {
  const [drillOpen, setDrillOpen] = useState(false);

  const isSale = (r: SaleRow | ExpenseRow): r is SaleRow => type === "sales";

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{title}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setDrillOpen(true)}>
              <Eye className="w-3.5 h-3.5 mr-1" /> Ver todas
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Sin {type === "sales" ? "ventas" : "gastos"} en este período.
            </div>
          ) : (
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {rows.slice(0, 15).map((r) => {
                const d = new Date(r.createdAt);
                if (isSale(r)) {
                  const cfg = METHOD_CONFIG[r.method];
                  const Icon = cfg.icon;
                  return (
                    <div key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-muted/30 cursor-pointer" onClick={() => setDrillOpen(true)}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.concept}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {r.userName} · {r.cashpointName}
                          {showBusinessName && ` · ${r.businessName}`}
                          {" · "}
                          {d.toLocaleString("es-MX", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                            timeZone: "America/Mexico_City",
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Icon className={`w-3 h-3 ${cfg.color}`} />
                        <span className="text-sm font-bold">{fmt(r.amountCents)}</span>
                      </div>
                    </div>
                  );
                }

                // Expense
                const e = r as ExpenseRow;
                return (
                  <div key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-muted/30 cursor-pointer" onClick={() => setDrillOpen(true)}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{e.category}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {e.note && `${e.note} · `}
                        {e.userName}
                        {showBusinessName && ` · ${e.businessName}`}
                        {" · "}
                        {d.toLocaleDateString("es-MX", {
                          day: "numeric", month: "short",
                          timeZone: "America/Mexico_City",
                        })}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-red-600 shrink-0">
                      −{fmt(e.amountCents)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <DrillDownModal
        open={drillOpen}
        onOpenChange={setDrillOpen}
        title={type === "sales" ? "Todas las ventas" : "Todos los gastos"}
        subtitle={rangeLabel}
        type={type}
        loadRows={async () => {
          if (type === "sales") {
            return loadSalesDrillDown({
              fromIso: drillDownFilters.fromIso,
              toIso: drillDownFilters.toIso,
              businessIds: drillDownFilters.businessIds,
              limit: 500,
            }) as any;
          } else {
            return loadExpensesDrillDown({
              fromIso: drillDownFilters.fromIso,
              toIso: drillDownFilters.toIso,
              businessIds: drillDownFilters.businessIds,
              limit: 500,
            }) as any;
          }
        }}
      />
    </>
  );
}
