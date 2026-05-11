"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, X, Search, Users, Shield, AlertCircle, Building2,
  Check, Trash2, Key, UserPlus, MoreHorizontal,
} from "lucide-react";
import {
  grantBusinessAccess, revokeBusinessAccess, setPrimaryBusiness,
  createStaffUser, deactivateUser, resetUserPassword,
} from "@/lib/access-control.actions";

type User = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  jobTitle: string | null;
  primaryBusinessId: string | null;
  accessIds: string[];
  accessNames: string[];
};

type Business = { id: string; name: string };

type Props = {
  users: User[];
  businesses: Business[];
};

const ROLES = [
  { v: "STAFF_WAITER", label: "Mesero" },
  { v: "STAFF_BAR", label: "Barra" },
  { v: "STAFF_CASHIER", label: "Cajero" },
  { v: "STAFF_KITCHEN", label: "Cocina" },
  { v: "STAFF_RECEPTION", label: "Recepción" },
  { v: "STAFF_HOUSEKEEPING", label: "Limpieza" },
  { v: "STAFF_MAINTENANCE", label: "Mantenimiento" },
  { v: "STAFF_STORE", label: "Tienda" },
  { v: "STAFF_FIELD", label: "Campo (Rancho)" },
  { v: "STAFF_EXPERIENCES", label: "Experiencias" },
  { v: "MANAGER", label: "Manager" },
  { v: "MANAGER_OPS", label: "Manager Ops" },
  { v: "MANAGER_RESTAURANT", label: "Manager Restaurante" },
  { v: "MANAGER_HOTEL", label: "Manager Hotel" },
  { v: "MANAGER_RANCH", label: "Manager Rancho" },
  { v: "ACCOUNTING", label: "Contabilidad" },
  { v: "RESERVATIONS", label: "Reservaciones" },
  { v: "SALES", label: "Ventas" },
  { v: "INVENTORY", label: "Inventario" },
];

