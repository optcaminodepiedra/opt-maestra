"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package, Check, X, AlertCircle, Truck, Clock, CheckCircle2,
  PackageOpen, AlertTriangle, FileText, Printer, Edit2,
  Sparkles, Home, Coffee, UtensilsCrossed, User as UserIcon,
  Calendar, Building2, MessageSquare,
} from "lucide-react";
import Link from "next/link";
import {
  approveRequisition, rejectRequisition,
  markRequisitionDelivered, confirmRequisitionReceipt,
} from "@/lib/requisitions.actions";

type Item = {
  id: string;
  itemName: string | null;     // del catálogo
  freeTextName: string | null; // texto libre
  unit: string;
  qtyRequested: number;
  qtyDelivered: number | null;
  notDeliveredReason: string | null;
  estimatedPriceCents: number;
  note: string | null;
  isFreeText: boolean;
};

type Requisition = {
  id: string;
  title: string;
  status: string;
  kind: string;
  eventName: string | null;
  isPrivate: boolean;
  priority: string;
  urgentNote: string | null;
  requiresSeparatePayment: boolean;
  note: string | null;
  neededBy: string | null;
  createdAt: string;
  businessName: string;
  createdByName: string;
  createdById: string;
  deliveredByName: string | null;
  deliveredAt: string | null;
  deliveryNote: string | null;
  receivedByName: string | null;
  receivedAt: string | null;
  receivedSignature: string | null;
  items: Item[];
  payable: { id: string; status: string; amountCents: number } | null;
};

