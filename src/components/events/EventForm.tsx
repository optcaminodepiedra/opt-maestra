"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  LockKeyhole,
  MapPin,
  Plus,
  PackagePlus,
  Save,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";

import { createEvent, updateEvent } from "@/lib/events.actions";
import type {
  CreateEventInput,
  EventCreateData,
  EventFormInitialData,
  EventPaymentStatusValue,
  EventPaymentTimingValue,
  EventRequirementInput,
  EventStatusCreateValue,
  UpdateEventInput,
} from "@/lib/events.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LocalizedDateTimeField } from "@/components/events/LocalizedDateTimeField";

const CONTROL_CLASS =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const STATUS_OPTIONS: Array<{ value: EventStatusCreateValue; label: string }> = [
  { value: "DRAFT", label: "Borrador" },
  { value: "TENTATIVE", label: "Tentativo" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "IN_PROGRESS", label: "En curso" },
  { value: "COMPLETED", label: "Finalizado" },
  { value: "CANCELED", label: "Cancelado" },
];

const PAYMENT_TIMING_OPTIONS: Array<{
  value: EventPaymentTimingValue;
  label: string;
}> = [
  { value: "NOT_DEFINED", label: "Por definir" },
  { value: "BEFORE_EVENT", label: "Antes del evento" },
  { value: "AT_EVENT", label: "Al momento / durante el evento" },
  { value: "AFTER_EVENT", label: "Después del evento" },
  { value: "PARTIAL", label: "Anticipo y liquidación" },
  { value: "NO_CHARGE", label: "Sin cobro" },
];

const PAYMENT_STATUS_OPTIONS: Array<{
  value: EventPaymentStatusValue;
  label: string;
}> = [
  { value: "PENDING", label: "Pendiente" },
  { value: "PARTIAL", label: "Pago parcial" },
  { value: "PAID", label: "Pagado" },
  { value: "NOT_REQUIRED", label: "No aplica" },
];

const REQUISITION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Enviada",
  APPROVED: "Aprobada",
  ORDERED: "Ordenada",
  RECEIVED_PARTIAL: "Recibida parcial",
  RECEIVED: "Recibida",
};

const REQUISITION_KIND_LABELS: Record<string, string> = {
  RESTAURANT: "Restaurante",
  SPECIAL_EVENT: "Evento especial",
  OWNER_HOUSE: "Casa de dueño",
  VENDING_MACHINE: "Máquina expendedora",
  GENERAL: "General",
};

type RequirementDraft = EventRequirementInput & { key: string };

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function initialStart(): string {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return toLocalInput(date);
}

function addLocalHours(value: string, hours: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0,
    0
  );
  date.setHours(date.getHours() + hours);
  return toLocalInput(date);
}

function localDateTimeNumber(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0,
    0
  ).getTime();
}

