"use client";

import { useMemo, useState, useTransition } from "react";
import { createWithdrawal, decideWithdrawal } from "@/lib/withdrawals.actions";
import { WithdrawalStatus } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function money(n: number) {
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n ?? 0);
  } catch {
    return `$${Number(n ?? 0).toFixed(2)}`;
  }
}

function statusBadge(status: WithdrawalStatus) {
  if (status === "REQUESTED") return <Badge variant="secondary" className="rounded-xl">Solicitado</Badge>;
  if (status === "APPROVED") return <Badge className="rounded-xl">Aprobado</Badge>;
  return <Badge variant="destructive" className="rounded-xl">Rechazado</Badge>;
}

function canApprove(role: string) {
  return role === "MASTER_ADMIN" || role === "OWNER" || role === "SUPERIOR" || role === "MANAGER";
}

type Biz = { id: string; name: string };

type Row = {
  id: string;
  businessId: string;
  amountCents: number;
  reason: string | null;
  status: WithdrawalStatus;
  createdAt: Date;
  decidedAt: Date | null;
  business: { id: string; name: string };
  requestedBy: { id: string; fullName: string };
  approvedBy: { id: string; fullName: string } | null;
};

export function WithdrawalsClient({
  role,
  currentUserId,
  businesses,
  initialWithdrawals,
}: {
  role: string;
  currentUserId: string;
  businesses: Biz[];
  initialWithdrawals: Row[];
}) {
  const [pending, start] = useTransition();

  const [filterBusinessId, setFilterBusinessId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [openNew, setOpenNew] = useState(false);
  const [newBusinessId, setNewBusinessId] = useState<string>(businesses[0]?.id ?? "");
  const [newAmount, setNewAmount] = useState<string>("");
  const [newReason, setNewReason] = useState<string>("");

  const [rows, setRows] = useState<Row[]>(initialWithdrawals ?? []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const okBiz = filterBusinessId === "all" ? true : r.businessId === filterBusinessId;
      const okStatus = filterStatus === "all" ? true : r.status === (filterStatus as any);
      return okBiz && okStatus;
    });
  }, [rows, filterBusinessId, filterStatus]);

  const totals = useMemo(() => {
    const requested = filtered.filter((r) => r.status === "REQUESTED").reduce((s, r) => s + r.amountCents, 0);
    const approved = filtered.filter((r) => r.status === "APPROVED").reduce((s, r) => s + r.amountCents, 0);
    const rejected = filtered.filter((r) => r.status === "REJECTED").reduce((s, r) => s + r.amountCents, 0);
    return {
      requested: requested / 100,
      approved: approved / 100,
      rejected: rejected / 100,
    };
  }, [filtered]);

  async function onCreate() {
    const amt = Number(newAmount);
    if (!newBusinessId) return alert("Selecciona unidad");
    if (!Number.isFinite(amt) || amt <= 0) return alert("Monto inválido");

    start(async () => {
      try {
        const id = await createWithdrawal({
          businessId: newBusinessId,
          amount: amt,
          reason: newReason,
          requestedById: currentUserId,
        });

        // refresco “optimista”: no reconsulto, agrego arriba
        const biz = businesses.find((b) => b.id === newBusinessId);
        setRows((prev) => [
          {
            id,
            businessId: newBusinessId,
            amountCents: Math.round(amt * 100),
            reason: newReason?.trim() || null,
            status: "REQUESTED",
            createdAt: new Date(),
            decidedAt: null,
            business: { id: newBusinessId, name: biz?.name ?? "—" },
            requestedBy: { id: currentUserId, fullName: "Yo" },
            approvedBy: null,
          } as any,
          ...prev,
        ]);

        setOpenNew(false);
        setNewAmount("");
        setNewReason("");
      } catch (e: any) {
        alert(e?.message ?? "Error creando retiro");
      }
    });
  }

  async function onDecide(withdrawalId: string, status: "APPROVED" | "REJECTED") {
    if (!canApprove(role)) return alert("No tienes permisos para aprobar/rechazar");

    start(async () => {
      try {
        await decideWithdrawal({
          withdrawalId,
          status,
          approvedById: currentUserId,
        });

        setRows((prev) =>
          prev.map((r) =>
            r.id === withdrawalId
              ? ({
                  ...r,
                  status: status === "APPROVED" ? "APPROVED" : "REJECTED",
                  decidedAt: new Date(),
                  approvedBy: { id: currentUserId, fullName: "Yo" } as any,
                } as any)
              : r
          )
        );
      } catch (e: any) {
        alert(e?.message ?? "Error actualizando retiro");
      }
    });
  }

  // Paleta (la tuya) para hacerlo visual
  const palette = {
    wine: "#590F0F",
    olive: "#706513",
    amber: "#B57114",
    brick: "#962B09",
    sand: "#D9C7B8",
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border" style={{ background: `linear-gradient(135deg, ${palette.amber}12, ${palette.sand}55)` }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Solicitados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" style={{ color: palette.amber }}>
              {money(totals.requested)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border" style={{ background: `linear-gradient(135deg, ${palette.olive}12, ${palette.sand}55)` }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Aprobados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" style={{ color: palette.olive }}>
              {money(totals.approved)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border" style={{ background: `linear-gradient(135deg, ${palette.brick}12, ${palette.sand}55)` }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Rechazados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" style={{ color: palette.brick }}>
              {money(totals.rejected)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros + Nuevo */}
      <Card className="rounded-2xl border bg-card/80">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-xl">Unidad</Badge>
              <Select value={filterBusinessId} onValueChange={setFilterBusinessId}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Badge variant="secondary" className="rounded-xl ml-2">Estatus</Badge>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="REQUESTED">Solicitado</SelectItem>
                  <SelectItem value="APPROVED">Aprobado</SelectItem>
                  <SelectItem value="REJECTED">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button disabled={pending} style={{ backgroundColor: palette.wine }} className="rounded-xl">
                  + Nuevo retiro
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Nuevo retiro</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Unidad</div>
                    <Select value={newBusinessId} onValueChange={setNewBusinessId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona unidad" />
                      </SelectTrigger>
                      <SelectContent>
                        {businesses.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Monto (MXN)</div>
                      <Input
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        placeholder="Ej. 8000"
                        inputMode="decimal"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Estatus</div>
                      <Input value="Solicitado (automático)" disabled />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Motivo / Nota</div>
                    <Textarea
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                      placeholder="Ej. Pago proveedor, compra urgente, etc."
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setOpenNew(false)} disabled={pending}>
                      Cancelar
                    </Button>
                    <Button onClick={onCreate} disabled={pending} style={{ backgroundColor: palette.wine }}>
                      Guardar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card className="rounded-2xl border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Movimientos</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr className="text-left">
                  <th className="px-4 py-3">Unidad</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Estatus</th>
                  <th className="px-4 py-3">Solicita</th>
                  <th className="px-4 py-3">Aprueba</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((r) => {
                  const amount = r.amountCents / 100;
                  const isPending = r.status === "REQUESTED";
                  return (
                    <tr key={r.id} className="border-b">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.business?.name ?? "—"}</div>
                        {r.reason ? <div className="text-xs text-muted-foreground line-clamp-1">{r.reason}</div> : null}
                      </td>

                      <td className="px-4 py-3 font-semibold" style={{ color: palette.wine }}>
                        {money(amount)}
                      </td>

                      <td className="px-4 py-3">{statusBadge(r.status)}</td>

                      <td className="px-4 py-3">{r.requestedBy?.fullName ?? "—"}</td>

                      <td className="px-4 py-3">{r.approvedBy?.fullName ?? "—"}</td>

                      <td className="px-4 py-3">
                        <div>{new Date(r.createdAt).toLocaleString()}</div>
                        {r.decidedAt ? (
                          <div className="text-xs text-muted-foreground">
                            Decidido: {new Date(r.decidedAt).toLocaleString()}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canApprove(role) && isPending ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() => onDecide(r.id, "REJECTED")}
                                className="rounded-xl"
                              >
                                Rechazar
                              </Button>
                              <Button
                                size="sm"
                                disabled={pending}
                                onClick={() => onDecide(r.id, "APPROVED")}
                                className="rounded-xl"
                                style={{ backgroundColor: palette.olive }}
                              >
                                Aprobar
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                      No hay retiros para los filtros seleccionados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
