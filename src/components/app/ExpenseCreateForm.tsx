"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createExpense } from "@/lib/expenses.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Biz = { id: string; name: string };

function moneyPreview(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export function ExpenseCreateForm({
  businesses,
  userId,
}: {
  businesses: Biz[];
  userId: string;
}) {

  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const firstBizId = businesses?.[0]?.id || "";
  const isSingleBiz = businesses.length <= 1;

  const [businessId, setBusinessId] = useState(firstBizId);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const amountNumber = useMemo(() => Number(amount), [amount]);

  function submit() {
    setError(null);

    startTransition(async () => {
      try {
        await createExpense({
  businessId,
  userId,
  amount: amountNumber,
  category,
  note,
});


        // limpia y manda a lista
        router.push("/app/manager/expenses");
        router.refresh();
      } catch (e: any) {
        setError(e?.message || "Error al guardar.");
      }
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Nuevo gasto</CardTitle>
        <div className="text-xs text-muted-foreground">
          Registra una salida de dinero (compra, insumo, caja chica, proveedor, etc.)
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
            {error}
          </div>
        ) : null}

        {/* Unidad */}
        <div className="space-y-2">
          <Label>Unidad</Label>
          {isSingleBiz ? (
            <div className="h-10 rounded-md border bg-muted/30 px-3 flex items-center text-sm">
              {businesses?.[0]?.name ?? "—"}
            </div>
          ) : (
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              disabled={isPending}
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Monto */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Monto (MXN)</Label>
            <Input
              inputMode="decimal"
              placeholder="Ej. 350"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPending}
            />
            <div className="text-xs text-muted-foreground">
              Vista: <span className="tabular-nums">{moneyPreview(amount)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoría</Label>
            <Input
              placeholder="Ej. Insumos / Caja chica / Compras urgentes"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isPending}
            />
            <div className="text-xs text-muted-foreground">
              Tip: usa categorías consistentes para tus reportes.
            </div>
          </div>
        </div>

        {/* Nota */}
        <div className="space-y-2">
          <Label>Nota (opcional)</Label>
          <textarea
            className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Ej. Hielo, agua, proveedor X, etc."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/app/manager/expenses")}
            disabled={isPending}
          >
            Cancelar
          </Button>

          <Button onClick={submit} disabled={isPending || !businessId}>
            {isPending ? "Guardando..." : "Guardar gasto"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
