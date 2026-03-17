import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getPlatformSettingsBoot } from "@/lib/platform-settings.actions";
import { PlatformSettingsManager } from "@/components/owner/PlatformSettingsManager";

type SP = { businessId?: string };

export default async function OwnerSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session as any).user?.role as string;
  if (!hasPermission(role, "ADMIN_SETTINGS_VIEW")) redirect("/app");

  const sp = (await searchParams) ?? {};
  const boot = await getPlatformSettingsBoot({ businessId: sp.businessId });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Ajustes globales de plataforma + configuración por unidad + catálogos compartidos.
        </p>
      </div>

      <PlatformSettingsManager boot={boot as any} />
    </div>
  );
}