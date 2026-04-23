"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Save, AlertCircle, CheckCircle2, Building2, Users, Wallet, Database, Mail } from "lucide-react";
import { updateMyProfile } from "@/lib/settings.actions";

type Props = {
  user: {
    id: string;
    fullName: string;
    email: string | null;
    username: string;
    role: string;
    jobTitle: string | null;
    department: string | null;
    primaryBusinessName: string | null;
  };
  systemStats: {
    users: number;
    businesses: number;
    cashpoints: number;
    sales: number;
    expenses: number;
  } | null;
};

export function SettingsClient({ user, systemStats }: Props) {
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState(user.fullName);
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? "");
  const [department, setDepartment] = useState(user.department ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges =
    fullName !== user.fullName ||
    jobTitle !== (user.jobTitle ?? "") ||
    department !== (user.department ?? "");

  function save() {
    if (!fullName.trim()) return setError("El nombre es requerido");
    setError(null);
    setSaved(false);

    startTransition(async () => {
      try {
        await updateMyProfile({ fullName, jobTitle, department });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" /> Mi perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Nombre completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
                disabled={pending}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Puesto</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Ej: Gerente General"
                className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
                disabled={pending}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Departamento</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Ej: Operaciones"
                className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
                disabled={pending}
              />
            </div>
          </div>

          {/* Campos read-only */}
          <div className="grid gap-3 md:grid-cols-3 pt-3 border-t">
            <ReadOnly label="Email" value={user.email ?? "—"} icon={<Mail className="w-3 h-3" />} />
            <ReadOnly label="Usuario" value={user.username} />
            <ReadOnly label="Rol" value={user.role} />
            {user.primaryBusinessName && (
              <ReadOnly label="Negocio principal" value={user.primaryBusinessName} icon={<Building2 className="w-3 h-3" />} />
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Cambios guardados
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={pending || !hasChanges}>
              <Save className="w-4 h-4 mr-1" /> {pending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info del sistema (solo admins) */}
      {systemStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" /> Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
              <StatCard label="Usuarios activos" value={systemStats.users} icon={<Users className="w-4 h-4 text-blue-500" />} />
              <StatCard label="Negocios" value={systemStats.businesses} icon={<Building2 className="w-4 h-4 text-purple-500" />} />
              <StatCard label="Cajas" value={systemStats.cashpoints} icon={<Wallet className="w-4 h-4 text-green-500" />} />
              <StatCard label="Ventas totales" value={systemStats.sales.toLocaleString()} icon={<Database className="w-4 h-4 text-amber-500" />} />
              <StatCard label="Gastos totales" value={systemStats.expenses.toLocaleString()} icon={<Database className="w-4 h-4 text-red-500" />} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preferencias futuras */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferencias</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Más preferencias estarán disponibles pronto (tema, notificaciones, idioma).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnly({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
        {icon} {label}
      </label>
      <p className="text-sm font-medium mt-1 truncate">{value}</p>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">{icon}<p className="text-xs text-muted-foreground">{label}</p></div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
