"use client";

import * as React from "react";
import { PaymentMethod } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSale } from "@/lib/sales.actions";

type Business = {
  id: string;
  name: string;
  cashpoints: { id: string; name: string }[];
};

type User = { id: string; fullName: string };

export function CreateSaleDialog({
  businesses,
  users,
  defaultUserId,
}: {
  businesses: Business[];
  users: User[];
  defaultUserId?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [businessId, setBusinessId] = React.useState<string>(businesses[0]?.id ?? "");
  const cashpoints = React.useMemo(
    () => businesses.find((b) => b.id === businessId)?.cashpoints ?? [],
    [businessId, businesses]
  );
  const [cashpointId, setCashpointId] = React.useState<string>(cashpoints[0]?.id ?? "");

  React.useEffect(() => {
    setCashpointId(cashpoints[0]?.id ?? "");
  }, [businessId]); // recalcula caja al cambiar unidad

  const [userId, setUserId] = React.useState<string>(defaultUserId ?? users[0]?.id ?? "");
  const [method, setMethod] = React.useState<PaymentMethod>(PaymentMethod.CASH);
  const [concept, setConcept] = React.useState<string>("");
  const [amount, setAmount] = React.useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createSale({
        businessId,
        cashpointId,
        userId,
        method,
        concept,
        amount: Number(amount),
      });
      setOpen(false);
      setConcept("");
      setAmount("");
      setMethod(PaymentMethod.CASH);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Agregar venta</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Nueva venta</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Unidad</Label>
              <Select value={businessId} onValueChange={setBusinessId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona unidad" />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Caja</Label>
              <Select value={cashpointId} onValueChange={setCashpointId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona caja" />
                </SelectTrigger>
                <SelectContent>
                  {cashpoints.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PaymentMethod.CASH}>Efectivo</SelectItem>
                  <SelectItem value={PaymentMethod.CARD}>Tarjeta</SelectItem>
                  <SelectItem value={PaymentMethod.TRANSFER}>Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Usuario</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona usuario" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Concepto</Label>
              <Input
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder='Ej. "Restaurante", "Barra", "Hospedaje"...'
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Monto (MXN)</Label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej. 1860"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={loading} type="submit">
              {loading ? "Guardando..." : "Guardar venta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
