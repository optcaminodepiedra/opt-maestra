import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  LockKeyhole,
  Mail,
  MapPin,
  PackagePlus,
  Pencil,
  Phone,
  UserRound,
  Users,
} from "lucide-react";

import type { EventDetailData } from "@/lib/events.queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteEventButton } from "@/components/events/DeleteEventButton";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  TENTATIVE: "Tentativo",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Finalizado",
  CANCELED: "Cancelado",
};

const REQUIREMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En proceso",
  READY: "Listo",
  NOT_REQUIRED: "No requerido",
  CANCELED: "Cancelado",
};

const REQUISITION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Enviada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  ORDERED: "Ordenada",
  RECEIVED_PARTIAL: "Recibida parcial",
  RECEIVED: "Recibida",
  CLOSED: "Cerrada",
  CANCELED: "Cancelada",
};

const PAYMENT_TIMING_LABELS: Record<string, string> = {
  NOT_DEFINED: "Por definir",
  BEFORE_EVENT: "Antes del evento",
  AT_EVENT: "Al momento o durante el evento",
  AFTER_EVENT: "Después del evento",
  PARTIAL: "Anticipo y liquidación",
  NO_CHARGE: "Sin cobro",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIAL: "Pago parcial",
  PAID: "Pagado",
  NOT_REQUIRED: "No aplica",
};

