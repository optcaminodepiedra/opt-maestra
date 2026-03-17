import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWithdrawals } from "@/lib/withdrawals.actions";
import { WithdrawalsClient } from "@/components/withdrawals/WithdrawalsClient";
import { getManagerRecentExpenses } from "@/lib/expenses.actions";

export default async function ManagerWithdrawalsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session as any)?.user?.id as string | undefined;
  const role = (session as any)?.user?.role as string | undefined;
  const primaryBusinessId = (session as any)?.user?.primaryBusinessId as string | undefined;

  if (!userId) redirect("/login");

  const canDecide =
    role === "MASTER_ADMIN" || role === "OWNER" || role === "SUPERIOR";

  const [businesses, withdrawals] = await Promise.all([
  prisma.business.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  }),
  getWithdrawals({ limit: 150, businessId: primaryBusinessId })
]);


  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Retiros</h1>
        <p className="text-sm text-muted-foreground">
          Solicita retiros y revisa estatus (tu unidad).
        </p>
      </div>

      <WithdrawalsClient
  role={role ?? "MANAGER"}
  currentUserId={userId}
  businesses={businesses}
  initialWithdrawals={withdrawals}
/>

    </div>
  );
}