type Props = {
  requisition: Requisition;
  viewerId: string;
  viewerRole: string;
  canApprove: boolean;
  canDeliver: boolean;
  canConfirmReceipt: boolean;
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
  DRAFT:            { label: "Borrador",        cls: "bg-gray-100 text-gray-700 border-gray-200",   icon: Clock },
  SUBMITTED:        { label: "Por aprobar",     cls: "bg-blue-50 text-blue-700 border-blue-200",    icon: Clock },
  APPROVED:         { label: "Aprobada",        cls: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  REJECTED:         { label: "Rechazada",       cls: "bg-red-50 text-red-700 border-red-200",       icon: X },
  ORDERED:          { label: "En compra",       cls: "bg-purple-50 text-purple-700 border-purple-200", icon: Truck },
  RECEIVED_PARTIAL: { label: "Entrega parcial", cls: "bg-orange-50 text-orange-700 border-orange-200", icon: AlertTriangle },
  RECEIVED:         { label: "Entregada",       cls: "bg-teal-50 text-teal-700 border-teal-200",    icon: PackageOpen },
  CLOSED:           { label: "Cerrada",         cls: "bg-gray-50 text-gray-600 border-gray-200",    icon: CheckCircle2 },
};

const KIND_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  RESTAURANT:      { label: "Restaurante",  icon: UtensilsCrossed, color: "text-blue-600" },
  SPECIAL_EVENT:   { label: "Especial",     icon: Sparkles,        color: "text-purple-600" },
  OWNER_HOUSE:     { label: "Casa NS",      icon: Home,            color: "text-amber-600" },
  VENDING_MACHINE: { label: "Dispensadora", icon: Coffee,          color: "text-green-600" },
  GENERAL:         { label: "General",      icon: Package,         color: "text-muted-foreground" },
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

export function RequisitionDetailClient({
  requisition: req,
  viewerId,
  canApprove,
  canDeliver,
  canConfirmReceipt,
}: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Modo de aprobación / rechazo
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Modo de marcar entrega
  const [deliveryMode, setDeliveryMode] = useState(false);
  const [deliveryLines, setDeliveryLines] = useState<
    Record<string, { qtyDelivered: number; notDeliveredReason: string }>
  >(
    Object.fromEntries(
      req.items.map((it) => [
        it.id,
        {
          qtyDelivered: it.qtyDelivered ?? it.qtyRequested,
          notDeliveredReason: it.notDeliveredReason ?? "",
        },
      ])
    )
  );
  const [deliveryNote, setDeliveryNote] = useState("");

  // Modo de confirmar recepción (firma)
  const [confirmMode, setConfirmMode] = useState(false);
  const [signature, setSignature] = useState("");

  const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.DRAFT;
  const StatusIcon = cfg.icon;
  const kindCfg = KIND_CONFIG[req.kind] ?? KIND_CONFIG.GENERAL;
  const KindIcon = kindCfg.icon;

  const totalEst = req.items.reduce(
    (sum, it) => sum + it.qtyRequested * it.estimatedPriceCents, 0
  );
  const totalDelivered = req.items.reduce(
    (sum, it) => sum + (it.qtyDelivered ?? 0) * it.estimatedPriceCents, 0
  );

  function handleApprove() {
    setError(null);
    start(async () => {
      try {
        await approveRequisition({ requisitionId: req.id });
        window.location.reload();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleReject() {
    if (!rejectReason.trim()) return setError("Indica el motivo del rechazo.");
    setError(null);
    start(async () => {
      try {
        await rejectRequisition({ requisitionId: req.id, reason: rejectReason });
        window.location.reload();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleSubmitDelivery() {
    setError(null);
    // Validar que las líneas con qty parcial tengan razón
    for (const it of req.items) {
      const line = deliveryLines[it.id];
      if (line.qtyDelivered < it.qtyRequested && !line.notDeliveredReason.trim()) {
        const itemName = it.freeTextName ?? it.itemName ?? "Producto";
        return setError(`Indica la razón para "${itemName}" (entregaste menos de lo solicitado).`);
      }
    }

    start(async () => {
      try {
        await markRequisitionDelivered({
          requisitionId: req.id,
          deliveryNote: deliveryNote || undefined,
          lines: req.items.map((it) => ({
            requisitionItemId: it.id,
            qtyDelivered: deliveryLines[it.id].qtyDelivered,
            notDeliveredReason: deliveryLines[it.id].notDeliveredReason || undefined,
          })),
        });
        window.location.reload();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleConfirmReceipt() {
    if (!signature.trim()) return setError("Escribe tu nombre como firma de recepción.");
    setError(null);
    start(async () => {
      try {
        await confirmRequisitionReceipt({ requisitionId: req.id, signature });
        window.location.reload();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {req.priority === "URGENT" && (
                  <Badge variant="destructive" className="text-xs">🚨 URGENTE</Badge>
                )}
                <Badge variant="outline" className={`${kindCfg.color}`}>
                  <KindIcon className="w-3 h-3 mr-0.5" />
                  {kindCfg.label}
                </Badge>
                {req.isPrivate && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    🔒 Privada
                  </Badge>
                )}
                <Badge variant="outline" className={cfg.cls}>
                  <StatusIcon className="w-3 h-3 mr-0.5" />
                  {cfg.label}
                </Badge>
              </div>
              <CardTitle className="text-xl">{req.title}</CardTitle>
              {req.eventName && (
                <p className="text-sm text-purple-700 mt-1">
                  <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                  Evento: <span className="font-medium">{req.eventName}</span>
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/app/inventory/requisitions/${req.id}/print`} target="_blank">
                <Printer className="w-4 h-4 mr-1.5" /> Imprimir
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <Info icon={<UserIcon className="w-3.5 h-3.5" />} label="Solicitado por" value={req.createdByName} />
            <Info icon={<Building2 className="w-3.5 h-3.5" />} label="Negocio" value={req.businessName} />
            <Info icon={<Calendar className="w-3.5 h-3.5" />} label="Creada" value={new Date(req.createdAt).toLocaleString("es-MX")} />
            {req.neededBy && (
              <Info icon={<Calendar className="w-3.5 h-3.5" />} label="Necesaria para" value={new Date(req.neededBy).toLocaleDateString("es-MX")} />
            )}
          </div>

          {req.urgentNote && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-semibold text-red-700 mb-0.5">Razón de urgencia</p>
              <p className="text-sm">{req.urgentNote}</p>
            </div>
          )}

          {req.note && (
            <div className="mt-3 p-3 bg-muted/30 border rounded-lg">
              <p className="text-xs font-semibold mb-0.5 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Notas
              </p>
              <p className="text-sm whitespace-pre-line">{req.note}</p>
            </div>
          )}

          {req.requiresSeparatePayment && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-700">💳 Pago aparte</p>
              {req.payable ? (
                <p className="text-sm mt-1">
                  Cuenta por pagar:{" "}
                  <span className="font-medium">{fmt(req.payable.amountCents)}</span>
                  {" — "}
                  <Badge variant="outline" className="text-[10px]">
                    {req.payable.status === "PAID" ? "✓ Pagada" :
                     req.payable.status === "PENDING" ? "⏳ Pendiente" :
                     req.payable.status === "OVERDUE" ? "⚠️ Vencida" : "Cancelada"}
                  </Badge>
                </p>
              ) : (
                <p className="text-sm mt-1 text-muted-foreground">
                  Se generará una cuenta por pagar al aprobar.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Acciones según estado y rol */}
      {req.status === "SUBMITTED" && canApprove && (
        <Card>
          <CardContent className="py-4 space-y-3">
            {!showRejectForm ? (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRejectForm(true)} disabled={pending}>
                  <X className="w-4 h-4 mr-1" /> Rechazar
                </Button>
                <Button onClick={handleApprove} disabled={pending}>
                  <Check className="w-4 h-4 mr-1" /> Aprobar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo del rechazo</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background resize-none"
                  placeholder="Explica por qué no se aprueba..."
                  disabled={pending}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => { setShowRejectForm(false); setRejectReason(""); }} disabled={pending}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={handleReject} disabled={pending}>
                    {pending ? "Rechazando..." : "Confirmar rechazo"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Items + modo entrega */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Productos ({req.items.length})
              {totalEst > 0 && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  · Est. {fmt(totalEst)}
                </span>
              )}
            </CardTitle>

            {(req.status === "APPROVED" || req.status === "ORDERED") && canDeliver && !deliveryMode && (
              <Button size="sm" onClick={() => setDeliveryMode(true)}>
                <Truck className="w-3.5 h-3.5 mr-1" /> Marcar entrega
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-semibold uppercase text-muted-foreground bg-muted/30">
              <div className="col-span-5">Producto</div>
              <div className="col-span-2 text-center">Solicitado</div>
              <div className="col-span-2 text-center">Entregado</div>
              <div className="col-span-3 text-right">Subtotal</div>
            </div>

            {req.items.map((it) => {
              const itemName = it.isFreeText ? it.freeTextName : it.itemName;
              const isPartial = it.qtyDelivered != null && it.qtyDelivered < it.qtyRequested;
              const subtotal = it.qtyRequested * it.estimatedPriceCents;
              const subtotalDelivered = (it.qtyDelivered ?? 0) * it.estimatedPriceCents;

              return (
                <div key={it.id} className="px-4 py-3">
                  <div className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-5 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {itemName ?? "Producto"}
                        {it.isFreeText && (
                          <Badge variant="outline" className="text-[9px] ml-1.5">
                            Libre
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {it.unit}
                        {it.estimatedPriceCents > 0 && ` · ${fmt(it.estimatedPriceCents)} c/u`}
                      </p>
                      {it.note && (
                        <p className="text-xs italic text-muted-foreground mt-0.5">{it.note}</p>
                      )}
                    </div>

                    <div className="col-span-2 text-center">
                      <p className="text-sm font-bold">{it.qtyRequested}</p>
                    </div>

                    <div className="col-span-2 text-center">
                      {deliveryMode ? (
                        <input
                          type="number"
                          min={0}
                          max={it.qtyRequested}
                          value={deliveryLines[it.id].qtyDelivered}
                          onChange={(e) =>
                            setDeliveryLines((prev) => ({
                              ...prev,
                              [it.id]: { ...prev[it.id], qtyDelivered: parseInt(e.target.value) || 0 },
                            }))
                          }
                          className="w-16 h-8 px-2 border rounded text-center text-sm"
                          disabled={pending}
                        />
                      ) : it.qtyDelivered != null ? (
                        <div>
                          <p className={`text-sm font-bold ${isPartial ? "text-orange-600" : "text-green-600"}`}>
                            {it.qtyDelivered}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">—</p>
                      )}
                    </div>

                    <div className="col-span-3 text-right">
                      <p className="text-sm font-medium">{fmt(subtotal)}</p>
                      {it.qtyDelivered != null && isPartial && (
                        <p className="text-xs text-orange-600">
                          Real: {fmt(subtotalDelivered)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Razón para entrega parcial (en delivery mode o ya guardada) */}
                  {deliveryMode &&
                    deliveryLines[it.id].qtyDelivered < it.qtyRequested && (
                      <div className="mt-2 ml-0">
                        <input
                          type="text"
                          placeholder="Razón por la que no entregaste todo..."
                          value={deliveryLines[it.id].notDeliveredReason}
                          onChange={(e) =>
                            setDeliveryLines((prev) => ({
                              ...prev,
                              [it.id]: { ...prev[it.id], notDeliveredReason: e.target.value },
                            }))
                          }
                          className="w-full h-8 px-3 border rounded text-xs bg-amber-50/30 border-amber-200"
                          disabled={pending}
                        />
                      </div>
                    )}

                  {!deliveryMode && it.notDeliveredReason && (
                    <div className="mt-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded text-xs">
                      <span className="font-medium">Razón:</span> {it.notDeliveredReason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Submit delivery */}
      {deliveryMode && (
        <Card className="border-primary">
          <CardContent className="py-4 space-y-3">
            <div>
              <label className="text-sm font-medium block mb-1">Nota general de entrega (opcional)</label>
              <textarea
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                rows={2}
                placeholder="Comentarios sobre la entrega..."
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background resize-none"
                disabled={pending}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeliveryMode(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={handleSubmitDelivery} disabled={pending}>
                <Truck className="w-4 h-4 mr-1" />
                {pending ? "Guardando..." : "Confirmar entrega"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info de entrega */}
      {req.deliveredAt && req.deliveredByName && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-green-600" />
              Entregado por {req.deliveredByName}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(req.deliveredAt).toLocaleString("es-MX")}
            </p>
            {req.deliveryNote && (
              <p className="text-sm mt-2 p-2 bg-muted/30 rounded">{req.deliveryNote}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmación de recepción */}
      {(req.status === "RECEIVED" || req.status === "RECEIVED_PARTIAL") &&
        canConfirmReceipt &&
        !confirmMode && (
          <Card className="border-primary">
            <CardContent className="py-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">¿Recibiste todo correctamente?</p>
                <p className="text-xs text-muted-foreground">
                  Confirma con tu firma para cerrar la requisición.
                </p>
              </div>
              <Button onClick={() => setConfirmMode(true)}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Confirmar
              </Button>
            </CardContent>
          </Card>
        )}

      {confirmMode && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <label className="text-sm font-medium block">Tu firma (escribe tu nombre completo)</label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Nombre completo"
              className="w-full h-10 px-3 border rounded-lg text-sm bg-background"
              disabled={pending}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setConfirmMode(false); setSignature(""); }} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmReceipt} disabled={pending}>
                {pending ? "Guardando..." : "Firmar y cerrar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {req.receivedSignature && req.receivedAt && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Recibido y firmado por {req.receivedByName}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(req.receivedAt).toLocaleString("es-MX")}
            </p>
            <p className="text-sm mt-2 p-2 bg-muted/30 rounded font-medium italic">
              Firma: {req.receivedSignature}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}
