"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Clock, AlertCircle, CheckCircle2, Building2,
  X, Plus, ArrowRight, RefreshCw, DollarSign, ChefHat,
  AlertTriangle, Trash2, ArrowRightLeft,
} from "lucide-react";
import { openOrderAtTable, discardEmptyOrder, moveOrderToTable } from "@/lib/restaurant-tables.actions";

type Table = {
  id: string;
  name: string;
  area: string;
  capacity: number;
  status: "FREE" | "OCCUPIED" | "READY_TO_BILL" | "RESERVED";
  activeOrderId: string | null;
  mesero: string | null;
  openedAtIso: string | null;
  minutesElapsed: number;
  itemCount: number;
  pendingKitchen: number;
  totalCents: number;
};

type Mesero = { id: string; name: string; jobTitle: string | null; role: string };

type Summary = {
  total: number;
  free: number;
  occupied: number;
  readyToBill: number;
  activeOrders: number;
  totalSalesOpenCents: number;
};

type Props = {
  byArea: Record<string, Table[]>;
  areas: string[];
  summary: Summary;
  meseros: Mesero[];
  businessId: string;
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(cents / 100);

const STATUS_CONFIG = {
  FREE: {
    label: "Libre",
    bg: "bg-green-50 hover:bg-green-100",
    border: "border-green-300",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  OCCUPIED: {
    label: "Ocupada",
    bg: "bg-amber-50 hover:bg-amber-100",
    border: "border-amber-300",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  READY_TO_BILL: {
    label: "Cobrar",
    bg: "bg-red-50 hover:bg-red-100",
    border: "border-red-400",
    text: "text-red-700",
    dot: "bg-red-500 animate-pulse",
  },
  RESERVED: {
    label: "Reservada",
    bg: "bg-blue-50 hover:bg-blue-100",
    border: "border-blue-300",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
};

export function TablesClient({
  byArea: initialByArea,
  areas,
  summary: initialSummary,
  meseros,
  businessId,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [byArea, setByArea] = useState(initialByArea);
  const [summary, setSummary] = useState(initialSummary);
  const [activeArea, setActiveArea] = useState<string | "ALL">("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Estado del modal de apertura
  const [openingTable, setOpeningTable] = useState<Table | null>(null);
  const [pax, setPax] = useState<number>(2);
  const [meseroId, setMeseroId] = useState<string>("");
  const [openNote, setOpenNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Estado del modal de "ya ocupada"
  const [viewingTable, setViewingTable] = useState<Table | null>(null);

  // Estado del modal de mover orden
  const [movingOrderId, setMovingOrderId] = useState<string | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string>("");

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, router]);

  // Tabla agrupada según filtro
  const visibleAreas = useMemo(() => {
    if (activeArea === "ALL") return areas;
    return [activeArea];
  }, [activeArea, areas]);

  // ─── Acciones ───────────────────────────────────────────────────

  function handleTableClick(t: Table) {
    if (t.status === "FREE") {
      // Modal de apertura
      setOpeningTable(t);
      setPax(2);
      setMeseroId("");
      setOpenNote("");
      setError(null);
    } else {
      // Si ya tiene orden, llevar al POS directamente
      if (t.activeOrderId) {
        router.push(`/app/restaurant/pos/${t.activeOrderId}`);
      } else {
        setViewingTable(t);
      }
    }
  }

  function handleOpenOrder() {
    if (!openingTable) return;
    if (!meseroId) {
      setError("Selecciona un mesero");
      return;
    }
    setError(null);
    start(async () => {
      try {
        const res = await openOrderAtTable({
          tableId: openingTable.id,
          meseroId,
          pax,
          note: openNote.trim() || undefined,
        });
        // Llevar al POS con la orden recién creada
        router.push(`/app/restaurant/pos/${res.orderId}`);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleDiscardOrder(orderId: string) {
    if (!confirm("¿Descartar esta orden vacía? Esta acción no se puede deshacer.")) return;
    start(async () => {
      try {
        await discardEmptyOrder(orderId);
        setViewingTable(null);
        router.refresh();
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  function handleMoveOrder() {
    if (!movingOrderId || !moveTargetId) return;
    start(async () => {
      try {
        await moveOrderToTable({ orderId: movingOrderId, newTableId: moveTargetId });
        setMovingOrderId(null);
        setMoveTargetId("");
        router.refresh();
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  // Mesas libres (para modal de mover)
  const freeTables = useMemo(() => {
    const all: Table[] = [];
    for (const a of areas) {
      for (const t of byArea[a] || []) {
        if (t.status === "FREE") all.push(t);
      }
    }
    return all;
  }, [byArea, areas]);

  // ─── UI ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
        <KpiCard color="green" label="Libres" value={summary.free} icon={CheckCircle2} />
        <KpiCard color="amber" label="Ocupadas" value={summary.occupied} icon={Users} />
        <KpiCard color="red" label="Listas para cobrar" value={summary.readyToBill} icon={DollarSign} />
        <KpiCard color="blue" label="Total mesas" value={summary.total} icon={Building2} />
        <KpiCard color="gray" label="Ventas abiertas" value={fmt(summary.totalSalesOpenCents)} icon={DollarSign} isMoney />
      </div>

      {/* Filtros de área */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant={activeArea === "ALL" ? "default" : "outline"}
          onClick={() => setActiveArea("ALL")}
        >
          Todas ({summary.total})
        </Button>
        {areas.map((a) => (
          <Button
            key={a}
            size="sm"
            variant={activeArea === a ? "default" : "outline"}
            onClick={() => setActiveArea(a)}
          >
            {a} ({(byArea[a] || []).length})
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3 w-3"
            />
            Auto-refresh
          </label>
          <Button size="sm" variant="ghost" onClick={() => router.refresh()} disabled={pending}>
            <RefreshCw className={`w-3.5 h-3.5 ${pending ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Mapa de mesas */}
      <div className="space-y-5">
        {visibleAreas.map((area) => {
          const tables = byArea[area] || [];
          if (tables.length === 0) return null;
          return (
            <Card key={area}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  {area}
                  <Badge variant="secondary" className="text-[10px]">
                    {tables.length} mesas
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 md:gap-3">
                  {tables.map((t) => (
                    <TableCard key={t.id} table={t} onClick={() => handleTableClick(t)} />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal: abrir mesa */}
      {openingTable && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="w-5 h-5 text-green-600" />
                  Abrir mesa {openingTable.name}
                </CardTitle>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setOpeningTable(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {openingTable.area} · Capacidad: {openingTable.capacity} personas
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Comensales</label>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPax(Math.max(1, pax - 1))}
                    disabled={pending}
                  >
                    -
                  </Button>
                  <input
                    type="number"
                    min="1"
                    max={openingTable.capacity * 2}
                    value={pax}
                    onChange={(e) => setPax(parseInt(e.target.value) || 1)}
                    className="w-16 h-9 text-center border rounded text-base bg-background"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPax(pax + 1)}
                    disabled={pending}
                  >
                    +
                  </Button>
                  {pax > openingTable.capacity && (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                      Excede capacidad
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Mesero asignado *</label>
                <select
                  value={meseroId}
                  onChange={(e) => setMeseroId(e.target.value)}
                  className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
                  autoFocus
                >
                  <option value="">— Selecciona —</option>
                  {meseros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.jobTitle && ` · ${m.jobTitle}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Nota (opcional)</label>
                <input
                  type="text"
                  value={openNote}
                  onChange={(e) => setOpenNote(e.target.value)}
                  placeholder="Cumpleaños, alergia, etc."
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
                <Button variant="outline" onClick={() => setOpeningTable(null)} disabled={pending}>
                  Cancelar
                </Button>
                <Button onClick={handleOpenOrder} disabled={pending}>
                  {pending ? "Abriendo..." : "Abrir y empezar a pedir"}
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: ver mesa ocupada (cuando no tiene activeOrderId, raro) */}
      {viewingTable && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-base">Mesa {viewingTable.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Estado inconsistente. Recarga la página.</p>
              <Button onClick={() => { setViewingTable(null); router.refresh(); }} className="mt-3">
                Recargar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: mover orden */}
      {movingOrderId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5" />
                Mover orden a otra mesa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                value={moveTargetId}
                onChange={(e) => setMoveTargetId(e.target.value)}
                className="w-full h-9 px-3 border rounded-lg text-sm bg-background"
              >
                <option value="">— Selecciona mesa libre —</option>
                {freeTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.area} · {t.name} (cap. {t.capacity})
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setMovingOrderId(null)} disabled={pending}>
                  Cancelar
                </Button>
                <Button onClick={handleMoveOrder} disabled={pending || !moveTargetId}>
                  Mover
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ Subcomponentes ═══════════════════════════ */

function KpiCard({
  color,
  label,
  value,
  icon: Icon,
  isMoney,
}: {
  color: string;
  label: string;
  value: number | string;
  icon: any;
  isMoney?: boolean;
}) {
  return (
    <Card className={`border-l-4 border-l-${color}-500 py-0`}>
      <CardHeader className="pb-1 pt-3 px-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className={`h-3 w-3 md:h-3.5 md:w-3.5 text-${color}-500`} />
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className={`${isMoney ? "text-base" : "text-xl"} font-bold`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function TableCard({ table: t, onClick }: { table: Table; onClick: () => void }) {
  const cfg = STATUS_CONFIG[t.status];
  const isUrgent = t.minutesElapsed > 90;

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center
        aspect-square rounded-xl border-2 transition-all
        ${cfg.bg} ${cfg.border}
        active:scale-95 hover:shadow-md
        p-2
      `}
    >
      {/* Status dot */}
      <span
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${cfg.dot}`}
        title={cfg.label}
      />

      {/* Tiempo arriba izquierda */}
      {t.activeOrderId && (
        <span className={`absolute top-2 left-2 text-[9px] font-mono ${isUrgent ? "text-red-700 font-bold" : "text-muted-foreground"}`}>
          {t.minutesElapsed}m
        </span>
      )}

      {/* Nombre */}
      <span className={`text-base md:text-lg font-bold ${cfg.text}`}>
        {t.name}
      </span>

      {/* Info */}
      <div className="text-[9px] md:text-[10px] mt-1 text-center">
        <div className="text-muted-foreground">cap. {t.capacity}</div>
        {t.activeOrderId && t.totalCents > 0 && (
          <div className="font-bold text-foreground">{fmt(t.totalCents)}</div>
        )}
        {t.activeOrderId && t.itemCount > 0 && (
          <div className="text-muted-foreground">
            {t.itemCount} ítem{t.itemCount !== 1 ? "s" : ""}
            {t.pendingKitchen > 0 && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-amber-700">
                <ChefHat className="w-2.5 h-2.5" />
                {t.pendingKitchen}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Indicador estado al pie */}
      <span className={`absolute bottom-1 text-[8px] uppercase tracking-wide font-bold ${cfg.text}`}>
        {cfg.label}
      </span>
    </button>
  );
}
