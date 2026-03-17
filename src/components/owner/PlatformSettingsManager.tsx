"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CatalogType } from "@prisma/client";

import {
  getPlatformSettingsBoot,
  setPlatformSetting,
  setBusinessModules,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
} from "@/lib/platform-settings.actions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Boot = Awaited<ReturnType<typeof getPlatformSettingsBoot>>;

function get(boot: Boot, key: string, fallback = "") {
  return (boot?.settingsMap?.[key] ?? fallback) as string;
}

export function PlatformSettingsManager({ boot }: { boot: Boot }) {
  const router = useRouter();

  const businesses = boot?.businesses ?? [];
  const [businessId, setBusinessId] = React.useState<string>(boot?.selectedBusinessId ?? "");

  React.useEffect(() => {
    if (!businessId && businesses.length) setBusinessId(businesses[0].id);
  }, [businessId, businesses]);

  function onBusinessChange(id: string) {
    setBusinessId(id);
    router.push(`/app/owner/settings?businessId=${id}`);
  }

  // ===== Plataforma (global) =====
  const [orgName, setOrgName] = React.useState(get(boot, "ORG_NAME", "Operadora Turística Camino de Piedra"));
  const [timezone, setTimezone] = React.useState(get(boot, "TIMEZONE", "America/Mexico_City"));
  const [currency, setCurrency] = React.useState(get(boot, "CURRENCY", "MXN"));
  const [withdrawSmall, setWithdrawSmall] = React.useState(get(boot, "WITHDRAWAL_SMALL_LIMIT", "8000"));

  async function savePlatformBasics() {
    await Promise.all([
      setPlatformSetting({ key: "ORG_NAME", value: orgName.trim() }),
      setPlatformSetting({ key: "TIMEZONE", value: timezone.trim() }),
      setPlatformSetting({ key: "CURRENCY", value: currency.trim() }),
      setPlatformSetting({ key: "WITHDRAWAL_SMALL_LIMIT", value: String(withdrawSmall).trim() }),
    ]);
    router.refresh();
  }

  // ===== Unidades (módulos habilitados por negocio) =====
  const modules = boot?.modulesByBusinessId?.[businessId] ?? {
    restaurant: true, hotel: false, museum: false, adventure: false,
    inventory: true, iot: false, payroll: false, accounting: true,
  };

  const [mRestaurant, setMRestaurant] = React.useState(!!modules.restaurant);
  const [mHotel, setMHotel] = React.useState(!!modules.hotel);
  const [mMuseum, setMMuseum] = React.useState(!!modules.museum);
  const [mAdventure, setMAdventure] = React.useState(!!modules.adventure);
  const [mInventory, setMInventory] = React.useState(!!modules.inventory);
  const [mIot, setMIot] = React.useState(!!modules.iot);
  const [mPayroll, setMPayroll] = React.useState(!!modules.payroll);
  const [mAccounting, setMAccounting] = React.useState(!!modules.accounting);

  React.useEffect(() => {
    const mod = boot?.modulesByBusinessId?.[businessId];
    if (!mod) return;

    setMRestaurant(!!mod.restaurant);
    setMHotel(!!mod.hotel);
    setMMuseum(!!mod.museum);
    setMAdventure(!!mod.adventure);
    setMInventory(!!mod.inventory);
    setMIot(!!mod.iot);
    setMPayroll(!!mod.payroll);
    setMAccounting(!!mod.accounting);
  }, [businessId, boot?.modulesByBusinessId]);

  async function saveModules() {
    if (!businessId) return;
    await setBusinessModules({
      businessId,
      modules: {
        restaurant: mRestaurant,
        hotel: mHotel,
        museum: mMuseum,
        adventure: mAdventure,
        inventory: mInventory,
        iot: mIot,
        payroll: mPayroll,
        accounting: mAccounting,
      },
    });
    router.refresh();
  }

  // ===== Catálogos =====
  const catalogs = boot?.catalogs ?? [];
  const [catType, setCatType] = React.useState<CatalogType>(CatalogType.EXPENSE_CATEGORY);
  const [catName, setCatName] = React.useState("");

  const filteredCatalogs = React.useMemo(() => {
    return catalogs.filter((c) => c.type === catType);
  }, [catalogs, catType]);

  async function addCatalog() {
    await createCatalogItem({ type: catType, name: catName, sortOrder: 0 });
    setCatName("");
    router.refresh();
  }

  // editar catalog item
  const [editOpen, setEditOpen] = React.useState(false);
  const [editId, setEditId] = React.useState("");
  const [editName, setEditName] = React.useState("");
  const [editActive, setEditActive] = React.useState(true);

  function openEditCatalog(it: any) {
    setEditId(it.id);
    setEditName(it.name);
    setEditActive(!!it.isActive);
    setEditOpen(true);
  }

  async function saveCatalog() {
    await updateCatalogItem({ id: editId, name: editName, isActive: editActive });
    setEditOpen(false);
    router.refresh();
  }

  // delete dialog
  const [delOpen, setDelOpen] = React.useState(false);
  const [delId, setDelId] = React.useState("");
  const [delName, setDelName] = React.useState("");
  function openDeleteCatalog(it: any) {
    setDelId(it.id);
    setDelName(it.name);
    setDelOpen(true);
  }
  async function doDeleteCatalog() {
    await deleteCatalogItem({ id: delId });
    setDelOpen(false);
    router.refresh();
  }

  // ===== Seguridad (políticas globales simples) =====
  const [pinLen, setPinLen] = React.useState(get(boot, "PIN_LENGTH", "4"));
  const [pinForceRotateDays, setPinForceRotateDays] = React.useState(get(boot, "PIN_ROTATE_DAYS", "0")); // 0 = no forzar

  async function saveSecurity() {
    await Promise.all([
      setPlatformSetting({ key: "PIN_LENGTH", value: String(pinLen).trim() }),
      setPlatformSetting({ key: "PIN_ROTATE_DAYS", value: String(pinForceRotateDays).trim() }),
    ]);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Top selector */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Ajustes generales</CardTitle>
            <Badge variant="secondary">Plataforma</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Unidad (para pestañas de “Unidades” y “Cajas/Puntos”)</Label>
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
            <div className="text-xs text-muted-foreground">
              Ajustes globales aplican a toda la plataforma; los de unidad aplican solo al negocio seleccionado.
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="platform">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="platform">Plataforma</TabsTrigger>
          <TabsTrigger value="business">Unidades</TabsTrigger>
          <TabsTrigger value="cashpoints">Cajas / Puntos</TabsTrigger>
          <TabsTrigger value="catalogs">Catálogos</TabsTrigger>
          <TabsTrigger value="security">Seguridad</TabsTrigger>
        </TabsList>

        {/* ===== Plataforma ===== */}
        <TabsContent value="platform">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Plataforma (global)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre de la empresa</Label>
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Zona horaria</Label>
                  <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/Mexico_City" />
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="MXN" />
                </div>
                <div className="space-y-2">
                  <Label>Límite retiro pequeño (MXN)</Label>
                  <Input value={withdrawSmall} onChange={(e) => setWithdrawSmall(e.target.value)} inputMode="numeric" />
                  <div className="text-xs text-muted-foreground">
                    Esto alimenta reglas internas (ej. autorizaciones).
                  </div>
                </div>
              </div>

              <Separator />

              <Button onClick={savePlatformBasics} className="w-full">
                Guardar ajustes globales
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Unidades ===== */}
        <TabsContent value="business">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Unidades (por negocio)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Activa módulos por unidad. Esto te sirve para que la plataforma “se adapte” al negocio (Hotel vs Museo vs Rancho).
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <label className="flex items-center gap-2 rounded-lg border p-3">
                  <input type="checkbox" checked={mRestaurant} onChange={(e) => setMRestaurant(e.target.checked)} />
                  Restaurante / POS
                </label>
                <label className="flex items-center gap-2 rounded-lg border p-3">
                  <input type="checkbox" checked={mHotel} onChange={(e) => setMHotel(e.target.checked)} />
                  Hotel (PMS)
                </label>
                <label className="flex items-center gap-2 rounded-lg border p-3">
                  <input type="checkbox" checked={mMuseum} onChange={(e) => setMMuseum(e.target.checked)} />
                  Museos
                </label>
                <label className="flex items-center gap-2 rounded-lg border p-3">
                  <input type="checkbox" checked={mAdventure} onChange={(e) => setMAdventure(e.target.checked)} />
                  Aventura / Rancho
                </label>
                <label className="flex items-center gap-2 rounded-lg border p-3">
                  <input type="checkbox" checked={mInventory} onChange={(e) => setMInventory(e.target.checked)} />
                  Inventario
                </label>
                <label className="flex items-center gap-2 rounded-lg border p-3">
                  <input type="checkbox" checked={mIot} onChange={(e) => setMIot(e.target.checked)} />
                  IoT / Flotilla
                </label>
                <label className="flex items-center gap-2 rounded-lg border p-3">
                  <input type="checkbox" checked={mPayroll} onChange={(e) => setMPayroll(e.target.checked)} />
                  Nómina
                </label>
                <label className="flex items-center gap-2 rounded-lg border p-3">
                  <input type="checkbox" checked={mAccounting} onChange={(e) => setMAccounting(e.target.checked)} />
                  Contabilidad / Control
                </label>
              </div>

              <Button onClick={saveModules} className="w-full">
                Guardar módulos de esta unidad
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Cajas/Puntos ===== */}
        <TabsContent value="cashpoints">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cajas / Puntos</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Aquí seguimos usando tu pantalla actual de “cashpoints” (la que ya hicimos).
              <div className="mt-2">
                Como ya quedó bien y no queremos duplicar lógica, esta pestaña es para mantener el acceso dentro de Ajustes Generales.
                Si quieres, en el siguiente paso integro tu componente existente de cashpoints aquí directo.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Catálogos ===== */}
        <TabsContent value="catalogs">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Catálogos globales</CardTitle>
                <Badge variant="secondary">{filteredCatalogs.length} items</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[260px_1fr_160px]">
                <div className="space-y-2">
                  <Label>Tipo de catálogo</Label>
                  <Select value={catType} onValueChange={(v: any) => setCatType(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CatalogType.EXPENSE_CATEGORY}>Categorías de gasto</SelectItem>
                      <SelectItem value={CatalogType.SALE_CONCEPT}>Conceptos de venta</SelectItem>
                      <SelectItem value={CatalogType.INVENTORY_CATEGORY}>Categorías de inventario</SelectItem>
                      <SelectItem value={CatalogType.TASK_AREA_TAG}>Tags de tareas</SelectItem>
                      <SelectItem value={CatalogType.GENERIC}>Genérico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nuevo ítem</Label>
                  <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Ej. Caja chica / Compras urgentes / Alimentos" />
                </div>

                <div className="flex items-end">
                  <Button className="w-full" onClick={addCatalog} disabled={!catName.trim()}>
                    Agregar
                  </Button>
                </div>
              </div>

              <Separator />

              {filteredCatalogs.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No hay items para este catálogo.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCatalogs.map((it: any) => (
                    <div key={it.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {it.name}{" "}
                          {!it.isActive ? <span className="text-xs text-muted-foreground">(inactivo)</span> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">sort: {it.sortOrder}</div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => openEditCatalog(it)}>
                          Editar
                        </Button>
                        <Button variant="destructive" onClick={() => openDeleteCatalog(it)}>
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Edit dialog */}
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar catálogo</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>

                    <label className="flex items-center gap-2 rounded-lg border p-3">
                      <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                      Activo
                    </label>

                    <Button onClick={saveCatalog} className="w-full" disabled={!editName.trim()}>
                      Guardar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Delete dialog */}
              <Dialog open={delOpen} onOpenChange={setDelOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Eliminar ítem</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-3">
                    <div className="text-sm">
                      ¿Eliminar <b>{delName}</b>?
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" className="w-full" onClick={() => setDelOpen(false)}>
                        Cancelar
                      </Button>
                      <Button variant="destructive" className="w-full" onClick={doDeleteCatalog}>
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Seguridad ===== */}
        <TabsContent value="security">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Seguridad (global)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Longitud de PIN POS</Label>
                  <Input value={pinLen} onChange={(e) => setPinLen(e.target.value)} inputMode="numeric" />
                  <div className="text-xs text-muted-foreground">
                    Para login rápido (PIN). Si pones 4, todos los PIN deben ser 4 dígitos.
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Rotación de PIN (días)</Label>
                  <Input value={pinForceRotateDays} onChange={(e) => setPinForceRotateDays(e.target.value)} inputMode="numeric" />
                  <div className="text-xs text-muted-foreground">
                    0 = no forzar. Si pones 90, obliga a cambiar PIN cada 90 días.
                  </div>
                </div>
              </div>

              <Button onClick={saveSecurity} className="w-full">
                Guardar políticas de seguridad
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}