function formatDateTime(date: Date | null): string {
  if (!date) return "Sin definir";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDate(date: Date | null): string {
  if (!date) return "Sin fecha límite";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(cents / 100);
}

export function EventDetail({
  data,
  created,
  updated,
}: {
  data: EventDetailData;
  created?: boolean;
  updated?: boolean;
}) {
  const { event, permissions } = data;
  const balance = Math.max(0, event.quotedAmountCents - event.paidAmountCents);
  const location = [event.locationName, event.locationBusiness?.name]
    .filter(Boolean)
    .join(" · ") || event.business.name;
  const requisitionUrl = `/app/inventory/requisitions/new?kind=SPECIAL_EVENT&businessId=${encodeURIComponent(
    event.business.id
  )}&eventId=${encodeURIComponent(event.id)}&returnTo=${encodeURIComponent(`/app/events/${event.id}`)}`;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-1">
            <Link href="/app/events">
              <ArrowLeft className="h-4 w-4" />
              Volver a eventos
            </Link>
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarClock className="h-6 w-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{event.title}</h1>
            <Badge variant="outline">{STATUS_LABELS[event.status] ?? event.status}</Badge>
            {event.isPrivate && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                <LockKeyhole className="h-3 w-3" /> Privado
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {event.eventType || "Tipo de evento sin definir"} · Organiza {event.business.name}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {permissions.canCreateRequisition && (
            <Button variant="outline" asChild>
              <Link href={requisitionUrl}>
                <PackagePlus className="h-4 w-4" />
                Pedir cosas
              </Link>
            </Button>
          )}
          {permissions.canEdit && (
            <Button asChild>
              <Link href={`/app/events/${event.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Editar
              </Link>
            </Button>
          )}
          {permissions.canDelete && (
            <DeleteEventButton eventId={event.id} eventTitle={event.title} />
          )}
        </div>
      </div>

      {(created || updated) && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {created ? "Evento guardado correctamente." : "Cambios guardados correctamente."}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Fecha y lugar
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Inicio</p>
                <p className="font-medium capitalize mt-1">{formatDateTime(event.startsAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Término</p>
                <p className="font-medium capitalize mt-1">{formatDateTime(event.endsAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sede</p>
                <p className="font-medium mt-1">{location}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dirección o indicaciones</p>
                <p className="font-medium mt-1">{event.locationAddress || "Sin indicaciones adicionales"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Personas y contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Estimadas</p>
                  <p className="text-xl font-semibold mt-1">{event.estimatedGuests}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Confirmadas</p>
                  <p className="text-xl font-semibold mt-1">{event.confirmedGuests}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-start gap-2">
                  <UserRound className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Contacto</p>
                    <p className="text-sm font-medium">{event.contactName || "Sin definir"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Teléfono</p>
                    <p className="text-sm font-medium">{event.contactPhone || "Sin definir"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Correo</p>
                    <p className="text-sm font-medium break-all">{event.contactEmail || "Sin definir"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Requerimientos
                </CardTitle>
                <Badge variant="secondary">{event.requirements.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {event.requirements.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No se capturaron requerimientos operativos.
                </div>
              ) : (
                event.requirements.map((requirement) => (
                  <div key={requirement.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{requirement.description}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {REQUIREMENT_STATUS_LABELS[requirement.status] ?? requirement.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {requirement.category || "Sin categoría"}
                          {requirement.quantity ? ` · ${requirement.quantity} ${requirement.unit || ""}` : ""}
                          {requirement.responsibleUser ? ` · ${requirement.responsibleUser.fullName}` : ""}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(requirement.neededBy)}
                      </p>
                    </div>
                    {requirement.notes && (
                      <p className="text-xs text-muted-foreground mt-2">{requirement.notes}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Requisiciones asociadas
                </CardTitle>
                {permissions.canCreateRequisition && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={requisitionUrl}>
                      <PackagePlus className="h-4 w-4" />
                      Nueva requisición
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {event.requisitions.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm font-medium">Este evento todavía no tiene requisiciones.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Usa “Pedir cosas” para solicitar productos del almacén y vincularlos automáticamente.
                  </p>
                </div>
              ) : (
                event.requisitions.map((requisition) => (
                  <Link
                    key={requisition.id}
                    href={`/app/inventory/requisitions/${requisition.id}`}
                    className="block rounded-lg border p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{requisition.title}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {REQUISITION_STATUS_LABELS[requisition.status] ?? requisition.status}
                          </Badge>
                          {requisition.priority === "URGENT" && (
                            <Badge variant="destructive" className="text-[10px]">Urgente</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {requisition.itemCount} producto(s) · Creó {requisition.createdBy.fullName} · {formatDate(requisition.neededBy)}
                        </p>
                      </div>
                      {permissions.canViewFinancials && requisition.estimatedTotalCents > 0 && (
                        <p className="text-sm font-semibold whitespace-nowrap">
                          {money(requisition.estimatedTotalCents)}
                        </p>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserRound className="h-4 w-4 text-primary" />
                Responsables
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Creado por</p>
                <p className="text-sm font-medium mt-1">{event.createdBy.fullName}</p>
                <p className="text-xs text-muted-foreground">{event.createdBy.role}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Encargado principal</p>
                <p className="text-sm font-medium mt-1">
                  {event.responsibleUser?.fullName || "Sin asignar"}
                </p>
                {event.responsibleUser && (
                  <p className="text-xs text-muted-foreground">{event.responsibleUser.role}</p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Última actualización: {formatDateTime(event.updatedAt)}
              </p>
            </CardContent>
          </Card>

          {permissions.canViewFinancials && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-primary" />
                  Pago
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Condición</p>
                  <p className="text-sm font-medium mt-1">
                    {PAYMENT_TIMING_LABELS[event.paymentTiming] ?? event.paymentTiming}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <p className="text-sm font-medium mt-1">
                    {PAYMENT_STATUS_LABELS[event.paymentStatus] ?? event.paymentStatus}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md border p-2">
                    <p className="text-[10px] text-muted-foreground">Cotizado</p>
                    <p className="text-xs font-semibold mt-1">{money(event.quotedAmountCents)}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-[10px] text-muted-foreground">Pagado</p>
                    <p className="text-xs font-semibold mt-1">{money(event.paidAmountCents)}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-[10px] text-muted-foreground">Pendiente</p>
                    <p className="text-xs font-semibold mt-1">{money(balance)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha límite</p>
                  <p className="text-sm font-medium mt-1">{formatDate(event.paymentDueAt)}</p>
                </div>
                {event.paymentNotes && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {event.paymentNotes}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pormenores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Descripción</p>
                <p className="mt-1 whitespace-pre-wrap">{event.description || "Sin descripción"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Notas internas</p>
                <p className="mt-1 whitespace-pre-wrap">{event.internalNotes || "Sin notas internas"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
