"use client";

import { useState } from "react";
import { createExpense } from "@/lib/expenses.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ExpenseForm({
  defaultBusinessId,
  defaultUserId,
  businesses,
}: {
  defaultBusinessId: string;
  defaultUserId: string;
  businesses: Array<{ id: string; name: string }>;
}) {
  const [businessId, setBusinessId] = useState(defaultBusinessId);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);

    try {
      await createExpense({
        businessId,
        userId: defaultUserId,
        amount: Number(amount),
        category,
        note,
      });

      setAmount("");
      setCategory("");
      setNote("");
      setMsg("Gasto registrado ✅");
    } catch (err: any) {
      setMsg(err?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle>Captura de gasto</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Unidad</Label>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Monto (MXN)</Label>
            <Input
              inputMode="decimal"
              placeholder="Ej. 320"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Categoría</Label>
            <Input
              placeholder="Ej. Caja chica / Compras urgentes"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Nota (opcional)</Label>
            <Input
              placeholder="Ej. Hielo / insumo"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button disabled={saving} type="submit">
              {saving ? "Guardando..." : "Guardar gasto"}
            </Button>
            {msg ? <div className="text-sm text-muted-foreground">{msg}</div> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
