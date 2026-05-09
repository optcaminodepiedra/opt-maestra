"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, Users, DollarSign, Building2, Plus, X,
  AlertCircle, ArrowRight, RefreshCw, Settings, Map, Grid,
} from "lucide-react";
import { TableShape, type TableData } from "./TableShape";
import { AreaShape, type AreaData } from "./AreaShape";
import { openOrderAtTable } from "@/lib/restaurant-tables.actions";

type Mesero = { id: string; name: string; jobTitle: string | null; role: string };
type Summary = {
  total: number;
  free: number;
  occupied: number;
  readyToBill: number;
  totalSalesOpenCents: number;
};

type Props = {
  businessId: string;
  tables: TableData[];
  areas: AreaData[];
  summary: Summary;
  meseros: Mesero[];
  canManage: boolean;
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(cents / 100);

export function TablesView({
  businessId,
  tables,
  areas,
  summary,
  meseros,
  canManage,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [view, setView] = useState<"map" | "grid">("map");
  const [openingTable, setOpeningTable] = useState<TableData | null>(null);
  const [meseroId, setMeseroId] = useState("");
  const [pax, setPax] = useState(2);
  const [openNote, setOpenNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(id);
  }, [autoRefresh, router]);

  function handleTableClick(t: TableData) {
    if (t.status === "FREE") {
      setOpeningTable(t);
      setMeseroId("");
      setPax(2);
      setOpenNote("");
      setError(null);
    } else if ((t as any).activeOrderId) {
      router.push(`/app/restaurant/pos/${(t as any).activeOrderId}`);
    }
  }

  function handleOpenOrder() {
    if (!openingTable) return;
    if (!meseroId) { setError("Selecciona un mesero"); return; }
    setError(null);
    start(async () => {
      try {
        const res = await openOrderAtTable({
          tableId: openingTable.id,
          meseroId,
          pax,
          note: openNote.trim() || undefined,
        });
        router.push(`/app/restaurant/pos/${res.orderId}`);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  // Calcular bbox del canvas
  const canvasWidth = Math.max(1200, ...tables.map((t) => t.posX + t.width + 40), ...areas.map((a) => a.posX + a.width + 40));
  const canvasHeight = Math.max(700, ...tables.map((t) => t.posY + t.height + 40), ...areas.map((a) => a.posY + a.height + 40));

  // Agrupar por área para vista grid
  const byArea: Record<string, TableData[]> = {};
  for (const t of tables) {
    const k = t.area || "Sin área";
    (byArea[k] ??= []).push(t);
  }
  const areaNames = Object.keys(byArea).sort();

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <KpiCard color="green" label="Libres" value={summary.free} icon={CheckCircle2} />
        <KpiCard color="amber" label="Ocupadas" value={summary.occupied} icon={Users} />
        <KpiCard color="red" label="Cobrar" value={summary.readyToBill} icon={DollarSign} />
        <KpiCard color="blue" label="Total" value={summary.total} icon={Building2} />
        <KpiCard color="gray" label="Ventas abiertas" value={fmt(summary.totalSalesOpenCents)} icon={DollarSign} isMoney />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex border rounded-lg overflow-hidden">
          <button
            onClick={() => setView("map")}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${view === "map" ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >
            <Map className="w-3.5 h-3.5" /> Mapa
          </button>
          <button
            onClick={() => setView("grid")}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${view === "grid" ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >
            <Grid className="w-3.5 h-3.5" /> Grid
          </button>
        </div>

        <label className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
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

        {canManage && (
          <Button size="sm" variant="outline" onClick={() => router.push("/app/restaurant/tables/manage")} className="ml-auto">
            <Settings className="w-3.5 h-3.5 mr-1" /> Editar mapa
          </Button>
        )}
      </div>

      {/* Vista Mapa (canvas SVG) */}
      {view === "map" && (
        <Card>
          <CardContent className="p-0 overflow-auto" style={{ maxHeight: "70vh" }}>
            <svg
              width={canvasWidth}
              height={canvasHeight}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              style={{ background: "#fafafa", display: "block" }}
            >
              {areas.map((a) => (
                <AreaShape key={a.id} area={a} />
              ))}
              {tables.map((t) => (
                <TableShape key={t.id} table={t} onClick={() => handleTableClick(t)} />
              ))}
            </svg>
          </CardContent>
        </Card>
      )}

      {/* Vista Grid (por área) */}
      {view === "grid" && (
        <div className="space-y-3">
          {areaNames.map((area) => (
            <Card key={area}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  {area}
                  <Badge variant="secondary" className="text-[10px]">
                    {byArea[area].length} mesas
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                  {byArea[area].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleTableClick(t)}
                      className={`
                        aspect-square rounded-xl border-2 p-2 transition-all active:scale-95
                        ${t.status === "FREE" ? "bg-green-50 border-green-300 hover:bg-green-100" :
                          t.status === "OCCUPIED" ? "bg-amber-50 border-amber-300 hover:bg-amber-100" :
                          "bg-red-50 border-red-400 hover:bg-red-100 animate-pulse"}
                      `}
                    >
                      <div className="flex flex-col h-full">
                        <div className={`text-base md:text-lg font-bold ${
                          t.status === "FREE" ? "text-green-700" :
                          t.status === "OCCUPIED" ? "text-amber-700" :
                          "text-red-700"
                        }`}>
                          {t.name}
                        </div>
                        <div className="text-[9px] text-muted-foreground">cap. {t.capacity}</div>
                        {t.totalCents !== undefined && t.totalCents > 0 && (
                          <div className="text-xs font-bold mt-auto">{fmt(t.totalCents)}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal apertura */}
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
              <p className="text-xs text-muted-foreground mt-1">
                {openingTable.area || "Sin área"} · Capacidad: {openingTable.capacity}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Comensales</label>
                <div className="flex items-center gap-2 mt-1">
                  <Button size="sm" variant="outline" onClick={() => setPax(Math.max(1, pax - 1))} disabled={pending}>−</Button>
                  <input
                    type="number" min={1} value={pax}
                    onChange={(e) => setPax(parseInt(e.target.value) || 1)}
                    className="w-16 h-9 text-center border rounded text-base bg-background"
                  />
                  <Button size="sm" variant="outline" onClick={() => setPax(pax + 1)} disabled={pending}>+</Button>
                  {pax > openingTable.capacity && (
                    <Badge className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Excede capacidad</Badge>
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
                      {m.name}{m.jobTitle && ` · ${m.jobTitle}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Nota (opcional)</label>
                <input
                  type="text" value={openNote}
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
                <Button variant="outline" onClick={() => setOpeningTable(null)} disabled={pending}>Cancelar</Button>
                <Button onClick={handleOpenOrder} disabled={pending}>
                  {pending ? "Abriendo..." : "Abrir y empezar a pedir"}
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function KpiCard({ color, label, value, icon: Icon, isMoney }: any) {
  return (
    <Card className={`border-l-4 border-l-${color}-500 py-0`}>
      <CardHeader className="pb-1 pt-3 px-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-3 w-3 md:h-3.5 md:w-3.5 text-${color}-500`} />
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className={`${isMoney ? "text-base" : "text-xl"} font-bold`}>{value}</div>
      </CardContent>
    </Card>
  );
}