export function AccessControlClient({ users: initialUsers, businesses }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);

  // Form de creación
  const [newUser, setNewUser] = useState({
    fullName: "",
    username: "",
    password: "",
    role: "STAFF_WAITER",
    email: "",
    jobTitle: "",
    primaryBusinessId: "",
    accessBusinessIds: [] as string[],
  });

  // Reset password
  const [newPassword, setNewPassword] = useState("");

  const visibleUsers = useMemo(() => {
    let list = users;
    if (filterRole !== "ALL") {
      list = list.filter((u) => u.role === filterRole);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, search, filterRole]);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  // ─── Acciones ────────────────────────────────────────────────

  function handleGrant(user: User, businessId: string) {
    start(async () => {
      try {
        await grantBusinessAccess({ userId: user.id, businessId });
        router.refresh();
        showSuccess("Acceso agregado");
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleRevoke(user: User, businessId: string) {
    if (!confirm(`¿Quitar acceso de ${user.fullName} a este negocio?`)) return;
    start(async () => {
      try {
        await revokeBusinessAccess({ userId: user.id, businessId });
        router.refresh();
        showSuccess("Acceso eliminado");
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleSetPrimary(user: User, businessId: string) {
    start(async () => {
      try {
        await setPrimaryBusiness({ userId: user.id, businessId });
        router.refresh();
        showSuccess("Negocio principal actualizado");
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleCreate() {
    if (!newUser.fullName || !newUser.username || !newUser.password) {
      setError("Completa nombre, username y contraseña");
      return;
    }
    start(async () => {
      try {
        await createStaffUser(newUser);
        setCreateOpen(false);
        setNewUser({
          fullName: "",
          username: "",
          password: "",
          role: "STAFF_WAITER",
          email: "",
          jobTitle: "",
          primaryBusinessId: "",
          accessBusinessIds: [],
        });
        router.refresh();
        showSuccess(`Usuario ${newUser.fullName} creado`);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleResetPassword() {
    if (!resetPasswordUser || !newPassword) return;
    start(async () => {
      try {
        await resetUserPassword({ userId: resetPasswordUser.id, newPassword });
        setResetPasswordUser(null);
        setNewPassword("");
        showSuccess(`Contraseña de ${resetPasswordUser.fullName} reseteada`);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleDeactivate(user: User) {
    if (!confirm(`¿Desactivar a ${user.fullName}? No podrá acceder al sistema.`)) return;
    start(async () => {
      try {
        await deactivateUser(user.id);
        router.refresh();
        showSuccess(`${user.fullName} desactivado`);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  // ─── UI ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
          <Check className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, username o rol..."
                className="w-full h-10 pl-9 pr-3 border rounded-lg text-sm bg-background"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="h-10 px-3 border rounded-lg text-sm bg-background"
            >
              <option value="ALL">Todos los roles</option>
              {ROLES.map((r) => (
                <option key={r.v} value={r.v}>{r.label}</option>
              ))}
            </select>
            <Button onClick={() => setCreateOpen(true)} className="shrink-0">
              <UserPlus className="w-4 h-4 mr-1.5" /> Nuevo usuario
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Mostrando {visibleUsers.length} de {users.length} usuarios
          </p>
        </CardContent>
      </Card>

      {/* Lista de usuarios */}
      <div className="space-y-2">
        {visibleUsers.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            businesses={businesses}
            pending={pending}
            onGrant={handleGrant}
            onRevoke={handleRevoke}
            onSetPrimary={handleSetPrimary}
            onResetPwd={() => setResetPasswordUser(user)}
            onDeactivate={() => handleDeactivate(user)}
          />
        ))}
      </div>

      {/* Modal: Crear usuario */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="w-5 h-5" /> Nuevo usuario
                </CardTitle>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setCreateOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Nombre completo *">
                <input
                  type="text"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full h-9 px-3 border rounded text-sm bg-background"
                  placeholder="Juan Pérez"
                />
              </Field>
              <Field label="Username *">
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toLowerCase() })}
                  className="w-full h-9 px-3 border rounded text-sm bg-background"
                  placeholder="juan.p"
                />
              </Field>
              <Field label="Contraseña *">
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full h-9 px-3 border rounded text-sm bg-background"
                />
              </Field>
              <Field label="Rol *">
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full h-9 px-3 border rounded text-sm bg-background"
                >
                  {ROLES.map((r) => (
                    <option key={r.v} value={r.v}>{r.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Email (opcional, para Google login)">
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full h-9 px-3 border rounded text-sm bg-background"
                />
              </Field>
              <Field label="Puesto (opcional)">
                <input
                  type="text"
                  value={newUser.jobTitle}
                  onChange={(e) => setNewUser({ ...newUser, jobTitle: e.target.value })}
                  className="w-full h-9 px-3 border rounded text-sm bg-background"
                  placeholder="Mesero, Bartender..."
                />
              </Field>
              <Field label="Negocio principal *">
                <select
                  value={newUser.primaryBusinessId}
                  onChange={(e) => setNewUser({ ...newUser, primaryBusinessId: e.target.value })}
                  className="w-full h-9 px-3 border rounded text-sm bg-background"
                >
                  <option value="">— Selecciona —</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Accesos adicionales (opcional)">
                <div className="space-y-1">
                  {businesses.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newUser.accessBusinessIds.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUser({ ...newUser, accessBusinessIds: [...newUser.accessBusinessIds, b.id] });
                          } else {
                            setNewUser({ ...newUser, accessBusinessIds: newUser.accessBusinessIds.filter((id) => id !== b.id) });
                          }
                        }}
                      />
                      {b.name}
                    </label>
                  ))}
                </div>
              </Field>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={pending}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={pending}>
                  {pending ? "Creando..." : "Crear usuario"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Reset password */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="w-5 h-5" /> Resetear contraseña
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">Usuario: <strong>{resetPasswordUser.fullName}</strong> ({resetPasswordUser.username})</p>
              <Field label="Nueva contraseña">
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-9 px-3 border rounded text-sm bg-background"
                  autoFocus
                />
              </Field>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setResetPasswordUser(null); setNewPassword(""); }}>
                  Cancelar
                </Button>
                <Button onClick={handleResetPassword} disabled={pending || !newPassword}>
                  Resetear
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function UserRow({
  user, businesses, pending, onGrant, onRevoke, onSetPrimary, onResetPwd, onDeactivate,
}: {
  user: User;
  businesses: Business[];
  pending: boolean;
  onGrant: (u: User, bid: string) => void;
  onRevoke: (u: User, bid: string) => void;
  onSetPrimary: (u: User, bid: string) => void;
  onResetPwd: () => void;
  onDeactivate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const allAccessIds = useMemo(() => {
    const ids = new Set(user.accessIds);
    if (user.primaryBusinessId) ids.add(user.primaryBusinessId);
    return Array.from(ids);
  }, [user]);
  const availableToGrant = businesses.filter((b) => !allAccessIds.includes(b.id));

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{user.fullName}</p>
              <Badge variant="outline" className="text-[10px]">{user.role}</Badge>
              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{user.username}</code>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user.accessNames.length === 0 && !user.primaryBusinessId
                ? "Sin acceso a ningún negocio"
                : `${allAccessIds.length} negocio${allAccessIds.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Cerrar" : "Editar"}
          </Button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {/* Negocios actuales */}
            <div>
              <p className="text-xs uppercase text-muted-foreground mb-2">Negocios actuales</p>
              <div className="flex flex-wrap gap-1">
                {allAccessIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Sin negocios asignados</p>
                ) : (
                  allAccessIds.map((bid) => {
                    const b = businesses.find((x) => x.id === bid);
                    if (!b) return null;
                    const isPrimary = user.primaryBusinessId === bid;
                    return (
                      <div
                        key={bid}
                        className={`
                          flex items-center gap-1 px-2 py-1 rounded text-xs border
                          ${isPrimary ? "bg-blue-50 border-blue-300" : "bg-background"}
                        `}
                      >
                        <Building2 className="w-3 h-3" />
                        <span>{b.name}</span>
                        {isPrimary ? (
                          <Badge variant="default" className="text-[9px] ml-1">Principal</Badge>
                        ) : (
                          <button
                            onClick={() => onSetPrimary(user, bid)}
                            className="text-blue-600 hover:underline text-[10px] ml-1"
                            disabled={pending}
                          >
                            (hacer principal)
                          </button>
                        )}
                        <button
                          onClick={() => onRevoke(user, bid)}
                          className="ml-1 hover:bg-red-50 rounded p-0.5"
                          disabled={pending}
                        >
                          <X className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Agregar acceso */}
            {availableToGrant.length > 0 && (
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-2">Agregar acceso a:</p>
                <div className="flex flex-wrap gap-1">
                  {availableToGrant.map((b) => (
                    <Button
                      key={b.id}
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onGrant(user, b.id)}
                      disabled={pending}
                    >
                      <Plus className="w-3 h-3 mr-1" /> {b.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Acciones admin */}
            <div className="flex gap-2 pt-2 border-t">
              <Button size="sm" variant="outline" onClick={onResetPwd}>
                <Key className="w-3 h-3 mr-1" /> Resetear contraseña
              </Button>
              <Button size="sm" variant="outline" className="text-red-600" onClick={onDeactivate}>
                <Trash2 className="w-3 h-3 mr-1" /> Desactivar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase text-muted-foreground mb-1 block tracking-wide">{label}</label>
      {children}
    </div>
  );
}
