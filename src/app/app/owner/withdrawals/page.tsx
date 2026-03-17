import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getWithdrawals } from "@/lib/withdrawals.actions";
import { prisma } from "@/lib/prisma";
import { WithdrawalsClient } from "@/components/withdrawals/WithdrawalsClient";

export default async function OwnerWithdrawalsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as any;

  const [businesses, withdrawals] = await Promise.all([
    prisma.business.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getWithdrawals({ limit: 300 }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Retiros</h1>
        <p className="text-sm text-muted-foreground">
          Solicitudes, aprobaciones y control de retiros por unidad.
        </p>
      </div>

      <WithdrawalsClient
        role={user.role}
        currentUserId={user.id}
        businesses={businesses}
        initialWithdrawals={withdrawals}
      />
    </div>
  );
}
