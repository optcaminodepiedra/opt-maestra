import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, ShieldAlert } from "lucide-react";
import {
  resolveRestaurantBusinessId,
  listRestaurantOptions,
} from "@/lib/restaurant-resolve";
import { RestaurantSelector } from "@/components/restaurant/RestaurantSelector";
import { listPrintersForBusiness, getPrintAgentInfo } from "@/lib/printers.actions";
import { listRecentPrintJobs } from "@/lib/print.actions";
import { PrintersClient } from "@/components/admin/PrintersClient";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH",
];

export default async function PrintersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const me = session.user as { id?: string; role?: string; primaryBusinessId?: string | null };
  const role = me.role as string;
  const userId = me.id ?? "";

  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" /> Sin acceso
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Solo gerentes y administradores pueden gestionar impresoras.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const businessId = await resolveRestaurantBusinessId({
    queryBusinessId: sp.businessId,
    userId,
    userRole: role,
    userPrimaryBusinessId: me.primaryBusinessId,
  });

  if (!businessId) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Sin restaurante</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No tienes acceso a ningún restaurante.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [business, options, printers, recentJobs, agentInfo] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    listRestaurantOptions(userId, role),
    listPrintersForBusiness(businessId),
    listRecentPrintJobs(businessId, 50),
    getPrintAgentInfo(businessId),
  ]);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Printer className="w-7 h-7 text-blue-500" />
            Impresión
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {business?.name} · Configura impresoras y monitorea tickets
          </p>
        </div>

        <RestaurantSelector current={businessId} options={options} />
      </div>

      <PrintersClient
        businessId={businessId}
        businessName={business?.name ?? ""}
        printers={printers as any}
        recentJobs={recentJobs as any}
        agentInfo={agentInfo}
      />
    </div>
  );
}
