"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  createMenuItem,
  deleteCategory,
  deleteMenuItem,
  renameCategory,
  updateMenuItem,
} from "@/lib/restaurant.actions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function mxn(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

type Data = {
  businesses: { id: string; name: string }[];
  businessId: string | null;
  cashpoints: { id: string; name: string }[];
  selectedCashpointId?: string | null;
  menu: Array<{
    id: string;
    name: string;
    category: string;
    priceCents: number;
    cashpointId?: string | null;
  }>;
};

export function MenuManager({
  data,
  me,
}: {
  data: Data;
  me: { role: string; allowedToSwitch: boolean };
}) {
  const router = useRouter();

  const businesses = data?.businesses ?? [];
  const cashpoints = data?.cashpoints ?? [];
  const menu = data?.menu ?? [];

  const [businessId, setBusinessId] = React.useState<string>(data?.businessId ?? "");
  const [cashpointId, setCashpointId] = React.useState<string>(data?.selectedCashpointId ?? "");

  // --- creación
  const [category, setCategory] = React.useState("");
  const [name, setName] = React.useState("");
  const [price, setPrice] = React.useState("");

  // --- categorías existentes (del filtro actual)
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of menu) set.add((m.category || "General").trim() || "General");
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [menu]);

  // --- UI de "Agregar categoría"
  const [categoryMode, setCategoryMode] = React.useState<"select" | "add">("select");
  const [newCategory, setNewCategory] = React.useState("");

  // --- filtro por categoría en la lista
  const [activeCategory, setActiveCategory] = React.useState<string>("__ALL__");

  const filteredMenu = React.useMemo(() => {
    if (activeCategory === "__ALL__") return menu;
    return menu.filter((m) => (m.category || "General") === activeCategory);
  }, [menu, activeCategory]);

  function onBusinessChange(id: string) {
    setBusinessId(id);
    setCashpointId("");
    setActiveCategory("__ALL__");
    router.push(`/app/restaurant/menu?businessId=${id}`);
  }

  function onCashpointChange(id: string) {
    setCashpointId(id);
    setActiveCategory("__ALL__");
    router.push(`/app/restaurant/menu?businessId=${businessId}&cashpointId=${id}`);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();

    const p = Number(String(price).replace(",", "."));
    const finalCategory =
      categoryMode === "add" ? newCategory.trim() : category.trim();

    await createMenuItem({
      businessId,
      cashpointId: cashpointId || null,
      category: finalCategory || "General",
      name: name.trim(),
      price: p,
    });

    setName("");
    setPrice("");
    setCategory("");
    setNewCategory("");
    setCategoryMode("select");
    router.refresh();
  }

  if (!businessId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Menú</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No hay unidad seleccionada (o no hay unidades en BD).
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      {/* PANEL IZQ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Configuración</CardTitle>
            <Badge variant="secondary">Por unidad</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {me.allowedToSwitch ? (
            <div className="space-y-2">
              <Label>Unidad</Label>
              <Select value={businessId} onValueChange={onBusinessChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona unidad" />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Unidad fija (staff). Si necesitas cambiar unidad, entra con Owner/Master.
            </div>
          )}

          <div className="space-y-2">
            <Label>Menú por caja/local (opcional)</Label>
            <Select value={cashpointId} onValueChange={onCashpointChange}>
              <SelectTrigger>
                <SelectValue placeholder="(Opcional) filtrar por caja" />
              </SelectTrigger>
              <SelectContent>
                {cashpoints.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="text-xs text-muted-foreground">
              Si lo dejas vacío, es menú general de la unidad (cashpointId = null).
            </div>
          </div>

          <Separator />

          {/* CATEGORÍAS (barra colapsable) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Categorías</Label>
              <Badge variant="secondary">{categories.length}</Badge>
            </div>

            <Accordion type="single" collapsible defaultValue="cats">
              <AccordionItem value="cats">
                <AccordionTrigger>Ver / seleccionar categoría</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant={activeCategory === "__ALL__" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setActiveCategory("__ALL__")}
                    >
                      Todas
                    </Button>

                    {categories.map((c) => (
                      <div key={c} className="flex gap-2">
                        <Button
                          type="button"
                          variant={activeCategory === c ? "default" : "outline"}
                          className="flex-1 justify-start"
                          onClick={() => setActiveCategory(c)}
                        >
                          {c}
                        </Button>

                        {/* Acciones categoría */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button type="button" variant="secondary">⋯</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Acciones: {c}</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                              {/* Renombrar */}
                              <RenameCategoryBlock
                                businessId={businessId}
                                cashpointId={cashpointId || null}
                                from={c}
                                onDone={() => router.refresh()}
                              />

                              <Separator />

                              {/* Eliminar categoría */}
                              <div className="space-y-2">
                                <div className="text-sm">
                                  Quitar categoría = desactivar productos de esta categoría.
                                </div>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  onClick={async () => {
                                    const ok = confirm(`¿Desactivar TODOS los productos de "${c}"?`);
                                    if (!ok) return;
                                    await deleteCategory({
                                      businessId,
                                      cashpointId: cashpointId || null,
                                      category: c,
                                    });
                                    setActiveCategory("__ALL__");
                                    router.refresh();
                                  }}
                                >
                                  Quitar categoría
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <Separator />

          {/* FORM ALTA */}
          <form onSubmit={onCreate} className="space-y-3">
            <div className="space-y-2">
              <Label>Categoría para el nuevo producto</Label>

              <Select
                value={categoryMode === "add" ? "__ADD__" : (category || "__EMPTY__")}
                onValueChange={(v) => {
                  if (v === "__ADD__") {
                    setCategoryMode("add");
                    setCategory("");
                  } else {
                    setCategoryMode("select");
                    setNewCategory("");
                    setCategory(v === "__EMPTY__" ? "" : v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__EMPTY__">(Sin categoría) → General</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value="__ADD__">Agregar…</SelectItem>
                </SelectContent>
              </Select>

              {categoryMode === "add" ? (
                <div className="space-y-2">
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Nueva categoría (Ej. Entradas)"
                  />
                  <div className="text-xs text-muted-foreground">
                    Se crea “en automático” cuando guardas el primer producto con esa categoría.
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Producto</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Hamburguesa BBQ" />
            </div>

            <div className="space-y-2">
              <Label>Precio (MXN)</Label>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Ej. 220"
                inputMode="decimal"
              />
            </div>

            <Button className="w-full" type="submit" disabled={!name.trim()}>
              Agregar producto
            </Button>

            <div className="text-xs text-muted-foreground">
              Se guarda por <b>unidad</b> y (si elegiste) por <b>caja/local</b>.
            </div>
          </form>
        </CardContent>
      </Card>

      {/* LISTA */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Productos</CardTitle>
            <Badge variant="secondary">{filteredMenu.length} items</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Filtro: {activeCategory === "__ALL__" ? "Todas" : activeCategory}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {filteredMenu.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No hay productos para este filtro.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMenu.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.category}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{mxn(m.priceCents / 100)}</div>

                    {/* EDIT */}
                    <EditMenuItemDialog
                      item={m}
                      cashpointId={cashpointId || null}
                      onSave={async (patch) => {
                        await updateMenuItem({ id: m.id, ...patch });
                        router.refresh();
                      }}
                      categories={categories}
                    />

                    {/* DELETE */}
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={async () => {
                        const ok = confirm(`¿Quitar "${m.name}" del menú?`);
                        if (!ok) return;
                        await deleteMenuItem({ id: m.id });
                        router.refresh();
                      }}
                    >
                      🗑
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EditMenuItemDialog({
  item,
  cashpointId,
  onSave,
  categories,
}: {
  item: { id: string; name: string; category: string; priceCents: number; cashpointId?: string | null };
  cashpointId: string | null;
  onSave: (patch: { name: string; category: string; price: number; cashpointId?: string | null }) => Promise<void>;
  categories: string[];
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(item.name);
  const [category, setCategory] = React.useState(item.category || "General");
  const [price, setPrice] = React.useState(String((item.priceCents || 0) / 100));

  React.useEffect(() => {
    if (!open) return;
    setName(item.name);
    setCategory(item.category || "General");
    setPrice(String((item.priceCents || 0) / 100));
  }, [open, item]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">✏️</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar producto</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from(new Set(["General", ...categories])).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Precio (MXN)</Label>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
          </div>

          <div className="text-xs text-muted-foreground">
            Nota: el producto se edita en el contexto del menú actual (unidad + caja/local).
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={async () => {
              const p = Number(String(price).replace(",", "."));
              await onSave({
                name: name.trim(),
                category: category.trim(),
                price: p,
                cashpointId: cashpointId || null,
              });
              setOpen(false);
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameCategoryBlock({
  businessId,
  cashpointId,
  from,
  onDone,
}: {
  businessId: string;
  cashpointId: string | null;
  from: string;
  onDone: () => void;
}) {
  const [to, setTo] = React.useState("");

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Renombrar categoría</div>
      <div className="text-xs text-muted-foreground">
        Cambia "{from}" → (nuevo nombre). Afecta productos activos.
      </div>
      <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Nuevo nombre" />
      <Button
        type="button"
        disabled={!to.trim()}
        onClick={async () => {
          await renameCategory({
            businessId,
            cashpointId: cashpointId || null,
            from,
            to: to.trim(),
          });
          setTo("");
          onDone();
        }}
      >
        Renombrar
      </Button>
    </div>
  );
}