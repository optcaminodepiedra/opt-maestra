"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2, Search, Banknote, CreditCard, ArrowLeftRight,
  X, Download,
} from "lucide-react";

type Row = {
  id: string;
  amountCents: number;
  method?: string;
  concept?: string;
  category?: string;
  note?: string | null;
  createdAt: Date | string;
  businessName: string;
  userName: string;
  cashpointName?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  /** Función que carga las filas (puede hacer fetch a API). */
  loadRows: () => Promise<Row[]>;
  type: "sales" | "expenses";
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

const METHOD_ICON: Record<string, any> = {
  CASH: Banknote, CARD: CreditCard, TRANSFER: ArrowLeftRight,
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transfer",
};

export function DrillDownModal({ open, onOpenChange, title, subtitle, loadRows, type }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    loadRows()
      .then((r) => setRows(r))
      .catch((err) => setError(err.message ?? "Error cargando datos"))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (r.concept ?? "").toLowerCase().includes(s) ||
      (r.category ?? "").toLowerCase().includes(s) ||
      (r.note ?? "").toLowerCase().includes(s) ||
      r.userName.toLowerCase().includes(s) ||
      r.businessName.toLowerCase().includes(s)
    );
  });

  const total = filtered.reduce((s, r) => s + r.amountCents, 0);

  function exportCsv() {
    const headers = type === "sales"
      ? ["Fecha", "Hora", "Concepto", "Método", "Monto", "Negocio", "Caja", "Usuario"]
      : ["Fecha", "Hora", "Categoría", "Nota", "Monto", "Negocio", "Usuario"];

    const csvRows = [headers.join(",")];

    for (const r of filtered) {
      const d = new Date(r.createdAt);
      const fecha = d.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
      const hora = d.toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" });
      const monto = (r.amountCents / 100).toFixed(2);

      const values = type === "sales"
        ? [fecha, hora, r.concept ?? "", METHOD_LABEL[r.method ?? ""] ?? r.method ?? "", monto, r.businessName, r.cashpointName ?? "", r.userName]
        : [fecha, hora, r.category ?? "", r.note ?? "", monto, r.businessName, r.userName];

      csvRows.push(values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <div>
              <p>{title}</p>
              {subtitle && (
                <p className="text-xs font-normal text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
            <Badge variant="secondary" className="text-sm shrink-0">
              {filtered.length} {filtered.length === 1 ? "registro" : "registros"} · {fmt(total)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-lg">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-sm text-red-600">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sin transacciones para mostrar.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">
                    {type === "sales" ? "Concepto" : "Categoría"}
                  </th>
                  <th className="text-left px-3 py-2 hidden md:table-cell">Negocio</th>
                  {type === "sales" && <th className="text-left px-3 py-2 hidden sm:table-cell">Método</th>}
                  <th className="text-right px-3 py-2">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => {
                  const d = new Date(r.createdAt);
                  const MethodIcon = r.method ? METHOD_ICON[r.method] : null;
                  return (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 text-xs">
                        <div>{d.toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" })}</div>
                        <div className="text-muted-foreground">
                          {d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium truncate max-w-xs">
                          {type === "sales" ? r.concept : r.category}
                        </div>
                        {(r.note || r.cashpointName) && (
                          <div className="text-xs text-muted-foreground truncate max-w-xs">
                            {r.note ?? r.cashpointName}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">
                        {r.businessName}
                      </td>
                      {type === "sales" && (
                        <td className="px-3 py-2 hidden sm:table-cell">
                          {MethodIcon && (
                            <Badge variant="outline" className="text-[10px]">
                              <MethodIcon className="w-3 h-3 mr-1" />
                              {METHOD_LABEL[r.method ?? ""] ?? r.method}
                            </Badge>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right font-bold">
                        {type === "expenses" ? "−" : ""}{fmt(r.amountCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
