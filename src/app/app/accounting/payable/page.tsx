import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard } from "lucide-react";
import { listAccountsPayable, getAccountsPayableSummary } from "@/lib/accounts-payable.actions";
import { AccountsPayableClient } from "@/components/accounting/AccountsPayableClient";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "ACCOUNTING"];

export default async function AccountsPayablePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role as string;
  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Acceso restringido</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Solo dirección y contabilidad pueden ver los pagos pendientes.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [items, summary] = await Promise.all([
    listAccountsPayable({ limit: 200 }),
    getAccountsPayableSummary(),
  ]);

  const serialized = items.map((ap) => ({
    id: ap.id,
    supplierName: ap.supplierName,
    concept: ap.concept,
    amountCents: ap.amountCents,
    dueDate: ap.dueDate?.toISOString() ?? null,
    status: ap.status,
    isUrgent: ap.isUrgent,
    note: ap.note,
    businessName: ap.business?.name ?? null,
    requisitionId: ap.requisitionId,
    requisitionTitle: ap.requisition?.title ?? null,
    requisitionKind: ap.requisition?.kind ?? null,
    createdByName: ap.createdBy?.fullName ?? "?",
    paidByName: ap.paidBy?.fullName ?? null,
    paidAt: ap.paidAt?.toISOString() ?? null,
    paymentMethod: ap.paymentMethod,
    paymentRef: ap.paymentRef,
    createdAt: ap.createdAt.toISOString(),
  }));

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="w-7 h-7 text-amber-500" />
          Pagos pendientes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cuentas por pagar a proveedores y otros gastos pendientes
        </p>
      </div>

      <AccountsPayableClient items={serialized} summary={summary} />
    </div>
  );
}
