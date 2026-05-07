"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, ArrowUpDown, ArrowRightLeft,
  Search, ArrowRight, History,
} from "lucide-react";

type Move = {
  id: string;
  type: "IN" | "OUT" | "ADJUST" | "TRANSFER";
  qty: number;
  note: string | null;
  itemName: string;
  itemSku: string | null;
  itemUnit: string;
  createdAt: string;
  createdByName: string;
  destinationBusinessId: string | null;
  destinationBusinessName: string | null;
};

const TYPE_CONFIG = {
  IN:       { label: "Entrada",    icon: TrendingUp,    color: "text-green-600", bg: "bg-green-50",    sign: "+" },
  OUT:      { label: "Salida",     icon: TrendingDown,  color: "text-red-600",   bg: "bg-red-50",      sign: "−" },
  ADJUST:   { label: "Ajuste",     icon: ArrowUpDown,   color: "text-amber-600", bg: "bg-amber-50",    sign: "±" },
  TRANSFER: { label: "Transfer.",  icon: ArrowRightLeft, color: "text-blue-600", bg: "bg-blue-50",     sign: "→" },
};

export function MovementsClient({ moves }: { moves: Move[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "IN" | "OUT" | "ADJUST" | "TRANSFER">("ALL");

  const filtered = useMemo(() => {
    return moves.filter((m) => {
      if (typeFilter !== "ALL" && m.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const inName = m.itemName.toLowerCase().includes(q);
        const inSku = (m.itemSku ?? "").toLowerCase().includes(q);
        const inNote = (m.note ?? "").toLowerCase().includes(q);
        const inDest = (m.destinationBusinessName ?? "").toLowerCase().includes(q);
        if (!inName && !inSku && !inNote && !inDest) return false;
      }
      return true;
    });
  }, [moves, search, typeFilter]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por producto, SKU, nota o destino..."
                className="w-full h-9 pl-9 pr-3 border rounded-lg text-sm bg-background"
              />
            </div>
            <div className="flex gap-1">
              {(["ALL", "IN", "OUT", "ADJUST", "TRANSFER"] as const).map((t) => {
                const labels = { ALL: "Todos", IN: "Entradas", OUT: "Salidas", ADJUST: "Ajustes", TRANSFER: "Transfer." };
                return (
                  <Button
                    key={t}
                    size="sm"
                    variant={typeFilter === t ? "default" : "outline"}
                    onClick={() => setTypeFilter(t)}
                    className="flex-1 h-9 text-xs"
                  >
                    {labels[t]}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {filtered.length} movimiento(s) {filtered.length !== moves.length && `de ${moves.length}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <History className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Sin movimientos para mostrar</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((m) => {
                const cfg = TYPE_CONFIG[m.type];
                const Icon = cfg.icon;
                return (
                  <div key={m.id} className="px-4 py-3 hover:bg-muted/20">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${cfg.bg} ${cfg.color} border-current/20`}>
                            {cfg.label}
                          </Badge>
                          <p className="text-sm font-medium">{m.itemName}</p>
                          {m.itemSku && (
                            <span className="text-[10px] text-muted-foreground">SKU: {m.itemSku}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className={`font-semibold ${cfg.color}`}>
                            {cfg.sign}{m.qty} {m.itemUnit.toLowerCase()}
                          </span>
                          {m.destinationBusinessName && (
                            <>
                              <ArrowRight className="w-3 h-3 inline mx-1.5" />
                              <span className="font-medium">{m.destinationBusinessName}</span>
                            </>
                          )}
                          {" · "}{new Date(m.createdAt).toLocaleString("es-MX", {
                            day: "numeric", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                          {" · "}por {m.createdByName}
                        </p>
                        {m.note && (
                          <p className="text-xs italic text-muted-foreground mt-1">
                            "{m.note}"
                          </p>
                        )}
                      </div>
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
