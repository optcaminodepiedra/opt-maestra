"use client";

import * as React from "react";
import {
  adminDeleteUser,
  adminUpdateUser,
  adminCreateUser,
} from "@/lib/admin.actions";
import { hasPermission } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Edit, Trash2, PlusCircle, Clock } from "lucide-react";

type Boot = {
  businesses: { id: string; name: string }[];
  users: Array<{
    id: string;
    fullName: string;
    username: string;
    email: string | null;
    role: string;
    isActive: boolean;
    requiresClockIn: boolean; 
    primaryBusinessId: string | null;
    businessId: string | null;
    createdAt: string;
  }>;
};

const ROLES = [
  "MASTER_ADMIN", "OWNER", "MANAGER_OPS", "ACCOUNTING", "SALES", "RESERVATIONS", "INVENTORY",
  "STAFF_MAINTENANCE", "MANAGER_RESTAURANT", "STAFF_CASHIER", "STAFF_WAITER", "STAFF_BAR",
  "STAFF_KITCHEN", "MANAGER_HOTEL", "STAFF_RECEPTION", "STAFF_HOUSEKEEPING", "MANAGER_RANCH",
  "STAFF_EXPERIENCES", "STAFF_FIELD", "STAFF_STORE", "SUPERIOR", "MANAGER"
];

