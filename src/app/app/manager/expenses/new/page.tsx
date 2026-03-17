import { getManagerRecentExpenses } from "@/lib/expenses.actions";
import { ExpenseCreateForm } from "@/components/app/ExpenseCreateForm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function NewManagerExpensePage() {
  const businesses: any[] = [];
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-muted-foreground">Gastos</div>
        <h1 className="text-2xl font-semibold">Registrar gasto</h1>
      </div>

      <ExpenseCreateForm
  businesses={businesses}
  userId={userId}
/>
    </div>
  );
}
