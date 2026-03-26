import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ShieldCheck } from "lucide-react";
import UserClockInToggle from "./UserClockInToggle";

export default async function UsersSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // Traemos a todos los usuarios ordenados por nombre
  const users = await prisma.user.findMany({
    orderBy: { fullName: "asc" }
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="w-8 h-8 text-primary" />
          Gestión de Empleados
        </h1>
        <p className="text-muted-foreground mt-1">
          Administra los accesos y reglas de seguridad de tu equipo de trabajo.
        </p>
      </div>

      <Card className="shadow-sm border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            Control de Asistencia (Reloj Checador)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Empleado</th>
                  <th className="px-6 py-4 font-medium">Rol en el Sistema</th>
                  <th className="px-6 py-4 font-medium text-right">¿Obligar a Checar Entrada?</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-semibold text-base">
                      {u.fullName || "Sin Nombre"}
                      <div className="text-xs text-muted-foreground font-normal">{u.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-md font-medium">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex justify-end">
                      {/* Aquí llamamos al botoncito interactivo */}
                      <UserClockInToggle userId={u.id} initialStatus={u.requiresClockIn} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}