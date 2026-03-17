"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  createInventoryItem,
  addInventoryMovement,
  createRequisition,
  submitRequisition,
} from "@/lib/inventory.actions";
import { cn } from "@/lib/utils";
import {
  MovementType,
  RequisitionStatus,
  StockUnit,
} from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Boot = Awaited<ReturnType<typeof import("@/lib/inventory.actions").getInventoryBootData>>;

function fmtDate(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

export function InventoryClient({
  boot,
  userId,
}: {
  boot: Boot;
  userId: string;
  role: string;
}) {
  const router = useRouter();
  const businessId = boot.businessId || "";

  return (
    <div className="space-y-4">
      {/* Selector de unidad */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Unidad</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Select
              value={businessId}
              onValueChange={(v) => router.push(`/app/inventory?businessId=${v}`)}
            >
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder="Selecciona unidad" />
              </SelectTrigger>
              <SelectContent>
                {boot.businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {boot.lowStock.length > 0 ? (
              <Badge variant="destructive">
                {boot.lowStock.length} en alerta
              </Badge>
            ) : (
              <Badge variant="secondary">Sin alertas</Badge>
            )}
          </div>

          <div className="flex gap-2">
            <AddItemDialog businessId={businessId} />
            <AddMovementDialog businessId={businessId} userId={userId} items={boot.items} />
            <CreateRequisitionDialog businessId={businessId} userId={userId} items={boot.items} />
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Items</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{boot.totals.itemsCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Alertas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{boot.totals.lowStockCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Existencias (suma)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{boot.totals.onHandTotal}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Detalle</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="items" className="w-full">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="items">Inventario</TabsTrigger>
              <TabsTrigger value="alerts">Alertas</TabsTrigger>
              <TabsTrigger value="movements">Movimientos</TabsTrigger>
              <TabsTrigger value="reqs">Requisiciones</TabsTrigger>
            </TabsList>

            <Separator className="my-4" />

            {/* INVENTARIO */}
            <TabsContent value="items">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Mín</TableHead>
                    <TableHead className="text-right">Existencia</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boot.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        No hay items todavía.
                      </TableCell>
                    </TableRow>
                  ) : (
                    boot.items.map((it) => {
                      const alert = (it.onHandQty ?? 0) <= (it.minQty ?? 0);
                      return (
                        <TableRow key={it.id}>
                          <TableCell className="font-medium">{it.name}</TableCell>
                          <TableCell>{it.category ?? "—"}</TableCell>
                          <TableCell>{it.unit}</TableCell>
                          <TableCell className="text-right">{it.minQty}</TableCell>
                          <TableCell className="text-right">{it.onHandQty}</TableCell>
                          <TableCell className="text-right">
                            {alert ? (
                              <Badge variant="destructive">Bajo</Badge>
                            ) : (
                              <Badge variant="secondary">OK</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* ALERTAS */}
            <TabsContent value="alerts">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Mín</TableHead>
                    <TableHead className="text-right">Existencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boot.lowStock.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        Sin alertas de mínimos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    boot.lowStock.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">{it.name}</TableCell>
                        <TableCell>{it.category ?? "—"}</TableCell>
                        <TableCell className="text-right">{it.minQty}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-red-600 font-semibold">{it.onHandQty}</span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* MOVIMIENTOS */}
            <TabsContent value="movements">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Nota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boot.recentMovements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        Sin movimientos aún.
                      </TableCell>
                    </TableRow>
                  ) : (
                    boot.recentMovements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{fmtDate(m.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{m.type}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{m.item?.name ?? "—"}</TableCell>
                        <TableCell className="text-right">{m.qty}</TableCell>
                        <TableCell>{m.createdBy?.fullName ?? "—"}</TableCell>
                        <TableCell className="max-w-[320px] truncate">
                          {m.note ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* REQUISICIONES */}
            <TabsContent value="reqs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Estatus</TableHead>
                    <TableHead>Creada por</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boot.requisitions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        Sin requisiciones.
                      </TableCell>
                    </TableRow>
                  ) : (
                    boot.requisitions.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{fmtDate(r.createdAt)}</TableCell>
                        <TableCell className="font-medium">{r.title}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.status === RequisitionStatus.SUBMITTED
                                ? "default"
                                : r.status === RequisitionStatus.APPROVED
                                ? "secondary"
                                : r.status === RequisitionStatus.REJECTED
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.createdBy?.fullName ?? "—"}</TableCell>
                        <TableCell className="text-right">{r.items?.length ?? 0}</TableCell>
                        <TableCell className="text-right">
                          {r.status === RequisitionStatus.DRAFT ? (
                            <Button
                              size="sm"
                              onClick={async () => {
                                await submitRequisition(r.id);
                              }}
                            >
                              Enviar
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function AddItemDialog({ businessId }: { businessId: string }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [unit, setUnit] = React.useState<StockUnit>(StockUnit.PIECE);
  const [minQty, setMinQty] = React.useState("0");
  const [onHandQty, setOnHandQty] = React.useState("0");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">+ Item</Button>
      </DialogTrigger>

      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Agregar item</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Cerveza Victoria 355ml" />
          </div>

          <div className="grid gap-1">
            <Label>Categoría</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ej. Bebidas" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>SKU (opcional)</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Ej. VIC-355" />
            </div>
            <div className="grid gap-1">
              <Label>Unidad</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as StockUnit)}>
                <SelectTrigger>
                  <SelectValue placeholder="Unidad" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(StockUnit).map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Mínimo</Label>
              <Input value={minQty} onChange={(e) => setMinQty(e.target.value)} inputMode="numeric" />
            </div>
            <div className="grid gap-1">
              <Label>Existencia inicial</Label>
              <Input value={onHandQty} onChange={(e) => setOnHandQty(e.target.value)} inputMode="numeric" />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-3">
          <Button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await createInventoryItem({
                  businessId,
                  name,
                  category: category || null,
                  sku: sku || null,
                  unit,
                  minQty: Number(minQty || 0),
                  onHandQty: Number(onHandQty || 0),
                });
                setOpen(false);
                setName("");
                setCategory("");
                setSku("");
                setMinQty("0");
                setOnHandQty("0");
              } finally {
                setLoading(false);
              }
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMovementDialog({
  businessId,
  userId,
  items,
}: {
  businessId: string;
  userId: string;
  items: Array<any>;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [itemId, setItemId] = React.useState<string>("");
  const [type, setType] = React.useState<MovementType>(MovementType.IN);
  const [qty, setQty] = React.useState("1");
  const [note, setNote] = React.useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">+ Movimiento</Button>
      </DialogTrigger>

      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Item</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((it: any) => (
                  <SelectItem key={it.id} value={it.id}>
                    {it.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MovementType.IN}>IN (Entrada)</SelectItem>
                  <SelectItem value={MovementType.OUT}>OUT (Salida)</SelectItem>
                  <SelectItem value={MovementType.ADJUST}>ADJUST (+Ajuste)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label>Cantidad</Label>
              <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" />
            </div>
          </div>

          <div className="grid gap-1">
            <Label>Nota</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Compra, merma, ajuste, etc." />
          </div>
        </div>

        <DialogFooter className="mt-3">
          <Button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await addInventoryMovement({
                  businessId,
                  itemId,
                  type,
                  qty: Number(qty || 1),
                  note: note || null,
                  createdById: userId,
                });
                setOpen(false);
                setItemId("");
                setQty("1");
                setNote("");
                setType(MovementType.IN);
              } finally {
                setLoading(false);
              }
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateRequisitionDialog({
  businessId,
  userId,
  items,
}: {
  businessId: string;
  userId: string;
  items: Array<any>;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [note, setNote] = React.useState("");
  const [neededBy, setNeededBy] = React.useState("");

  const [rows, setRows] = React.useState<Array<{ itemId: string; qty: string; note: string }>>([
    { itemId: "", qty: "1", note: "" },
  ]);

  function setRow(i: number, patch: Partial<{ itemId: string; qty: string; note: string }>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { itemId: "", qty: "1", note: "" }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Requisición</Button>
      </DialogTrigger>

      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Nueva requisición</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Requisición semanal bar" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Necesario para (opcional)</Label>
              <Input value={neededBy} onChange={(e) => setNeededBy(e.target.value)} placeholder="YYYY-MM-DD" />
            </div>
            <div className="grid gap-1">
              <Label>Nota</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Urgente, evento, etc." />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Items</div>

            {rows.map((r, idx) => (
              <div key={idx} className={cn("grid gap-2 md:grid-cols-12 items-end")}>
                <div className="md:col-span-6">
                  <Label className="text-xs">Item</Label>
                  <Select value={r.itemId} onValueChange={(v) => setRow(idx, { itemId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona item" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((it: any) => (
                        <SelectItem key={it.id} value={it.id}>
                          {it.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs">Qty</Label>
                  <Input value={r.qty} onChange={(e) => setRow(idx, { qty: e.target.value })} inputMode="numeric" />
                </div>

                <div className="md:col-span-3">
                  <Label className="text-xs">Nota</Label>
                  <Input value={r.note} onChange={(e) => setRow(idx, { note: e.target.value })} placeholder="Opcional" />
                </div>

                <div className="md:col-span-1 flex gap-2">
                  <Button variant="outline" onClick={() => removeRow(idx)} disabled={rows.length === 1}>
                    -
                  </Button>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addRow}>
              + Agregar item
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-3">
          <Button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await createRequisition({
                  businessId,
                  title,
                  note: note || null,
                  neededBy: neededBy ? new Date(neededBy).toISOString() : null,
                  createdById: userId,
                  items: rows.map((r) => ({
                    itemId: r.itemId,
                    qtyRequested: Number(r.qty || 1),
                    note: r.note || null,
                  })),
                });
                setOpen(false);
                setTitle("");
                setNote("");
                setNeededBy("");
                setRows([{ itemId: "", qty: "1", note: "" }]);
              } finally {
                setLoading(false);
              }
            }}
          >
            Guardar (DRAFT)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
