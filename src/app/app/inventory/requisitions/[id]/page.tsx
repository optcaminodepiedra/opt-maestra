import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getRequisitionById } from "@/lib/requisitions.queries";
import { RequisitionDetailClient } from "@/components/inventory/RequisitionDetailClient";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];
const INVENTORY_ROLES = ["INVENTORY"];

export default async function RequisitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const u = session.user as { id?: string; role?: string };
  const role = u.role as string;

  const req = await getRequisitionById(id);
  if (!req) notFound();

  const isAdmin = ADMIN_ROLES.includes(role);
  const isInventory = INVENTORY_ROLES.includes(role);
  const isOwner = req.createdBy.id === u.id;

  const canApprove = isAdmin || isInventory;
  const canDeliver = isAdmin || isInventory;
  const canConfirmReceipt = isOwner || isAdmin;

  // ─── canCancel según reglas ──────────────────────────────
  // - Admins/Goyo: cualquier estado salvo RECEIVED, RECEIVED_PARTIAL, CLOSED, CANCELED
  // - Creador: solo en DRAFT/SUBMITTED
  const finalStates = ["RECEIVED", "RECEIVED_PARTIAL", "CLOSED", "CANCELED"];
  let canCancel = false;
  if (!finalStates.includes(req.status)) {
    if (isAdmin || isInventory) {
      canCancel = true;
    } else if (isOwner && ["DRAFT", "SUBMITTED"].includes(req.status)) {
      canCancel = true;
    }
  }

  const backHref = isInventory || isAdmin
    ? "/app/inventory"
    : "/app/manager/ops/requisitions";

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href={backHref}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Link>
      </Button>

      <RequisitionDetailClient
        viewerId={u.id ?? ""}
        viewerRole={role}
        canApprove={canApprove}
        canDeliver={canDeliver}
        canConfirmReceipt={canConfirmReceipt}
        canCancel={canCancel}
        requisition={{
          id: req.id,
          title: req.title,
          status: req.status,
          kind: req.kind,
          eventName: req.eventName,
          isPrivate: req.isPrivate,
          priority: req.priority,
          urgentNote: req.urgentNote,
          requiresSeparatePayment: req.requiresSeparatePayment,
          note: req.note,
          neededBy: req.neededBy?.toISOString() ?? null,
          createdAt: req.createdAt.toISOString(),
          businessName: req.business?.name ?? "—",
          createdByName: req.createdBy.fullName,
          createdById: req.createdBy.id,
          deliveredByName: req.deliveredBy?.fullName ?? null,
          deliveredAt: req.deliveredAt?.toISOString() ?? null,
          deliveryNote: req.deliveryNote,
          receivedByName: req.receivedBy?.fullName ?? null,
          receivedAt: req.receivedAt?.toISOString() ?? null,
          receivedSignature: req.receivedSignature,
          items: req.items.map((it: any) => ({
            id: it.id,
            itemName: it.item?.name ?? null,
            freeTextName: it.freeTextName,
            unit: it.item?.unit ?? it.freeTextUnit ?? "—",
            qtyRequested: it.qtyRequested,
            qtyDelivered: it.qtyDelivered,
            notDeliveredReason: it.notDeliveredReason,
            estimatedPriceCents: it.estimatedPriceCents,
            note: it.note,
            isFreeText: !it.itemId,
          })),
          payable: req.accountsPayable
            ? {
                id: req.accountsPayable.id,
                status: req.accountsPayable.status,
                amountCents: req.accountsPayable.amountCents,
              }
            : null,
        }}
      />
    </div>
  );
}
