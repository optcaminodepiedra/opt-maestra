import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getInventoryBootData } from "@/lib/inventory.actions";
import { InventoryClient } from "@/components/inventory/InventoryClient";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ businessId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const sp = (await searchParams) ?? {};
  const boot = await getInventoryBootData(sp.businessId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Almacén / Inventario</h1>
        <p className="text-sm text-muted-foreground">
          Existencias, alertas, movimientos y requisiciones.
        </p>
      </div>

      <InventoryClient
        boot={boot}
        userId={(session as any).user.id}
        role={(session as any).user.role}
      />
    </div>
  );
}
