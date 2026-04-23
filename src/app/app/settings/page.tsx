import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Settings } from "lucide-react";
import { SettingsClient } from "@/components/admin/SettingsClient";
import { getSystemStats } from "@/lib/settings.actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const u = session.user as { id?: string; role?: string };
  const userId = u.id!;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      username: true,
      role: true,
      jobTitle: true,
      department: true,
      primaryBusiness: { select: { name: true } },
    },
  });
  if (!user) redirect("/login");

  const systemStats = await getSystemStats();

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-7 h-7 text-gray-500" />
          Configuración
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona tu perfil y preferencias
        </p>
      </div>

      <SettingsClient
        user={{
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          username: user.username,
          role: user.role,
          jobTitle: user.jobTitle,
          department: user.department,
          primaryBusinessName: user.primaryBusiness?.name ?? null,
        }}
        systemStats={systemStats}
      />
    </div>
  );
}
