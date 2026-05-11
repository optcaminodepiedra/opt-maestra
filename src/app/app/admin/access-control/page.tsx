import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ShieldAlert } from "lucide-react";
import { listUsersWithAccess } from "@/lib/access-control.actions";
import { AccessControlClient } from "@/components/admin/AccessControlClient";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

export default async function AccessControlPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const me = session.user as { role?: string };
  const role = me.role as string;

  if (!ADMIN_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" /> Acceso restringido
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Solo administradores pueden gestionar accesos de usuarios.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { users, businesses } = await listUsersWithAccess();

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="w-7 h-7 text-blue-500" />
          Gestión de Accesos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administra qué usuarios pueden acceder a qué negocios. Crea nuevos meseros desde aquí.
        </p>
      </div>

      <AccessControlClient users={users as any} businesses={businesses as any} />
    </div>
  );
}
