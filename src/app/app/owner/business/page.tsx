import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { BusinessesClient } from "@/components/admin/BusinessesClient";
import { getBusinessStats } from "@/lib/businesses.actions";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

export default async function BusinessesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role as string;
  if (!ADMIN_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Acceso restringido</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Solo administradores pueden gestionar negocios.
          </CardContent>
        </Card>
      </div>
    );
  }

  const businesses = await getBusinessStats();

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="w-7 h-7 text-blue-500" />
          Negocios
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona los negocios de la operadora
        </p>
      </div>

      <BusinessesClient businesses={businesses} />
    </div>
  );
}
