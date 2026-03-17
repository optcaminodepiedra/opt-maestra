"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  createCashpoint,
  deleteCashpointSafe,
  renameBusiness,
  renameCashpoint,
} from "@/lib/settings.actions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Boot = {
  businesses: { id: string; name: string }[];
  selectedBusinessId: string | null;
  cashpoints: { id: string; name: string; businessId: string }[];
  usageByCashpointId: Record<string, { sales: number; shifts: number; menuItems: number; tables: number }>;
};

export function SettingsManager({ boot }: { boot: Boot }) {
  const router = useRouter();

  const businesses = boot?.businesses ?? [];
  const cashpoints = boot?.cashpoints ?? [];
  const usage = boot?.usageByCashpointId ?? {};

  const [businessId, setBusinessId] = React.useState<string>(boot?.selectedBusinessId ?? "");

  React.useEffect(() => {
    if (!businessId && businesses.length) setBusinessId(businesses[0].id);
  }, [businessId, businesses]);

  function onBusinessChange(id: string) {
    setBusinessId(id);
    router.push(`/app/owner/settings?businessId=${id}`);
  }

  // ===== Business rename =====
  const currentBiz = businesses.find((b) => b.id === businessId);
  const [bizName, setBizName] = React.useState(currentBiz?.name ?? "");
  React.useEffect(() => setBizName(currentBiz?.name ?? ""), [currentBiz?.name]);

  const [savingBiz, setSavingBiz] = React.useState(false);
  async function saveBizName() {
    if (!businessId) return;
    setSavingBiz(true);
    try {
      await renameBusiness({ businessId, name: bizName });
      router.refresh();
    } finally {
      setSavingBiz(false);
    }
  }

  // ===== Cashpoint create =====
  const [cpName, setCpName] = React.useState("");
  const [creatingCp, setCreatingCp] = React.useState(false);
  async function createCp() {
    if (!businessId) return;
    setCreatingCp(true);
    try {
      await createCashpoint({ businessId, name: cpName });
      setCpName("");
      router.refresh();
    } finally {
      setCreatingCp(false);
    }
  }

  // ===== Cashpoint edit dialog =====
  const [editOpen, setEditOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string>("");
  const [editName, setEditName] = React.useState<string>("");

  function openEdit(cp: { id: string; name: string }) {
    setEditId(cp.id);
    setEditName(cp.name);
    setEditOpen(true);
  }

  const [savingCp, setSavingCp] = React.useState(false);
  async function saveCp() {
    if (!editId) return;
    setSavingCp(true);
    try {
      await renameCashpoint({ cashpointId: editId, name: editName });
      setEditOpen(false);
      router.refresh();
    } finally {
      setSavingCp(false);
    }
  }

  // ===== Cashpoint delete dialog =====
  const [delOpen, setDelOpen] = React.useState(false);
  const [delId, setDelId] = React.useState<string>("");
  const [delName, setDelName] = React.useState<string>("");
  const [delErr, setDelErr] = React.useState<string>("");

  function openDelete(cp: { id: string; name: string }) {
    setDelId(cp.id);
    setDelName(cp.name);
    setDelErr("");
    setDelOpen(true);
  }

  const [deleting, setDeleting] = React.useState(false);
  async function doDelete() {
    if (!delId) return;
    setDeleting(true);
    setDelErr("");
    try {
      await deleteCashpointSafe({ cashpointId: delId });
      setDelOpen(false);
      router.refresh();
    } catch (e: any) {
      setDelErr(e?.message || "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  }

  if (!businessId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ajustes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No hay unidades en BD.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      {/* IZQ: selector + acciones */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Ajustes</CardTitle>
            <Badge variant="secondary">Admin</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
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
            <div className="text-xs text-muted-foreground">
              Todo lo que configures aquí aplica a esta unidad.
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Renombrar unidad</Label>
            <Input value={bizName} onChange={(e) => setBizName(e.target.value)} />
            <Button onClick={saveBizName} disabled={savingBiz || !bizName.trim()} className="w-full">
              Guardar nombre
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Nueva caja / punto</Label>
            <Input value={cpName} onChange={(e) => setCpName(e.target.value)} placeholder='Ej. "Restaurante", "Barra", "Cantina"' />
            <Button onClick={createCp} disabled={creatingCp || !cpName.trim()} className="w-full">
              Agregar caja / punto
            </Button>
            <div className="text-xs text-muted-foreground">
              Si luego quieres “desactivar” un punto que ya tuvo ventas, renómbralo como <b>INACTIVO - ...</b>.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DER: lista de cashpoints */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Cajas / Puntos</CardTitle>
            <Badge variant="secondary">{cashpoints.length} puntos</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {cashpoints.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No hay cajas/puntos en esta unidad. Crea una en el panel izquierdo.
            </div>
          ) : (
            <div className="space-y-2">
              {cashpoints.map((cp) => {
                const u = usage[cp.id] || { sales: 0, shifts: 0, menuItems: 0, tables: 0 };
                const used = (u.sales + u.shifts + u.menuItems + u.tables) > 0;

                return (
                  <div key={cp.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{cp.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ventas:{u.sales} · turnos:{u.shifts} · menú:{u.menuItems} · mesas:{u.tables}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => openEdit(cp)}>
                        Editar
                      </Button>

                      <Button
                        variant="destructive"
                        onClick={() => openDelete(cp)}
                        disabled={false}
                        title={used ? "Si está en uso, no se podrá eliminar; mejor renombrar a INACTIVO." : "Eliminar"}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* EDIT DIALOG */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar caja / punto</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>

                <Button onClick={saveCp} disabled={savingCp || !editName.trim()} className="w-full">
                  Guardar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* DELETE DIALOG */}
          <Dialog open={delOpen} onOpenChange={setDelOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Eliminar caja / punto</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="text-sm">
                  ¿Seguro que quieres eliminar <b>{delName}</b>?
                </div>

                {delErr ? (
                  <div className="text-sm text-destructive">{delErr}</div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Solo se elimina si NO tiene ventas/turnos/menú/mesas ligadas.
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="w-full" onClick={() => setDelOpen(false)}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={doDelete} disabled={deleting}>
                    Confirmar eliminación
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}