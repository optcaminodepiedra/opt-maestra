import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintableRequisition } from "@/components/inventory/PrintableRequisition";

export const dynamic = "force-dynamic";

export default async function PrintRequisitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const req = await prisma.requisition.findUnique({
    where: { id },
    include: {
      business: { select: { name: true } },
      createdBy: { select: { fullName: true } },
      deliveredBy: { select: { fullName: true } },
      receivedBy: { select: { fullName: true } },
      items: {
        include: {
          item: { select: { name: true, sku: true, unit: true } },
        },
      },
    },
  });

  if (!req) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Requisición no encontrada</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            La requisición que intentas ver no existe o fue eliminada.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Validar permisos: el creador, admins, o INVENTORY pueden imprimirla
  const me = session.user as { id?: string; role?: string };
  const role = me.role as string;
  const isAdmin = ["MASTER_ADMIN", "OWNER", "SUPERIOR"].includes(role);
  const isInventory = role === "INVENTORY";
  const isCreator = req.createdById === me.id;

  if (!isAdmin && !isInventory && !isCreator) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Sin permisos</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No puedes ver esta requisición.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si es OWNER_HOUSE y no es admin/inventory, denegar
  if (req.isPrivate && !isAdmin && !isInventory) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Sin permisos</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Esta requisición es privada.
          </CardContent>
        </Card>
      </div>
    );
  }

  const items = req.items.map((it) => ({
    id: it.id,
    itemName: it.item?.name ?? it.freeTextName ?? "—",
    itemSku: it.item?.sku ?? null,
    unit: it.item?.unit ? String(it.item.unit) : (it.freeTextUnit ?? "pz"),
    qtyRequested: it.qtyRequested,
    qtyDelivered: it.qtyDelivered ?? null,
    notDeliveredReason: it.notDeliveredReason ?? null,
    estimatedPriceCents: it.estimatedPriceCents,
    isFreeText: !it.itemId,
    note: it.note ?? null,
  }));

  return (
    <PrintableRequisition
      requisition={{
        id: req.id,
        title: req.title,
        kind: req.kind,
        eventName: req.eventName,
        priority: req.priority,
        status: req.status,
        note: req.note,
        urgentNote: req.urgentNote,
        requiresSeparatePayment: req.requiresSeparatePayment,
        createdAt: req.createdAt.toISOString(),
        neededBy: req.neededBy?.toISOString() ?? null,
        deliveredAt: req.deliveredAt?.toISOString() ?? null,
        deliveryNote: req.deliveryNote,
        receivedAt: req.receivedAt?.toISOString() ?? null,
        receivedSignature: req.receivedSignature,
        businessName: req.business?.name ?? "—",
        createdByName: req.createdBy.fullName,
        deliveredByName: req.deliveredBy?.fullName ?? null,
        receivedByName: req.receivedBy?.fullName ?? null,
      }}
      items={items}
    />
  );
}
