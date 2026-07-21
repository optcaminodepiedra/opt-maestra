import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  MapPin,
  Plus,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUpcomingEventsCardData } from "@/lib/events.queries";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  TENTATIVE: "Tentativo",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Finalizado",
  CANCELED: "Cancelado",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-50 text-slate-700 border-slate-200",
  TENTATIVE: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
  IN_PROGRESS: "bg-purple-50 text-purple-700 border-purple-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELED: "bg-red-50 text-red-700 border-red-200",
};

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
  }).format(date);
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    month: "short",
  })
    .format(date)
    .replace(".", "")
    .toUpperCase();
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function eventLocation(event: {
  locationName: string | null;
  business: { name: string };
  locationBusiness: { name: string } | null;
}) {
  if (event.locationName && event.locationBusiness) {
    return `${event.locationName} · ${event.locationBusiness.name}`;
  }
  return event.locationName || event.locationBusiness?.name || event.business.name;
}

/**
 * Tarjeta global de próximos eventos.
 * El componente captura sus propios errores para que una falla del módulo de
 * eventos nunca derribe el dashboard principal de ningún rol.
 */
export async function UpcomingEventsCard() {
  try {
    const data = await getUpcomingEventsCardData(4);

    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                Próximos eventos
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Agenda general de todos los negocios.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="whitespace-nowrap">
                {data.next30} en 30 días
              </Badge>
              {data.canCreateEvents && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/app/events/new">
                    <Plus className="h-3.5 w-3.5" />
                    Nuevo
                  </Link>
                </Button>
              )}
              <Button size="sm" asChild>
                <Link href="/app/events">
                  Ver agenda
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {data.events.length === 0 ? (
            <div className="mx-4 mb-4 rounded-lg border border-dashed p-5 text-center">
              <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium">No hay eventos próximos</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cuando se registre uno aparecerá aquí automáticamente.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {data.events.map((event) => {
                const guests =
                  event.confirmedGuests > 0
                    ? event.confirmedGuests
                    : event.estimatedGuests;

                return (
                  <Link
                    key={event.id}
                    href={`/app/events/${event.id}`}
                    className="group flex gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-lg border bg-muted/40 flex flex-col items-center justify-center shrink-0 leading-none">
                      <span className="text-lg font-bold">{formatDay(event.startsAt)}</span>
                      <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                        {formatMonth(event.startsAt)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                            {event.title}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {formatLongDate(event.startsAt)} · {formatTime(event.startsAt)} h
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 ${STATUS_STYLES[event.status] ?? STATUS_STYLES.DRAFT}`}
                        >
                          {STATUS_LABELS[event.status] ?? event.status}
                        </Badge>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{eventLocation(event)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {guests > 0 ? `${guests} personas` : "Personas por definir"}
                        </span>
                        {event.responsibleUser && (
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="h-3.5 w-3.5" />
                            {event.responsibleUser.fullName}
                          </span>
                        )}
                        {(event.requirementsPending > 0 || event.requisitionsCount > 0) && (
                          <span
                            className={`inline-flex items-center gap-1 ${
                              event.requirementsPending > 0 ? "text-amber-700" : ""
                            }`}
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                            {event.requirementsPending > 0
                              ? `${event.requirementsPending} requerimiento(s) pendiente(s)`
                              : `${event.requisitionsCount} requisición(es)`}
                          </span>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="h-4 w-4 self-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:block" />
                  </Link>
                );
              })}
            </div>
          )}

          {data.totalUpcoming > data.events.length && (
            <div className="border-t px-4 py-2.5 text-center">
              <Link
                href="/app/events"
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver los {data.totalUpcoming} eventos próximos
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    );
  } catch (error) {
    console.error("[UpcomingEventsCard] No se pudo cargar el resumen de eventos", error);

    return (
      <Card>
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-lg bg-muted p-2 shrink-0">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Eventos temporalmente no disponibles</p>
              <p className="text-xs text-muted-foreground">
                El resto del dashboard continúa funcionando con normalidad.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/events">Abrir eventos</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
}
