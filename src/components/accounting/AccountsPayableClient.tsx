"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, AlertTriangle, CheckCircle2, Clock, XCircle,
  Building2, FileText, Calendar, AlertCircle, X, ExternalLink,
  Banknote, ArrowLeftRight, DollarSign,
} from "lucide-react";
import { markAccountsPayablePaid, cancelAccountsPayable } from "@/lib/accounts-payable.actions";

type APItem = {
  id: string;
  supplierName: string;
  concept: string;
  amountCents: number;
  dueDate: string | null;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELED";
  isUrgent: boolean;
  note: string | null;
  businessName: string | null;
  requisitionId: string | null;
  requisitionTitle: string | null;
  requisitionKind: string | null;
  createdByName: string;
  paidByName: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentRef: string | null;
  createdAt: string;
};

type Summary = {
  pendingCount: number;
  pendingAmountCents: number;
  overdueCount: number;
  overdueAmountCents: number;
  urgentCount: number;
  paidThisMonthCount: number;
  paidThisMonthAmountCents: number;
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

const STATUS_CONFIG = {
  PENDING:  { label: "Pendiente", cls: "bg-amber-50 text-amber-700 border-amber-200",  icon: Clock },
  PAID:     { label: "Pagado",    cls: "bg-green-50 text-green-700 border-green-200",  icon: CheckCircle2 },
  OVERDUE:  { label: "Vencido",   cls: "bg-red-50 text-red-700 border-red-200",        icon: AlertTriangle },
  CANCELED: { label: "Cancelado", cls: "bg-gray-50 text-gray-600 border-gray-200",     icon: XCircle },
};

export function AccountsPayableClient({ items: initial, summary }: { items: APItem[]; summary: Summary }) {
  const [pending, start] = useTransition();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "OVERDUE" | "PAID" | "CANCELED">("PENDING");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER">("TRANSFER");
  const [paymentRef, setPaymentRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const filtered = filter === "ALL" ? items : items.filter((i) => i.status === filter);

  function handleMarkPaid() {
    if (!payingId) return;
    setError(null);
    start(async () => {
      try {
        await markAccountsPayablePaid({
          id: payingId,
          paymentMethod,
          paymentRef: paymentRef.trim() || undefined,
        });
        setItems((prev) =>
          prev.map((i) =>
            i.id === payingId
              ? {
                  ...i,
                  status: "PAID",
                  paidAt: new Date().toISOString(),
                  paymentMethod,
                  paymentRef: paymentRef.trim() || null,
                }
              : i
          )
        );
        setPayingId(null);
        setPaymentRef("");
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleCancel() {
    if (!cancelingId) return;
    if (!cancelReason.trim()) {
      setError("Indica la razón de la cancelación");
      return;
    }
    setError(null);
    start(async () => {
      try {
        await cancelAccountsPayable({ id: cancelingId, reason: cancelReason });
        setItems((prev) =>
          prev.map((i) => (i.id === cancelingId ? { ...i, status: "CANCELED" } : i))
        );
        setCancelingId(null);
        setCancelReason("");
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pendientes</CardTitle>
            <Clock className="h-3.5 w-3.5 text-amber-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(summary.pendingAmountCents)}</div>
            <p className="text-xs text-muted-foreground">{summary.pendingCount} cuenta(s)</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Vencidos</CardTitle>
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold text-red-600">{fmt(summary.overdueAmountCents)}</div>
            <p className="text-xs text-muted-foreground">{summary.overdueCount} cuenta(s)</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Urgentes</CardTitle>
            <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{summary.urgentCount}</div>
            <p className="text-xs text-muted-foreground">requieren atención</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pagado este mes</CardTitle>
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold text-green-700">{fmt(summary.paidThisMonthAmountCents)}</div>
            <p className="text-xs text-muted-foreground">{summary.paidThisMonthCount} pago(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {(["PENDING", "OVERDUE", "ALL", "PAID", "CANCELED"] as const).map((f) => {
          const count = f === "ALL" ? items.length : items.filter((i) => i.status === f).length;
          const labels = { PENDING: "Pendientes", OVERDUE: "Vencidos", ALL: "Todos", PAID: "Pagados", CANCELED: "Cancelados" };
          return (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {labels[f]} ({count})
            </Button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No hay cuentas en este filtro.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((ap) => {
            const cfg = STATUS_CONFIG[ap.status];
            const StatusIcon = cfg.icon;
            const isOverdue = ap.dueDate && new Date(ap.dueDate) < new Date() && ap.status === "PENDING";

            return (
              <Card key={ap.id} className={ap.isUrgent && ap.status === "PENDING" ? "border-orange-300" : ""}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={`text-[10px] ${cfg.cls}`}>
                          <StatusIcon className="w-3 h-3 mr-0.5" />
                          {cfg.label}
                        </Badge>
                        {ap.isUrgent && ap.status === "PENDING" && (
                          <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">
                            🚨 URGENTE
                          </Badge>
                        )}
                        {ap.businessName && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Building2 className="w-2.5 h-2.5 mr-0.5" />
                            {ap.businessName}
                          </Badge>
                        )}
                        {ap.requisitionKind && (
                          <Badge variant="outline" className="text-[10px]">
                            {ap.requisitionKind}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm font-semibold">{ap.supplierName}</p>
                      <p className="text-xs text-muted-foreground">{ap.concept}</p>

                      <div className="flex items-center gap-3 mt-1 text-xs">
                        {ap.dueDate && (
                          <span className={isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}>
                            <Calendar className="w-3 h-3 inline mr-0.5" />
                            Vence: {new Date(ap.dueDate).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          Por: {ap.createdByName}
                        </span>
                        {ap.requisitionId && (
                          <Link
                            href={`/app/inventory/requisitions/${ap.requisitionId}`}
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            Ver requisición <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>

                      {ap.note && (
                        <p className="text-xs italic text-muted-foreground mt-1">{ap.note}</p>
                      )}

                      {ap.status === "PAID" && (
                        <p className="text-xs text-green-700 mt-1">
                          Pagado por {ap.paidByName} el{" "}
                          {ap.paidAt && new Date(ap.paidAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                          {ap.paymentMethod && ` · ${ap.paymentMethod}`}
                          {ap.paymentRef && ` · Ref: ${ap.paymentRef}`}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-2">
                      <div className="text-lg font-bold">{fmt(ap.amountCents)}</div>
                      {(ap.status === "PENDING" || ap.status === "OVERDUE") && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setCancelingId(ap.id)}
                            disabled={pending}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setPayingId(ap.id)}
                            disabled={pending}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Marcar pagado
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Marcar Pagado */}
      {payingId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Registrar pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Método de pago</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { v: "CASH" as const,     label: "Efectivo",      icon: Banknote },
                    { v: "CARD" as const,     label: "Tarjeta",       icon: CreditCard },
                    { v: "TRANSFER" as const, label: "Transferencia", icon: ArrowLeftRight },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.v}
                        onClick={() => setPaymentMethod(opt.v)}
                        className={`border rounded-lg p-2 text-xs flex flex-col items-center gap-1 transition ${
                          paymentMethod === opt.v ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Referencia (opcional)</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Folio, # transferencia, etc"
                  className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setPayingId(null); setPaymentRef(""); setError(null); }} disabled={pending}>
                  Cancelar
                </Button>
                <Button onClick={handleMarkPaid} disabled={pending}>
                  {pending ? "Guardando..." : "Confirmar pago"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Cancelar */}
      {cancelingId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <X className="w-5 h-5 text-red-600" />
                Cancelar cuenta por pagar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Esta acción marcará la cuenta como cancelada y no se pagará.
              </p>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Razón</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="¿Por qué se cancela?"
                  className="w-full p-2 border rounded-lg text-sm bg-background mt-1 min-h-[80px]"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setCancelingId(null); setCancelReason(""); setError(null); }} disabled={pending}>
                  No cancelar
                </Button>
                <Button variant="destructive" onClick={handleCancel} disabled={pending}>
                  {pending ? "Cancelando..." : "Sí, cancelar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
