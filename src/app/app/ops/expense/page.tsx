import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExpenseForm } from "@/components/ops/ExpenseForm";

export default async function ExpenseCapturePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session as any).user.id as string;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    include: { business: true, primaryBusiness: true },
  });

  if (!me) redirect("/login");

  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const defaultBusinessId =
    me.primaryBusinessId ||
    me.businessId ||
    businesses[0]?.id;

  if (!defaultBusinessId) {
    return (
      <div className="p-6">
        No hay unidades registradas.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Gastos</h1>
        <p className="text-sm text-muted-foreground">
          Captura rápida (afecta dashboard y reportes)
        </p>
      </div>

      <ExpenseForm
        defaultBusinessId={defaultBusinessId}
        defaultUserId={userId}
        businesses={businesses}
      />
    </div>
  );
}
