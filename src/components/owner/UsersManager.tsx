"use client";

import * as React from "react";
import {
  adminDeleteUser,
  adminDeactivateUser,
  adminUpdateUser,
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

type Boot = {
  businesses: { id: string; name: string }[];
  users: Array<{
    id: string;
    fullName: string;
    username: string;
    role: string;
    isActive: boolean;
    primaryBusinessId: string | null;
    businessId: string | null;
    createdAt: string;
  }>;
};

const ROLES = [
  "MASTER_ADMIN",
  "OWNER",
  "SUPERIOR",
  "MANAGER",
  "ACCOUNTING",
  "STAFF_WAITER",
  "STAFF_BAR",
  "STAFF_KITCHEN",
  "STAFF_RECEPTION",
  "STAFF_EXPERIENCES",
];

export function UsersManager({ boot, me }: { boot: Boot; me: { role: string; id?: string } }) {
  const businesses = boot?.businesses ?? [];
  const users = boot?.users ?? [];

  const canView = hasPermission(me.role, "ADMIN_USERS_VIEW");
  const canEdit = hasPermission(me.role, "ADMIN_USERS_EDIT");
  const canDelete = hasPermission(me.role, "ADMIN_USERS_DELETE");

  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;

    return users.filter((u) => {
      const s = `${u.fullName} ${u.username} ${u.role}`.toLowerCase();
      return s.includes(needle);
    });
  }, [users, q]);

  async function saveUser(userId: string, patch: any) {
    if (!canEdit) return alert("No tienes permiso para editar usuarios.");
    try {
      await adminUpdateUser({ userId, ...patch });
      alert("Guardado");
    } catch (e: any) {
      alert(e?.message || "Error al guardar");
    }
  }

  async function deactivateUser(userId: string) {
    if (!canEdit) return alert("No tienes permiso.");
    if (!confirm("¿Desactivar usuario? (ya no podrá iniciar sesión)")) return;
    try {
      await adminDeactivateUser(userId);
      alert("Desactivado");
    } catch (e: any) {
      alert(e?.message || "Error");
    }
  }

  async function deleteUser(userId: string) {
    if (!canDelete) return alert("No tienes permiso para eliminar usuarios.");
    if (!confirm("¿Eliminar usuario DEFINITIVAMENTE?")) return;

    try {
      await adminDeleteUser(userId);
      alert("Eliminado");
    } catch (e: any) {
      alert(e?.message || "Error al eliminar");
    }
  }

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No tienes permiso para ver este módulo.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Usuarios</CardTitle>
          <Badge variant="secondary">{filtered.length} usuarios</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
          <div className="space-y-2">
            <Label>Buscar</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre / username / rol…" />
          </div>
          <div className="text-xs text-muted-foreground">
            {canEdit ? <>Puedes editar usuarios.</> : <>Solo lectura.</>}
          </div>
        </div>

        <Separator />

        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Unidad principal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="min-w-[320px]">
                    <div className="font-medium">{u.fullName}</div>
                    <div className="text-xs text-muted-foreground">@{u.username}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">id: {u.id}</div>
                  </TableCell>

                  <TableCell className="min-w-[220px]">
                    <Select
                      value={u.role}
                      onValueChange={(v) => saveUser(u.id, { role: v })}
                      disabled={!canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="min-w-[260px]">
                    <Select
                      value={u.primaryBusinessId || "__NONE__"}
                      onValueChange={(v) =>
                        saveUser(u.id, { primaryBusinessId: v === "__NONE__" ? null : v })
                      }
                      disabled={!canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="(sin unidad)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__">(sin unidad)</SelectItem>
                        {businesses.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Staff normalmente queda fijo a su unidad.
                    </div>
                  </TableCell>

                  <TableCell className="min-w-[120px]">
                    <Badge variant={u.isActive ? "secondary" : "destructive"}>
                      {u.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right min-w-[320px]">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        disabled={!canEdit}
                        onClick={() => {
                          const v = prompt("Nombre completo:", u.fullName) ?? "";
                          if (!v.trim()) return;
                          saveUser(u.id, { fullName: v.trim() });
                        }}
                      >
                        Renombrar
                      </Button>

                      <Button
                        variant="outline"
                        disabled={!canEdit}
                        onClick={() => {
                          const v = prompt("Username (sin espacios):", u.username) ?? "";
                          if (!v.trim()) return;
                          saveUser(u.id, { username: v.trim().toLowerCase() });
                        }}
                      >
                        Username
                      </Button>

                      <Button
                        variant="secondary"
                        disabled={!canEdit || !u.isActive}
                        onClick={() => deactivateUser(u.id)}
                      >
                        Desactivar
                      </Button>

                      <Button
                        variant="destructive"
                        disabled={!canDelete}
                        onClick={() => deleteUser(u.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    No hay usuarios con ese filtro.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}