function money(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNeededBy(value: string | null): string {
  if (!value) return "Sin fecha límite";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function EventForm({
  data,
  initialEvent,
}: {
  data: EventCreateData;
  initialEvent?: EventFormInitialData;
}) {
  const router = useRouter();
  const isEditing = Boolean(initialEvent);
  const initialStartValue = initialEvent?.startsAtLocal || initialStart();
  const initialEndValue = initialEvent?.endsAtLocal || addLocalHours(initialStartValue, 2);
  const submitIntent = React.useRef<"save" | "requisition">("save");

  const [title, setTitle] = React.useState(initialEvent?.title ?? "");
  const [eventType, setEventType] = React.useState(initialEvent?.eventType ?? "");
  const [status, setStatus] = React.useState<EventStatusCreateValue>(initialEvent?.status ?? "DRAFT");
  const [businessId, setBusinessId] = React.useState(initialEvent?.businessId ?? data.defaultBusinessId);

  const [startsAtLocal, setStartsAtLocal] = React.useState(initialStartValue);
  const [endsAtLocal, setEndsAtLocal] = React.useState(initialEndValue);
  const [endTouched, setEndTouched] = React.useState(Boolean(initialEvent?.endsAtLocal));
  const [locationBusinessId, setLocationBusinessId] = React.useState(initialEvent?.locationBusinessId ?? data.defaultBusinessId);
  const [locationName, setLocationName] = React.useState(initialEvent?.locationName ?? "");
  const [locationAddress, setLocationAddress] = React.useState(initialEvent?.locationAddress ?? "");

  const [estimatedGuests, setEstimatedGuests] = React.useState(String(initialEvent?.estimatedGuests ?? 0));
  const [confirmedGuests, setConfirmedGuests] = React.useState(String(initialEvent?.confirmedGuests ?? 0));
  const [contactName, setContactName] = React.useState(initialEvent?.contactName ?? "");
  const [contactPhone, setContactPhone] = React.useState(initialEvent?.contactPhone ?? "");
  const [contactEmail, setContactEmail] = React.useState(initialEvent?.contactEmail ?? "");

  const [responsibleUserId, setResponsibleUserId] = React.useState(initialEvent?.responsibleUserId ?? data.creator.id);
  const [description, setDescription] = React.useState(initialEvent?.description ?? "");
  const [internalNotes, setInternalNotes] = React.useState(initialEvent?.internalNotes ?? "");
  const [isPrivate, setIsPrivate] = React.useState(initialEvent?.isPrivate ?? false);

  const [paymentTiming, setPaymentTiming] =
    React.useState<EventPaymentTimingValue>(initialEvent?.paymentTiming ?? "NOT_DEFINED");
  const [paymentStatus, setPaymentStatus] =
    React.useState<EventPaymentStatusValue>(initialEvent?.paymentStatus ?? "PENDING");
  const [quotedAmount, setQuotedAmount] = React.useState(String(initialEvent?.quotedAmount ?? 0));
  const [paidAmount, setPaidAmount] = React.useState(String(initialEvent?.paidAmount ?? 0));
  const [paymentDueLocal, setPaymentDueLocal] = React.useState(initialEvent?.paymentDueLocal ?? "");
  const [paymentNotes, setPaymentNotes] = React.useState(initialEvent?.paymentNotes ?? "");

  const [requirements, setRequirements] = React.useState<RequirementDraft[]>(
    () =>
      (initialEvent?.requirements ?? []).map((requirement, index) => ({
        ...requirement,
        key: requirement.id || `existing-${index}`,
      }))
  );
  const [selectedRequisitionIds, setSelectedRequisitionIds] = React.useState<string[]>(
    initialEvent?.requisitionIds ?? []
  );
  const [requisitionSearch, setRequisitionSearch] = React.useState("");
  const [onlyOrganizerBusiness, setOnlyOrganizerBusiness] = React.useState(true);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (locationBusinessId && !data.businesses.some((business) => business.id === locationBusinessId)) {
      setLocationBusinessId("");
    }
  }, [data.businesses, locationBusinessId]);

  React.useEffect(() => {
    if (paymentTiming === "NO_CHARGE") {
      setPaymentStatus("NOT_REQUIRED");
      setQuotedAmount("0");
      setPaidAmount("0");
      setPaymentDueLocal("");
    } else if (paymentStatus === "NOT_REQUIRED") {
      setPaymentStatus("PENDING");
    }
  }, [paymentTiming, paymentStatus]);

  const quoted = Number(quotedAmount || 0);
  const paid = Number(paidAmount || 0);
  const balance = Math.max(0, (Number.isFinite(quoted) ? quoted : 0) - (Number.isFinite(paid) ? paid : 0));

  const visibleRequisitions = React.useMemo(() => {
    const query = requisitionSearch.trim().toLowerCase();
    return data.requisitions.filter((requisition) => {
      if (onlyOrganizerBusiness && requisition.business.id !== businessId) return false;
      if (!query) return true;
      return [
        requisition.title,
        requisition.business.name,
        REQUISITION_STATUS_LABELS[requisition.status] ?? requisition.status,
        REQUISITION_KIND_LABELS[requisition.kind] ?? requisition.kind,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [businessId, data.requisitions, onlyOrganizerBusiness, requisitionSearch]);

  function handleStartChange(value: string) {
    setStartsAtLocal(value);
    if (!endTouched && value) {
      setEndsAtLocal(addLocalHours(value, 2));
    }
  }

  function handleEndChange(value: string) {
    setEndTouched(true);
    setEndsAtLocal(value);
  }

  function handleBusinessChange(nextBusinessId: string) {
    if (locationBusinessId === businessId) {
      setLocationBusinessId(nextBusinessId);
    }
    setBusinessId(nextBusinessId);
  }

  function addRequirement() {
    setRequirements((current) => [
      ...current,
      {
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        category: "",
        description: "",
        quantity: null,
        unit: "",
        responsibleUserId: responsibleUserId || "",
        neededByLocal: "",
        notes: "",
      },
    ]);
  }

  function updateRequirement(key: string, patch: Partial<RequirementDraft>) {
    setRequirements((current) =>
      current.map((requirement) =>
        requirement.key === key ? { ...requirement, ...patch } : requirement
      )
    );
  }

  function removeRequirement(key: string) {
    setRequirements((current) => current.filter((requirement) => requirement.key !== key));
  }

  function toggleRequisition(id: string) {
    setSelectedRequisitionIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const intent = submitIntent.current;
      submitIntent.current = "save";

      const startNumber = localDateTimeNumber(startsAtLocal);
      const endNumber = endsAtLocal ? localDateTimeNumber(endsAtLocal) : null;
      if (startNumber === null) {
        setError("Selecciona una fecha y hora de inicio válidas.");
        return;
      }
      if (endsAtLocal && endNumber === null) {
        setError("Selecciona una fecha y hora de término válidas.");
        return;
      }
      if (endNumber !== null && endNumber < startNumber) {
        setError("La fecha y hora de término deben ser posteriores al inicio.");
        return;
      }

      const payload: CreateEventInput = {
        title,
        eventType,
        status,
        businessId,
        locationBusinessId: locationBusinessId || undefined,
        locationName,
        locationAddress,
        startsAtLocal,
        endsAtLocal: endsAtLocal || undefined,
        estimatedGuests: Number(estimatedGuests || 0),
        confirmedGuests: Number(confirmedGuests || 0),
        contactName,
        contactPhone,
        contactEmail,
        responsibleUserId: responsibleUserId || undefined,
        description,
        internalNotes,
        isPrivate,
        paymentTiming,
        paymentStatus,
        quotedAmount: Number(quotedAmount || 0),
        paidAmount: Number(paidAmount || 0),
        paymentDueLocal: paymentDueLocal || undefined,
        paymentNotes,
        requisitionIds: selectedRequisitionIds,
        requirements: requirements.map(({ key: _key, ...requirement }) => requirement),
      };

      const result = initialEvent
        ? await updateEvent({ ...payload, id: initialEvent.id } as UpdateEventInput)
        : await createEvent(payload);

      if (!result.ok) {
        setError(result.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (intent === "requisition") {
        const returnTo = `/app/events/${result.eventId}`;
        const params = new URLSearchParams({
          kind: "SPECIAL_EVENT",
          businessId,
          eventId: result.eventId,
          returnTo,
        });
        router.push(`/app/inventory/requisitions/new?${params.toString()}`);
      } else {
        router.push(`/app/events/${result.eventId}?${isEditing ? "updated=1" : "created=1"}`);
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el evento.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-1">
            <Link href={initialEvent ? `/app/events/${initialEvent.id}` : "/app/events"}>
              <ArrowLeft className="h-4 w-4" />
              {initialEvent ? "Volver al evento" : "Volver a eventos"}
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{initialEvent ? "Editar evento" : "Nuevo evento"}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {initialEvent ? "Actualiza la información operativa sin perder requisiciones ni requerimientos existentes." : "Registra la información operativa, responsable, pagos, requerimientos y requisiciones."}
          </p>
        </div>

        <Button type="submit" disabled={saving} className="w-full sm:w-auto" onClick={() => { submitIntent.current = "save"; }}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Guardando..." : initialEvent ? "Guardar cambios" : "Guardar evento"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Información general
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="event-title">Nombre del evento *</Label>
                <Input
                  id="event-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ej. Boda Martínez, cena empresarial o recorrido privado"
                  maxLength={160}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="event-type">Tipo de evento</Label>
                  <Input
                    id="event-type"
                    value={eventType}
                    onChange={(event) => setEventType(event.target.value)}
                    placeholder="Ej. Boda, corporativo, cumpleaños"
                    list="event-types"
                    maxLength={100}
                  />
                  <datalist id="event-types">
                    <option value="Boda" />
                    <option value="Evento empresarial" />
                    <option value="Cena privada" />
                    <option value="Cumpleaños" />
                    <option value="Recorrido privado" />
                    <option value="Hospedaje de grupo" />
                    <option value="Sesión fotográfica" />
                    <option value="Conferencia" />
                  </datalist>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-status">Estado inicial</Label>
                  <select
                    id="event-status"
                    className={CONTROL_CLASS}
                    value={status}
                    onChange={(event) => setStatus(event.target.value as EventStatusCreateValue)}
                  >
                    {STATUS_OPTIONS.filter((option) => isEditing || ["DRAFT", "TENTATIVE", "CONFIRMED"].includes(option.value)).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-business">Negocio responsable *</Label>
                <select
                  id="event-business"
                  className={CONTROL_CLASS}
                  value={businessId}
                  onChange={(event) => handleBusinessChange(event.target.value)}
                >
                  {data.businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Es la unidad que organiza y dará seguimiento al evento, aunque la sede sea otra.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción pública u operativa</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Objetivo, dinámica, servicios contratados o información general..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Fecha y lugar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="starts-at">Inicio *</Label>
                  <LocalizedDateTimeField
                    id="starts-at"
                    value={startsAtLocal}
                    onChange={handleStartChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ends-at">Término</Label>
                  <LocalizedDateTimeField
                    id="ends-at"
                    value={endsAtLocal}
                    onChange={handleEndChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location-business">Sede dentro de la operadora</Label>
                <select
                  id="location-business"
                  className={CONTROL_CLASS}
                  value={locationBusinessId}
                  onChange={(event) => setLocationBusinessId(event.target.value)}
                >
                  <option value="">Lugar externo / sin negocio asociado</option>
                  {data.businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="location-name">Área o nombre específico del lugar</Label>
                  <Input
                    id="location-name"
                    value={locationName}
                    onChange={(event) => setLocationName(event.target.value)}
                    placeholder="Ej. Terraza, salón, jardín o Explanada Alhóndiga"
                    maxLength={180}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location-address">Dirección o indicaciones</Label>
                  <Input
                    id="location-address"
                    value={locationAddress}
                    onChange={(event) => setLocationAddress(event.target.value)}
                    placeholder="Dirección, acceso o punto de encuentro"
                    maxLength={300}
                  />
                </div>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="estimated-guests">Personas estimadas</Label>
                  <Input
                    id="estimated-guests"
                    type="number"
                    min="0"
                    max="100000"
                    value={estimatedGuests}
                    onChange={(event) => setEstimatedGuests(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmed-guests">Personas confirmadas</Label>
                  <Input
                    id="confirmed-guests"
                    type="number"
                    min="0"
                    max="100000"
                    value={confirmedGuests}
                    onChange={(event) => setConfirmedGuests(event.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Contacto principal</Label>
                  <Input
                    id="contact-name"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    placeholder="Nombre"
                    maxLength={160}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Teléfono</Label>
                  <Input
                    id="contact-phone"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                    placeholder="WhatsApp o teléfono"
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Correo</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    placeholder="correo@ejemplo.com"
                    maxLength={160}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Requerimientos iniciales
                </CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addRequirement}>
                  <Plus className="h-4 w-4" />
                  Agregar requerimiento
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {requirements.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <ClipboardList className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-medium mt-2">Sin requerimientos capturados</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Puedes agregar mobiliario, cocina, barra, hospedaje, transporte, audio o cualquier pendiente.
                  </p>
                </div>
              ) : (
                requirements.map((requirement, index) => (
                  <div key={requirement.key} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Requerimiento {index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRequirement(requirement.key)}
                        aria-label={`Eliminar requerimiento ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Categoría</Label>
                        <Input
                          value={requirement.category ?? ""}
                          onChange={(event) =>
                            updateRequirement(requirement.key, { category: event.target.value })
                          }
                          placeholder="Ej. Mobiliario"
                          list="requirement-categories"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Descripción *</Label>
                        <Input
                          value={requirement.description}
                          onChange={(event) =>
                            updateRequirement(requirement.key, { description: event.target.value })
                          }
                          placeholder="Ej. Preparar 15 mesas con mantel"
                        />
                      </div>
                    </div>
                    <datalist id="requirement-categories">
                      <option value="Mobiliario" />
                      <option value="Cocina" />
                      <option value="Barra" />
                      <option value="Hospedaje" />
                      <option value="Personal" />
                      <option value="Transporte" />
                      <option value="Audio e iluminación" />
                      <option value="Decoración" />
                      <option value="Experiencias" />
                    </datalist>

                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Cantidad</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={requirement.quantity ?? ""}
                          onChange={(event) =>
                            updateRequirement(requirement.key, {
                              quantity: event.target.value ? Number(event.target.value) : null,
                            })
                          }
                          placeholder="15"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unidad</Label>
                        <Input
                          value={requirement.unit ?? ""}
                          onChange={(event) =>
                            updateRequirement(requirement.key, { unit: event.target.value })
                          }
                          placeholder="pzas, mesas, personas"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Responsable</Label>
                        <select
                          className={CONTROL_CLASS}
                          value={requirement.responsibleUserId ?? ""}
                          onChange={(event) =>
                            updateRequirement(requirement.key, {
                              responsibleUserId: event.target.value,
                            })
                          }
                        >
                          <option value="">Sin asignar</option>
                          {data.responsibleUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Necesario para</Label>
                        <LocalizedDateTimeField
                          value={requirement.neededByLocal ?? ""}
                          onChange={(value) =>
                            updateRequirement(requirement.key, { neededByLocal: value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Notas</Label>
                        <Input
                          value={requirement.notes ?? ""}
                          onChange={(event) =>
                            updateRequirement(requirement.key, { notes: event.target.value })
                          }
                          placeholder="Proveedor, medidas o indicaciones"
                        />
                      </div>
                    </div>
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
                {data.canCreateRequisition && (
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => { submitIntent.current = "requisition"; }}
                  >
                    <PackagePlus className="h-4 w-4" />
                    {initialEvent ? "Guardar y pedir cosas" : "Guardar y crear requisición"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="requisition-search">Buscar requisición</Label>
                  <Input
                    id="requisition-search"
                    value={requisitionSearch}
                    onChange={(event) => setRequisitionSearch(event.target.value)}
                    placeholder="Título, negocio, tipo o estado..."
                  />
                </div>
                <label className="flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyOrganizerBusiness}
                    onChange={(event) => setOnlyOrganizerBusiness(event.target.checked)}
                    className="h-4 w-4"
                  />
                  Solo negocio organizador
                </label>
              </div>

              {selectedRequisitionIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {selectedRequisitionIds.length} requisición(es) seleccionada(s)
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRequisitionIds([])}
                  >
                    Limpiar selección
                  </Button>
                </div>
              )}

              <div className="max-h-[360px] overflow-y-auto rounded-lg border divide-y">
                {visibleRequisitions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No hay requisiciones disponibles con estos filtros.
                  </div>
                ) : (
                  visibleRequisitions.map((requisition) => {
                    const checked = selectedRequisitionIds.includes(requisition.id);
                    return (
                      <label
                        key={requisition.id}
                        className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${
                          checked ? "bg-primary/5" : "hover:bg-muted/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRequisition(requisition.id)}
                          className="h-4 w-4 mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{requisition.title}</p>
                            <Badge variant="outline" className="text-[10px]">
                              {REQUISITION_STATUS_LABELS[requisition.status] ?? requisition.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {requisition.business.name} · {REQUISITION_KIND_LABELS[requisition.kind] ?? requisition.kind} · {formatNeededBy(requisition.neededBy)}
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {data.canCreateRequisition
                  ? "Puedes asociar requisiciones existentes o usar “Guardar y pedir cosas” para abrir una nueva requisición ligada automáticamente a este evento."
                  : "Puedes asociar requisiciones existentes. La creación de nuevas solicitudes depende de los permisos de requisiciones de tu usuario."}
              </p>
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
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Creado por</p>
                <p className="text-sm font-medium mt-1">
                  {initialEvent?.createdBy.fullName ?? data.creator.fullName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {initialEvent?.createdBy.role ?? data.creator.role}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="responsible-user">Encargado principal</Label>
                <select
                  id="responsible-user"
                  className={CONTROL_CLASS}
                  value={responsibleUserId}
                  onChange={(event) => setResponsibleUserId(event.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {data.responsibleUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <LockKeyhole className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-medium">Evento privado</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Solo dirección, creador y encargado podrán consultar sus datos sensibles.
                  </p>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal-notes">Notas internas</Label>
                <Textarea
                  id="internal-notes"
                  value={internalNotes}
                  onChange={(event) => setInternalNotes(event.target.value)}
                  placeholder="Acuerdos, pendientes delicados o instrucciones internas..."
                  rows={5}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="h-4 w-4 text-primary" />
                Condiciones de pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-timing">¿Cuándo se pagará?</Label>
                <select
                  id="payment-timing"
                  className={CONTROL_CLASS}
                  value={paymentTiming}
                  onChange={(event) =>
                    setPaymentTiming(event.target.value as EventPaymentTimingValue)
                  }
                >
                  {PAYMENT_TIMING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-status">Estado del pago</Label>
                <select
                  id="payment-status"
                  className={CONTROL_CLASS}
                  value={paymentStatus}
                  onChange={(event) =>
                    setPaymentStatus(event.target.value as EventPaymentStatusValue)
                  }
                  disabled={paymentTiming === "NO_CHARGE"}
                >
                  {PAYMENT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quoted-amount">Total cotizado</Label>
                  <Input
                    id="quoted-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={quotedAmount}
                    onChange={(event) => setQuotedAmount(event.target.value)}
                    disabled={paymentTiming === "NO_CHARGE"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paid-amount">Pagado / anticipo</Label>
                  <Input
                    id="paid-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={(event) => setPaidAmount(event.target.value)}
                    disabled={paymentTiming === "NO_CHARGE"}
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[11px] text-muted-foreground">Cotizado</p>
                  <p className="text-sm font-semibold">{money(quoted)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Pagado</p>
                  <p className="text-sm font-semibold">{money(paid)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Pendiente</p>
                  <p className="text-sm font-semibold">{money(balance)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-due">Fecha límite de pago</Label>
                <LocalizedDateTimeField
                  id="payment-due"
                  value={paymentDueLocal}
                  onChange={setPaymentDueLocal}
                  includeTime={false}
                  disabled={paymentTiming === "NO_CHARGE"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-notes">Pormenores del pago</Label>
                <Textarea
                  id="payment-notes"
                  value={paymentNotes}
                  onChange={(event) => setPaymentNotes(event.target.value)}
                  placeholder="Forma acordada, referencia, factura, quién autoriza o condiciones especiales..."
                  rows={4}
                  disabled={paymentTiming === "NO_CHARGE"}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Antes de guardar</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Revisa especialmente fecha, sede, personas, encargado y condiciones de pago.
                  </p>
                </div>
              </div>
              <Button type="submit" disabled={saving} className="w-full" onClick={() => { submitIntent.current = "save"; }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Guardando..." : initialEvent ? "Guardar cambios" : "Guardar evento"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