export function UsersManager({ boot, me }: { boot: Boot; me: { role: string; id?: string } }) {
  const businesses = boot?.businesses ?? [];
  const users = boot?.users ?? [];

  const canView = hasPermission(me.role, "ADMIN_USERS_VIEW");
  const canEdit = hasPermission(me.role, "ADMIN_USERS_EDIT");
  const canDelete = hasPermission(me.role, "ADMIN_USERS_DELETE");

  const [q, setQ] = React.useState("");
  const [editingUser, setEditingUser] = React.useState<any>(null);
  const [formData, setFormData] = React.useState<any>({});
  const [isCreating, setIsCreating] = React.useState(false);
  const [newData, setNewData] = React.useState<any>({
    fullName: "",
    username: "",
    email: "",
    role: "STAFF_WAITER",
    primaryBusinessId: "__NONE__"
  });

  const [isSaving, setIsSaving] = React.useState(false);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;

    return users.filter((u) => {
      const s = `${u.fullName} ${u.email} ${u.username} ${u.role}`.toLowerCase();
      return s.includes(needle);
    });
  }, [users, q]);

  function openEditModal(user: any) {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      email: user.email || "",
      username: user.username,
      role: user.role,
      primaryBusinessId: user.primaryBusinessId || "__NONE__",
      isActive: user.isActive,
      requiresClockIn: !!user.requiresClockIn, 
    });
  }

  async function handleSaveEdit() {
    if (!canEdit) return alert("No tienes permiso para editar.");
    setIsSaving(true);
    try {
      await adminUpdateUser({
        userId: editingUser.id,
        fullName: formData.fullName,
        email: formData.email,
        username: formData.username,
        role: formData.role,
        primaryBusinessId: formData.primaryBusinessId === "__NONE__" ? null : formData.primaryBusinessId,
        isActive: formData.isActive,
        requiresClockIn: formData.requiresClockIn,
      });
      setEditingUser(null);
    } catch (e: any) {
      alert(e?.message || "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteUser(userId: string) {
    if (!canDelete) return alert("No tienes permiso para eliminar.");
    if (!confirm("¿Eliminar usuario DEFINITIVAMENTE?")) return;

    try {
      await adminDeleteUser(userId);
      setEditingUser(null);
    } catch (e: any) {
      alert(e?.message || "Error al eliminar");
    }
  }

  async function handleCreate() {
    if (!canEdit) return alert("No tienes permiso para crear usuarios.");
    if (!newData.fullName || !newData.username) {
      return alert("El nombre y el username son obligatorios.");
    }

    setIsSaving(true);
    try {
      await adminCreateUser({
        fullName: newData.fullName,
        username: newData.username,
        email: newData.email,
        role: newData.role,
        primaryBusinessId: newData.primaryBusinessId === "__NONE__" ? null : newData.primaryBusinessId,
      });
      setIsCreating(false);
      setNewData({ fullName: "", username: "", email: "", role: "STAFF_WAITER", primaryBusinessId: "__NONE__" });
    } catch (e: any) {
      alert(e?.message || "Error al crear usuario");
    } finally {
      setIsSaving(false);
    }
  }

  if (!canView) return <div>No tienes permiso para ver este módulo.</div>;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Directorio de Usuarios</CardTitle>
              <Badge variant="secondary">{filtered.length} usuarios</Badge>
            </div>
            <Button size="sm" onClick={() => setIsCreating(true)} disabled={!canEdit} className="bg-primary hover:bg-primary/90">
              <PlusCircle className="w-4 h-4 mr-2" />
              Nuevo Usuario
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usuario..." className="max-w-sm" />
          <Separator />
          <div className="rounded-lg border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Usuario</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Unidad Principal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-semibold">{u.fullName}</div>
                      <div className="text-xs text-muted-foreground">@{u.username}</div>
                    </TableCell>
                    <TableCell>{u.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">{u.role}</Badge>
                    </TableCell>
                    <TableCell>{businesses.find(b => b.id === u.primaryBusinessId)?.name || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={u.isActive ? "secondary" : "destructive"}>{u.isActive ? "Activo" : "Inactivo"}</Badge>
                        {u.requiresClockIn && (
                          <Badge className="bg-orange-100 text-orange-700 border-orange-200"><Clock className="w-3 h-3 mr-1" /> Reloj</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openEditModal(u)} disabled={!canEdit}>
                        <Edit className="w-4 h-4 mr-2" /> Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Editar Perfil de Usuario v2.</DialogTitle></DialogHeader>
          {editingUser && (
            <div className="grid gap-4 py-4">
              {/* SWITCH ASISTENCIA OBLIGATORIA */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-orange-50/50 border-orange-100">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold flex items-center gap-2 text-orange-800">
                    <Clock className="w-4 h-4 text-orange-600" /> Reloj Obligatorio
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">Exigir asistencia para entrar</div>
                </div>
                <Switch 
                  checked={!!formData.requiresClockIn} 
                  onCheckedChange={(v) => setFormData({ ...formData, requiresClockIn: v })} 
                />
              </div>

              <div className="flex items-center justify-between border-b pb-4">
                <div className="space-y-0.5">
                  <Label>Acceso al Sistema</Label>
                  <div className="text-xs text-muted-foreground">Habilitar/Bloquear login.</div>
                </div>
                <Switch 
                  checked={formData.isActive} 
                  onCheckedChange={(v) => setFormData({ ...formData, isActive: v })} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unidad</Label>
                  <Select value={formData.primaryBusinessId} onValueChange={(v) => setFormData({ ...formData, primaryBusinessId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__NONE__">(Sin unidad)</SelectItem>
                      {businesses.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex items-center justify-between w-full">
            <Button variant="ghost" className="text-red-600" onClick={() => deleteUser(editingUser.id)}><Trash2 className="w-4 h-4 mr-2" /> Eliminar</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar Cambios"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Nuevo Usuario</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nombre</Label><Input value={newData.fullName} onChange={(e) => setNewData({ ...newData, fullName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Username</Label><Input value={newData.username} onChange={(e) => setNewData({ ...newData, username: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={newData.email} onChange={(e) => setNewData({ ...newData, email: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={newData.role} onValueChange={(v) => setNewData({ ...newData, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Select value={newData.primaryBusinessId} onValueChange={(v) => setNewData({ ...newData, primaryBusinessId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">(Sin unidad)</SelectItem>
                    {businesses.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isSaving}>{isSaving ? "Creando..." : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}