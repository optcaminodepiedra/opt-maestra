"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Boot = {
  businesses: { id: string; name: string }[];
  businessId: string | null;
  arrivals: any[];
  departures: any[];
  inHouse: any[];
};

function mxn(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type Props = {
  boot: Boot;
  checkInReservation: (input: { reservationId: string }) => Promise<any>;
  checkOutReservation: (input: { reservationId: string }) => Promise<any>;
  onAddCharge: (input: { reservationId: string; concept: string; amount: number }) => Promise<any>;
};

export function FrontDeskManager({ boot, checkInReservation, checkOutReservation, onAddCharge }: Props) {
  const router = useRouter();
  const businesses = boot.businesses ?? [];
  const [businessId, setBusinessId] = React.useState(boot.businessId ?? "");

  function onBusinessChange(id: string) {
    setBusinessId(id);
    router.push(`/app/hotel/frontdesk?businessId=${id}`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Negocio</CardTitle>
            <Badge variant="secondary">Hoy</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Select value={businessId} onValueChange={onBusinessChange}>
            <SelectTrigger><SelectValue placeholder="Selecciona negocio" /></SelectTrigger>
            <SelectContent>
              {businesses.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Board
          title="Llegadas hoy"
          items={boot.arrivals}
          rightBadge={boot.arrivals.length}
          actions={(r) => (
            <Button
              onClick={async () => {
                await checkInReservation({ reservationId: r.id });
                router.refresh();
              }}
            >
              Check-in
            </Button>
          )}
        />

        <Board
          title="Salidas hoy"
          items={boot.departures}
          rightBadge={boot.departures.length}
          actions={(r) => (
            <Button
              onClick={async () => {
                await checkOutReservation({ reservationId: r.id });
                router.refresh();
              }}
            >
              Check-out
            </Button>
          )}
        />

        <Board
          title="Hospedados"
          items={boot.inHouse}
          rightBadge={boot.inHouse.length}
          actions={(r) => (
            <div className="flex gap-2">
              <AddChargeDialog
  reservationId={r.id}
  onAddCharge={onAddCharge}
  onSaved={() => router.refresh()}
/>
              <Button
                variant="outline"
                onClick={async () => {
                  await checkOutReservation({ reservationId: r.id });
                  router.refresh();
                }}
              >
                Check-out
              </Button>
            </div>
          )}
        />
      </div>

      <div className="text-xs text-muted-foreground">
        Siguiente upgrade: “folio” (cargos acumulados + pagos) y al cerrar folio crear Sale contable.
      </div>
    </div>
  );
}

function Board({
  title,
  items,
  rightBadge,
  actions,
}: {
  title: string;
  items: any[];
  rightBadge: number;
  actions: (r: any) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="secondary">{rightBadge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((r) => (
          <div key={r.id} className="rounded-lg border p-3 space-y-2">
            <div className="font-medium">{r.guest.fullName}</div>
            <div className="text-xs text-muted-foreground">
              {r.room.name} · {r.room.roomType.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(r.checkIn).toLocaleDateString()} → {new Date(r.checkOut).toLocaleDateString()} · Estatus {r.status}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                Total {mxn(r.totalCents)} · Depósito {mxn(r.depositCents)}
              </div>
              {actions(r)}
            </div>
          </div>
        ))}

        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nada por aquí.</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AddChargeDialog({
  reservationId,
  onSaved,
  onAddCharge,
}: {
  reservationId: string;
  onSaved: () => void;
  onAddCharge: (input: { reservationId: string; concept: string; amount: number }) => Promise<any>;
}) {
  const [open, setOpen] = React.useState(false);
  const [concept, setConcept] = React.useState("");
  const [amount, setAmount] = React.useState("0");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Cargo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar cargo</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Concepto</Label>
            <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Room service / Daños / Bar" />
          </div>

          <div className="space-y-2">
            <Label>Monto (MXN)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </div>

          <Button
            className="w-full"
            disabled={!concept.trim() || parseFloat(amount || "0") <= 0}
            onClick={async () => {
              await onAddCharge({
                reservationId,
                concept,
                amount: parseFloat(amount || "0"),
              });
              setOpen(false);
              setConcept("");
              setAmount("0");
              onSaved();
            }}
          >
            Guardar cargo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}