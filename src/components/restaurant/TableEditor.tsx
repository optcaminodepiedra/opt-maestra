"use client";

import { useState, useRef, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Square, Circle, RectangleHorizontal,
  Minus, Save, X, AlertCircle, Move, Maximize2,
  Grid3x3, RotateCw, Undo2,
} from "lucide-react";
import { TableShape, type TableData } from "./TableShape";
import { AreaShape, type AreaData } from "./AreaShape";
import {
  createTable, updateTable, updateTablePosition, deleteTable,
  createArea, updateArea, updateAreaPosition, deleteArea,
} from "@/lib/restaurant-tables.actions";

const SNAP = 20;
const COLORS = [
  "#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3", "#e0e7ff",
  "#fed7aa", "#cffafe", "#fae8ff", "#fef9c3", "#f3e8ff",
];

type Props = {
  businessId: string;
  initialTables: TableData[];
  initialAreas: AreaData[];
};

type Selection =
  | { kind: "table"; id: string }
  | { kind: "area"; id: string }
  | null;

type DragState =
  | { kind: "table"; id: string; offsetX: number; offsetY: number }
  | { kind: "area"; id: string; offsetX: number; offsetY: number }
  | null;

export function TableEditor({ businessId, initialTables, initialAreas }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const svgRef = useRef<SVGSVGElement>(null);

  const [tables, setTables] = useState<TableData[]>(initialTables);
  const [areas, setAreas] = useState<AreaData[]>(initialAreas);
  const [selection, setSelection] = useState<Selection>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-sincronizar si cambia la prop (ej: después de un revalidate)
  useEffect(() => setTables(initialTables), [initialTables]);
  useEffect(() => setAreas(initialAreas), [initialAreas]);

  // ─── Cálculos ───────────────────────────────────────────────

  const canvasWidth = 1200;
  const canvasHeight = 700;

  const selectedTable = useMemo(
    () => (selection?.kind === "table" ? tables.find((t) => t.id === selection.id) : null),
    [selection, tables]
  );
  const selectedArea = useMemo(
    () => (selection?.kind === "area" ? areas.find((a) => a.id === selection.id) : null),
    [selection, areas]
  );

  // ─── Drag & Drop ────────────────────────────────────────────

  function getSvgCoords(e: React.MouseEvent | MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = (e as MouseEvent).clientX;
    pt.y = (e as MouseEvent).clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const t = pt.matrixTransform(ctm.inverse());
    return { x: t.x, y: t.y };
  }

  function snap(n: number) {
    return Math.round(n / SNAP) * SNAP;
  }

  function startDragTable(t: TableData, e: React.MouseEvent) {
    e.stopPropagation();
    setSelection({ kind: "table", id: t.id });
    const c = getSvgCoords(e);
    setDrag({
      kind: "table",
      id: t.id,
      offsetX: c.x - t.posX,
      offsetY: c.y - t.posY,
    });
  }

  function startDragArea(a: AreaData, e: React.MouseEvent) {
    e.stopPropagation();
    setSelection({ kind: "area", id: a.id });
    const c = getSvgCoords(e);
    setDrag({
      kind: "area",
      id: a.id,
      offsetX: c.x - a.posX,
      offsetY: c.y - a.posY,
    });
  }

  useEffect(() => {
    if (!drag) return;
    function onMove(ev: MouseEvent) {
      if (!drag) return;
      const c = getSvgCoords(ev);
      const newX = snap(c.x - drag.offsetX);
      const newY = snap(c.y - drag.offsetY);

      if (drag.kind === "table") {
        setTables((prev) =>
          prev.map((t) => (t.id === drag.id ? { ...t, posX: Math.max(0, newX), posY: Math.max(0, newY) } : t))
        );
      } else {
        setAreas((prev) =>
          prev.map((a) => (a.id === drag.id ? { ...a, posX: Math.max(0, newX), posY: Math.max(0, newY) } : a))
        );
      }
    }

    function onUp() {
      if (!drag) return;
      const captured = drag;
      setDrag(null);
      // Persistir en server
      if (captured.kind === "table") {
        const t = tables.find((x) => x.id === captured.id);
        if (t) {
          start(async () => {
            try {
              await updateTablePosition({ id: t.id, posX: t.posX, posY: t.posY });
            } catch (err: any) { setError(err.message); }
          });
        }
      } else {
        const a = areas.find((x) => x.id === captured.id);
        if (a) {
          start(async () => {
            try {
              await updateAreaPosition({ id: a.id, posX: a.posX, posY: a.posY });
            } catch (err: any) { setError(err.message); }
          });
        }
      }
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, tables, areas]);

  // ─── Acciones de menú ────────────────────────────────────────

  function handleAddTable(shape: "SQUARE" | "ROUND" | "RECTANGLE" | "BAR") {
    const name = prompt("Nombre de la mesa (ej: T-7, BAR-3):");
    if (!name?.trim()) return;
    const capStr = prompt("Capacidad (personas):", "4");
    const capacity = parseInt(capStr || "4") || 4;

    const defaults = {
      SQUARE: { width: 80, height: 80 },
      ROUND: { width: 80, height: 80 },
      RECTANGLE: { width: 160, height: 80 },
      BAR: { width: 200, height: 60 },
    };

    start(async () => {
      try {
        const res = await createTable({
          businessId,
          name: name.trim(),
          capacity,
          area: selectedArea?.name,
          shape,
          posX: 100,
          posY: 100,
          width: defaults[shape].width,
          height: defaults[shape].height,
        });
        router.refresh();
        setError(null);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleAddArea() {
    const name = prompt("Nombre del área (ej: Salón Privado):");
    if (!name?.trim()) return;
    start(async () => {
      try {
        await createArea({
          businessId,
          name: name.trim(),
          posX: 50,
          posY: 50,
          width: 400,
          height: 300,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          showBorder: true,
        });
        router.refresh();
        setError(null);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleDeleteSelected() {
    if (!selection) return;
    if (selection.kind === "table") {
      const t = tables.find((x) => x.id === selection.id);
      if (!t) return;
      if (!confirm(`¿Eliminar mesa ${t.name}?`)) return;
      start(async () => {
        try {
          await deleteTable(t.id);
          setSelection(null);
          router.refresh();
        } catch (err: any) {
          setError(err.message);
        }
      });
    } else {
      const a = areas.find((x) => x.id === selection.id);
      if (!a) return;
      if (!confirm(`¿Eliminar área "${a.name}"? Las mesas dentro quedarán sin área.`)) return;
      start(async () => {
        try {
          await deleteArea(a.id);
          setSelection(null);
          router.refresh();
        } catch (err: any) {
          setError(err.message);
        }
      });
    }
  }

  function updateSelectedTable(patch: Partial<TableData>) {
    if (selection?.kind !== "table") return;
    setTables((prev) => prev.map((t) => (t.id === selection.id ? { ...t, ...patch } : t)));
  }

  function persistSelectedTable() {
    if (!selectedTable) return;
    start(async () => {
      try {
        await updateTable({
          id: selectedTable.id,
          name: selectedTable.name,
          capacity: selectedTable.capacity,
          area: selectedTable.area || null,
          shape: selectedTable.shape,
          width: selectedTable.width,
          height: selectedTable.height,
          rotation: selectedTable.rotation,
        });
        setError(null);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function updateSelectedArea(patch: Partial<AreaData>) {
    if (selection?.kind !== "area") return;
    setAreas((prev) => prev.map((a) => (a.id === selection.id ? { ...a, ...patch } : a)));
  }

  function persistSelectedArea() {
    if (!selectedArea) return;
    start(async () => {
      try {
        await updateArea({
          id: selectedArea.id,
          name: selectedArea.name,
          width: selectedArea.width,
          height: selectedArea.height,
          color: selectedArea.color,
          showBorder: selectedArea.showBorder,
        });
        setError(null);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-2">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground mr-2">Agregar:</span>
            <Button size="sm" variant="outline" onClick={() => handleAddTable("SQUARE")} disabled={pending}>
              <Square className="w-3.5 h-3.5 mr-1" /> Cuadrada
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleAddTable("ROUND")} disabled={pending}>
              <Circle className="w-3.5 h-3.5 mr-1" /> Redonda
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleAddTable("RECTANGLE")} disabled={pending}>
              <RectangleHorizontal className="w-3.5 h-3.5 mr-1" /> Rectang.
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleAddTable("BAR")} disabled={pending}>
              <Minus className="w-3.5 h-3.5 mr-1" /> Barra
            </Button>

            <div className="w-px h-6 bg-border mx-2" />

            <Button size="sm" variant="outline" onClick={handleAddArea} disabled={pending}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Área
            </Button>

            <div className="ml-auto flex items-center gap-1">
              <Button
                size="sm"
                variant={showGrid ? "secondary" : "outline"}
                onClick={() => setShowGrid(!showGrid)}
                title="Mostrar/ocultar grid"
              >
                <Grid3x3 className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>−</Button>
              <span className="text-xs px-1 tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
              <Button size="sm" variant="outline" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>+</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Layout: canvas + panel propiedades */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
        {/* Canvas */}
        <Card>
          <CardContent className="p-0 overflow-auto" style={{ maxHeight: "70vh" }}>
            <svg
              ref={svgRef}
              width={canvasWidth * zoom}
              height={canvasHeight * zoom}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              style={{ background: "#fafafa", display: "block" }}
              onClick={() => setSelection(null)}
            >
              {/* Grid */}
              {showGrid && (
                <defs>
                  <pattern id="grid" width={SNAP} height={SNAP} patternUnits="userSpaceOnUse">
                    <path d={`M ${SNAP} 0 L 0 0 0 ${SNAP}`} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                  </pattern>
                </defs>
              )}
              {showGrid && <rect width={canvasWidth} height={canvasHeight} fill="url(#grid)" />}

              {/* Áreas (debajo de mesas) */}
              {areas.map((a) => (
                <AreaShape
                  key={a.id}
                  area={a}
                  selected={selection?.kind === "area" && selection.id === a.id}
                  editable
                  onMouseDown={(e) => startDragArea(a, e)}
                  onClick={(e) => { e.stopPropagation(); setSelection({ kind: "area", id: a.id }); }}
                />
              ))}

              {/* Mesas */}
              {tables.map((t) => (
                <TableShape
                  key={t.id}
                  table={t}
                  selected={selection?.kind === "table" && selection.id === t.id}
                  editable
                  onMouseDown={(e) => startDragTable(t, e)}
                  onClick={(e) => { e.stopPropagation(); setSelection({ kind: "table", id: t.id }); }}
                />
              ))}
            </svg>
          </CardContent>
        </Card>

        {/* Panel propiedades */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {selection?.kind === "table" ? "Mesa seleccionada" :
               selection?.kind === "area" ? "Área seleccionada" :
               "Sin selección"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selection && (
              <p className="text-xs text-muted-foreground">
                Haz click en una mesa o área para editar sus propiedades. Arrastra para moverlas.
              </p>
            )}

            {selectedTable && (
              <>
                <PropField label="Nombre">
                  <input
                    type="text"
                    value={selectedTable.name}
                    onChange={(e) => updateSelectedTable({ name: e.target.value })}
                    onBlur={persistSelectedTable}
                    className="w-full h-8 px-2 border rounded text-sm bg-background"
                  />
                </PropField>

                <PropField label="Capacidad">
                  <input
                    type="number"
                    value={selectedTable.capacity}
                    min={1}
                    onChange={(e) => updateSelectedTable({ capacity: parseInt(e.target.value) || 1 })}
                    onBlur={persistSelectedTable}
                    className="w-full h-8 px-2 border rounded text-sm bg-background"
                  />
                </PropField>

                <PropField label="Área">
                  <input
                    type="text"
                    value={selectedTable.area ?? ""}
                    placeholder="(sin área)"
                    onChange={(e) => updateSelectedTable({ area: e.target.value })}
                    onBlur={persistSelectedTable}
                    className="w-full h-8 px-2 border rounded text-sm bg-background"
                  />
                </PropField>

                <PropField label="Forma">
                  <select
                    value={selectedTable.shape}
                    onChange={(e) => {
                      updateSelectedTable({ shape: e.target.value as any });
                      setTimeout(persistSelectedTable, 50);
                    }}
                    className="w-full h-8 px-2 border rounded text-sm bg-background"
                  >
                    <option value="SQUARE">Cuadrada</option>
                    <option value="ROUND">Redonda</option>
                    <option value="RECTANGLE">Rectangular</option>
                    <option value="BAR">Barra</option>
                  </select>
                </PropField>

                <div className="grid grid-cols-2 gap-2">
                  <PropField label="Ancho">
                    <input
                      type="number"
                      value={selectedTable.width}
                      onChange={(e) => updateSelectedTable({ width: parseInt(e.target.value) || 80 })}
                      onBlur={persistSelectedTable}
                      className="w-full h-8 px-2 border rounded text-sm bg-background"
                    />
                  </PropField>
                  <PropField label="Alto">
                    <input
                      type="number"
                      value={selectedTable.height}
                      onChange={(e) => updateSelectedTable({ height: parseInt(e.target.value) || 80 })}
                      onBlur={persistSelectedTable}
                      className="w-full h-8 px-2 border rounded text-sm bg-background"
                    />
                  </PropField>
                </div>

                <PropField label="Rotación">
                  <select
                    value={selectedTable.rotation}
                    onChange={(e) => {
                      updateSelectedTable({ rotation: parseInt(e.target.value) });
                      setTimeout(persistSelectedTable, 50);
                    }}
                    className="w-full h-8 px-2 border rounded text-sm bg-background"
                  >
                    <option value="0">0°</option>
                    <option value="90">90°</option>
                    <option value="180">180°</option>
                    <option value="270">270°</option>
                  </select>
                </PropField>

                <Button size="sm" variant="destructive" className="w-full" onClick={handleDeleteSelected} disabled={pending}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar mesa
                </Button>
              </>
            )}

            {selectedArea && (
              <>
                <PropField label="Nombre">
                  <input
                    type="text"
                    value={selectedArea.name}
                    onChange={(e) => updateSelectedArea({ name: e.target.value })}
                    onBlur={persistSelectedArea}
                    className="w-full h-8 px-2 border rounded text-sm bg-background"
                  />
                </PropField>

                <div className="grid grid-cols-2 gap-2">
                  <PropField label="Ancho">
                    <input
                      type="number"
                      value={selectedArea.width}
                      onChange={(e) => updateSelectedArea({ width: parseInt(e.target.value) || 200 })}
                      onBlur={persistSelectedArea}
                      className="w-full h-8 px-2 border rounded text-sm bg-background"
                    />
                  </PropField>
                  <PropField label="Alto">
                    <input
                      type="number"
                      value={selectedArea.height}
                      onChange={(e) => updateSelectedArea({ height: parseInt(e.target.value) || 200 })}
                      onBlur={persistSelectedArea}
                      className="w-full h-8 px-2 border rounded text-sm bg-background"
                    />
                  </PropField>
                </div>

                <PropField label="Color">
                  <div className="grid grid-cols-5 gap-1">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          updateSelectedArea({ color: c });
                          setTimeout(persistSelectedArea, 50);
                        }}
                        className={`w-full h-7 rounded border-2 ${
                          selectedArea.color === c ? "border-blue-500" : "border-transparent"
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </PropField>

                <PropField label="Mostrar borde">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedArea.showBorder}
                      onChange={(e) => {
                        updateSelectedArea({ showBorder: e.target.checked });
                        setTimeout(persistSelectedArea, 50);
                      }}
                    />
                    {selectedArea.showBorder ? "Sí" : "No"}
                  </label>
                </PropField>

                <Button size="sm" variant="destructive" className="w-full" onClick={handleDeleteSelected} disabled={pending}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar área
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen */}
      <div className="text-xs text-muted-foreground text-center">
        {tables.length} mesas · {areas.length} áreas · {pending ? "Guardando..." : "Cambios guardados automáticamente"}
      </div>
    </div>
  );
}

function PropField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase font-medium text-muted-foreground tracking-wide mb-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}
