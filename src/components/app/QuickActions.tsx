"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Wallet, Receipt, ArrowDownToLine, ClipboardList } from "lucide-react";

export function QuickActions() {
  return (
    <div className="hidden md:flex items-center gap-2">
      <Button asChild className="gap-2">
        <Link href="/app/owner/sales">
          <Wallet className="h-4 w-4" />
          Venta
        </Link>
      </Button>

      <Button asChild variant="secondary" className="gap-2">
        <Link href="/app/ops/expense">
          <Receipt className="h-4 w-4" />
          Gasto
        </Link>
      </Button>

      <Button asChild variant="outline" className="gap-2">
        <Link href="/app/owner/withdrawals">
          <ArrowDownToLine className="h-4 w-4" />
          Retiro
        </Link>
      </Button>

      <Button asChild variant="outline" className="gap-2">
        <Link href="/app/ops/kanban/activities">
          <ClipboardList className="h-4 w-4" />
          Task
        </Link>
      </Button>
    </div>
  );
}
