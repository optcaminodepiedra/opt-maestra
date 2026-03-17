import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAdminBoot } from "@/lib/admin.actions";
import { hasPermission } from "@/lib/rbac";
import { UsersManager } from "@/components/owner/UsersManager";

export default async function OwnerUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session as any).user?.role as string;
  const userId = (session as any).user?.id as string;

  if (!hasPermission(role, "ADMIN_USERS_VIEW")) redirect("/app");

  const boot = await getAdminBoot();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Administra roles y unidad principal por usuario (multi-negocio).
        </p>
      </div>

      <UsersManager boot={boot as any} me={{ role, id: userId }} />
    </div>
  );
}