"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Banknote, X, AlertCircle } from "lucide-react";
import {
  createPettyCashWithdrawal,
  requestLargeWithdrawal,
} from "@/lib/withdrawals.actions";

type Cashpoint = {
  id: string;
  name: string;
  businessId: string;
};

type Business = {
  id: string;
  name: string;
};

type Props = {
  businesses: Business[];
  cashpoints: Cashpoint[];
};

type Mode = "PETTY_CASH" | "LARGE_REQUEST" | null;

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

export function WithdrawalActions({ businesses, cashpoints }: Props) {
  const [mode, setMode] = useState<Mode>(null);

  const hasCashpoints = cashpoints.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wallet className="w-4 h-4" /> Retiros de caja
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!hasCashpoints ? (
          <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            No hay cajas configuradas para tus negocios. Pide a un administrador que las cree.
          </div>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-auto py-3"
              onClick={() => setMode("PETTY_CASH")}
            >
              <Banknote className="w-4 h-4 mr-3 text-green-600 shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">Retiro de caja chica</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Compras rápidas · Inmediato
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-auto py-3"
              onClick={() => setMode("LARGE_REQUEST")}
            >
              <Wallet className="w-4 h-4 mr-3 text-amber-600 shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">Solicitar retiro grande</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Requiere aprobación de contadora
                </div>
              </div>
            </Button>
          </>
        )}
      </CardContent>

      {mode && (
        <WithdrawalModal
          mode={mode}
          businesses={businesses}
          cashpoints={cashpoints}
          onClose={() => setMode(null)}
        />
      )}
    </Card>
  );
}

/* ───────────────────────── Modal ───────────────────────── */

function WithdrawalModal({
  mode,
  businesses,
  cashpoints,
  onClose,
}: {
  mode: "PETTY_CASH" | "LARGE_REQUEST";
  businesses: Business[];
  cashpoints: Cashpoint[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [cashpointId, setCashpointId] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const filteredCashpoints = cashpoints.filter((c) => c.businessId === businessId);

  // Auto-seleccionar primera caja cuando cambia negocio
  if (businessId && !cashpointId && filteredCashpoints.length > 0) {
    setCashpointId(filteredCashpoints[0].id);
  }
  if (businessId && cashpointId && !filteredCashpoints.some((c) => c.id === cashpointId)) {
    setCashpointId(filteredCashpoints[0]?.id ?? "");
  }

  const title = mode === "PETTY_CASH" ? "Retiro de caja chica" : "Solicitar retiro grande";
  const subtitle =
    mode === "PETTY_CASH"
      ? "Se aprueba al instante. La contadora lo ve en reportes."
      : "Queda pendiente. La contadora debe aprobarlo antes de que puedas retirarlo.";
  const accent = mode === "PETTY_CASH" ? "text-green-600" : "text-amber-600";

  function submit() {
    setError(null);
    const cents = Math.round(parseFloat(amount.replace(",", ".") || "0") * 100);

    if (!businessId) return setError("Selecciona un negocio.");
    if (!cashpointId) return setError("Selecciona una caja.");
    if (cents <= 0) return setError("El monto debe ser mayor a 0.");
    if (!reason.trim()) return setError("Describe el motivo.");

    start(async () => {
      try {
        if (mode === "PETTY_CASH") {
          await createPettyCashWithdrawal({
            businessId,
            cashpointId,
            amountCents: cents,
            reason: reason.trim(),
          });
        } else {
          await requestLargeWithdrawal({
            businessId,
            cashpointId,
            amountCents: cents,
            reason: reason.trim(),
          });
        }
        setSuccess(true);
        setTimeout(() => onClose(), 1400);
      } catch (err: any) {
        setError(err.message ?? "Error al procesar el retiro.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="bg-background rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h3 className={`text-base font-semibold ${accent}`}>{title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            disabled={pending}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-sm font-medium">
              {mode === "PETTY_CASH" ? "Retiro registrado" : "Solicitud enviada"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {mode === "PETTY_CASH"
                ? "Puedes tomar el dinero de la caja."
                : "La contadora recibirá la solicitud."}
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {businesses.length > 1 && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-medium">
                  Negocio
                </label>
                <select
                  value={businessId}
                  onChange={(e) => setBusinessId(e.target.value)}
                  disabled={pending}
                  className="w-full h-10 px-3 border rounded-lg text-sm bg-background mt-1"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-medium">
                Caja de donde retiras
              </label>
              <select
                value={cashpointId}
                onChange={(e) => setCashpointId(e.target.value)}
                disabled={pending || filteredCashpoints.length === 0}
                className="w-full h-10 px-3 border rounded-lg text-sm bg-background mt-1"
              >
                {filteredCashpoints.length === 0 ? (
                  <option value="">Sin cajas disponibles</option>
                ) : (
                  filteredCashpoints.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-medium">
                Monto (MXN)
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={pending}
                  placeholder="0.00"
                  className="w-full h-10 pl-7 pr-3 border rounded-lg text-sm bg-background"
                />
              </div>
              {amount && !isNaN(parseFloat(amount)) && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {fmt(Math.round(parseFloat(amount.replace(",", ".") || "0") * 100))}
                </p>
              )}
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-medium">
                Motivo / Concepto
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                rows={2}
                placeholder={
                  mode === "PETTY_CASH"
                    ? "Compra de verduras, papelería, etc."
                    : "Pago proveedor, nómina, etc."
                }
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background mt-1 resize-none"
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
                Cancelar
              </Button>
              <Button size="sm" onClick={submit} disabled={pending}>
                {pending
                  ? "Procesando..."
                  : mode === "PETTY_CASH"
                  ? "Confirmar retiro"
                  : "Enviar solicitud"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
