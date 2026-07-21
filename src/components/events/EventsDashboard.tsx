import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  LockKeyhole,
  MapPin,
  Search,
  Users,
} from "lucide-react";

import { KpiCard } from "@/components/analytics/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  EventDashboardData,
  EventDashboardFilters,
  EventDashboardRow,
  EventRangeFilter,
} from "@/lib/events.queries";

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  DRAFT: {
    label: "Borrador",
    className: "bg-slate-50 text-slate-700 border-slate-200",
    icon: FileText,
  },
  TENTATIVE: {
    label: "Tentativo",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock3,
  },
  CONFIRMED: {
    label: "Confirmado",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: CheckCircle2,
  },
  IN_PROGRESS: {
    label: "En curso",
    className: "bg-purple-50 text-purple-700 border-purple-200",
    icon: CalendarClock,
  },
  COMPLETED: {
    label: "Finalizado",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  CANCELED: {
    label: "Cancelado",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: Clock3,
  },
};

const RANGE_OPTIONS: { value: EventRangeFilter; label: string }[] = [
  { value: "upcoming", label: "Próximos" },
  { value: "next7", label: "7 días" },
  { value: "next30", label: "30 días" },
  { value: "past", label: "Historial" },
  { value: "all", label: "Todos" },
];

function buildHref(
  current: EventDashboardFilters,
  changes: Partial<EventDashboardFilters>
): string {
  const next = { ...current, ...changes };
  const params = new URLSearchParams();

  if (next.range !== "upcoming") params.set("range", next.range);
  if (next.q) params.set("q", next.q);
  if (next.businessId !== "all") params.set("businessId", next.businessId);
  if (next.status !== "all") params.set("status", next.status);

  const query = params.toString();
  return query ? `/app/events?${query}` : "/app/events";
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function eventLocation(event: EventDashboardRow): string {
  return event.locationBusiness?.name || event.locationName || event.business.name;
}

function peopleLabel(event: EventDashboardRow): string {
  if (event.confirmedGuests > 0) return `${event.confirmedGuests} confirmadas`;
  if (event.estimatedGuests > 0) return `${event.estimatedGuests} estimadas`;
  return "Sin definir";
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`text-[10px] ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function RequirementBadge({ event }: { event: EventDashboardRow }) {
  if (event.requirementsTotal === 0) {
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        Sin requerimientos
      </Badge>
    );
  }

  if (event.requirementsPending > 0) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
      >
        {event.requirementsPending} pendiente(s)
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
    >
      <CheckCircle2 className="h-3 w-3" />
      Todo listo
    </Badge>
  );
}

export function EventsDashboard({ data }: { data: EventDashboardData }) {
  const { filters, businesses, stats, events } = data;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Eventos</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Consulta fechas, sedes, personas, requerimientos y requisiciones asociadas.
          </p>
        </div>

        <Badge variant="secondary" className="w-fit">
          {events.length} evento(s) en la vista
        </Badge>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Próximos 7 días"
          value={String(stats.next7)}
          icon={<CalendarClock className="h-4 w-4 text-blue-600" />}
          color="blue"
          subtitle="eventos activos"
        />
        <KpiCard
          label="Próximos 30 días"
          value={String(stats.next30)}
          icon={<CalendarDays className="h-4 w-4 text-purple-600" />}
          color="purple"
          subtitle="eventos activos"
        />
        <KpiCard
          label="Personas próximas"
          value={new Intl.NumberFormat("es-MX").format(stats.guestsNext30)}
          icon={<Users className="h-4 w-4 text-green-600" />}
          color="green"
          subtitle="confirmadas o estimadas"
        />
        <KpiCard
          label="Requerimientos pendientes"
          value={String(stats.pendingRequirements)}
          icon={<ClipboardCheck className="h-4 w-4 text-amber-600" />}
          color="amber"
          subtitle="en eventos futuros"
        />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={filters.range === option.value ? "default" : "outline"}
                size="sm"
                asChild
              >
                <Link href={buildHref(filters, { range: option.value })}>
                  {option.label}
                </Link>
              </Button>
            ))}
          </div>

          <form action="/app/events" method="get" className="grid gap-3 md:grid-cols-12">
            {filters.range !== "upcoming" && (
              <input type="hidden" name="range" value={filters.range} />
            )}

            <div className="relative md:col-span-5">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={filters.q}
                placeholder="Buscar evento, tipo, lugar o contacto..."
                className="pl-9"
              />
            </div>

            <select
              name="businessId"
              defaultValue={filters.businessId}
              className="md:col-span-3 h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="all">Todos mis negocios</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>

            <select
              name="status"
              defaultValue={filters.status}
              className="md:col-span-2 h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="all">Todos los estados</option>
              {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                <option key={value} value={value}>
                  {config.label}
                </option>
              ))}
            </select>

            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" className="flex-1">
                Aplicar
              </Button>
              <Button variant="outline" asChild>
                <Link href="/app/events">Limpiar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/35 mx-auto mb-3" />
            <h2 className="text-base font-semibold">No hay eventos en esta vista</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Ajusta los filtros o cambia el rango de fechas. La creación y edición de eventos se
              agregará en la siguiente entrega.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden md:block">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Agenda de eventos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Fecha</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Lugar</TableHead>
                    <TableHead>Personas</TableHead>
                    <TableHead>Requerimientos</TableHead>
                    <TableHead>Requisiciones</TableHead>
                    <TableHead className="pr-6">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="pl-6 align-top whitespace-nowrap">
                        <p className="text-sm font-medium capitalize">{formatDate(event.startsAt)}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(event.startsAt)}</p>
                      </TableCell>
                      <TableCell className="align-top min-w-[220px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium">{event.title}</p>
                          {event.isPrivate && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-amber-50 text-amber-700 border-amber-200"
                            >
                              <LockKeyhole className="h-3 w-3" /> Privado
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {event.eventType || "Tipo sin definir"}
                          {event.responsibleUser
                            ? ` · Responsable: ${event.responsibleUser.fullName}`
                            : " · Sin responsable"}
                        </p>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-start gap-1.5 text-sm">
                          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <span>{eventLocation(event)}</span>
                        </div>
                        {event.locationBusiness && event.locationBusiness.id !== event.business.id && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Organiza: {event.business.name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-sm">{peopleLabel(event)}</TableCell>
                      <TableCell className="align-top">
                        <RequirementBadge event={event} />
                      </TableCell>
                      <TableCell className="align-top">
                        {event.requisitionsCount > 0 ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                          >
                            <FileText className="h-3 w-3" />
                            {event.requisitionsCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin requisición</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 align-top">
                        <StatusBadge status={event.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="md:hidden space-y-3">
            {events.map((event) => (
              <Card key={event.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="font-semibold truncate">{event.title}</h2>
                        {event.isPrivate && (
                          <LockKeyhole className="h-3.5 w-3.5 text-amber-600" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {event.eventType || "Tipo sin definir"}
                      </p>
                    </div>
                    <StatusBadge status={event.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha</p>
                      <p className="font-medium capitalize">{formatDate(event.startsAt)}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(event.startsAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Personas</p>
                      <p className="font-medium">{peopleLabel(event)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5 text-sm">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>{eventLocation(event)}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <RequirementBadge event={event} />
                    {event.requisitionsCount > 0 ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                      >
                        <FileText className="h-3 w-3" />
                        {event.requisitionsCount} requisición(es)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Sin requisición
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {event.responsibleUser
                      ? `Responsable: ${event.responsibleUser.fullName}`
                      : "Sin responsable asignado"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
