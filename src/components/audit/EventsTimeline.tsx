"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, X, ChevronDown, ChevronUp, MonitorSmartphone, Globe } from "lucide-react";
import { ACTION_LABELS, SEVERITY_LABELS } from "@/lib/audit-actions";

interface Event {
  id: string;
  userId: string | null;
  userName: string;
  userRole: string | null;
  businessId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  severity: string;
  summary: string;
  metadata: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface Props {
  events: Event[];
  businesses: Array<{ id: string; name: string }>;
}

const SEVERITY_STYLES: Record<string, { bar: string; badge: string; text: string }> = {
  LOW: { bar: "bg-gray-300", badge: "bg-gray-100 text-gray-700 border-gray-200", text: "text-gray-700" },
  MEDIUM: { bar: "bg-blue-400", badge: "bg-blue-50 text-blue-700 border-blue-200", text: "text-blue-700" },
  HIGH: { bar: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", text: "text-amber-700" },
  CRITICAL: { bar: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200", text: "text-red-700" },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatFullDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function browserFromUserAgent(ua: string | null) {
  if (!ua) return "—";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Safari/")) return "Safari";
  return "Otro";
}

function deviceFromUserAgent(ua: string | null) {
  if (!ua) return "—";
  if (/iPhone|iPad|Android/i.test(ua)) return "Móvil";
  return "Escritorio";
}

export default function EventsTimeline({ events, businesses }: Props) {
  const businessMap = new Map(businesses.map((b) => [b.id, b.name]));
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = showAll ? events : events.slice(0, 20);

  // Agrupar por día
  const grouped: Array<{ date: string; events: Event[] }> = [];
  let currentDate = "";
  for (const ev of visible) {
    const dStr = new Date(ev.createdAt).toLocaleDateString("es-MX", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    if (dStr !== currentDate) {
      grouped.push({ date: dStr, events: [] });
      currentDate = dStr;
    }
    grouped[grouped.length - 1].events.push(ev);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Eventos recientes
          <Badge variant="outline" className="text-[10px] ml-1">{events.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {grouped.map((group) => (
            <div key={group.date}>
              <div className="px-4 py-1.5 bg-muted/30 text-[10px] uppercase font-medium text-muted-foreground">
                {group.date}
              </div>
              <div>
                {group.events.map((ev) => {
                  const sev = SEVERITY_STYLES[ev.severity] ?? SEVERITY_STYLES.LOW;
                  const isOpen = openId === ev.id;
                  const businessName = ev.businessId ? businessMap.get(ev.businessId) : null;

                  return (
                    <div
                      key={ev.id}
                      className={`border-l-2 ${sev.bar} hover:bg-muted/20 transition`}
                    >
                      <button
                        onClick={() => setOpenId(isOpen ? null : ev.id)}
                        className="w-full text-left px-3 py-2 flex items-start gap-3"
                      >
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0 pt-0.5 w-10">
                          {formatTime(ev.createdAt)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{ev.userName}</span>
                            <Badge variant="outline" className={`text-[9px] ${sev.badge}`}>
                              {ACTION_LABELS[ev.action] ?? ev.action}
                            </Badge>
                            {businessName && (
                              <span className="text-[10px] text-muted-foreground">· {businessName}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {ev.summary}
                          </p>
                        </div>
                        {isOpen ? <ChevronUp className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />}
                      </button>

                      {isOpen && (
                        <div className="px-3 pb-3 ml-13 space-y-2 bg-muted/10">
                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                            <div>
                              <dt className="text-muted-foreground">Fecha completa</dt>
                              <dd className="font-mono">{formatFullDate(ev.createdAt)}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Acción</dt>
                              <dd className="font-mono">{ev.action}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Entidad</dt>
                              <dd className="font-mono">{ev.entity}{ev.entityId ? ` · ${ev.entityId.slice(-8)}` : ""}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Severidad</dt>
                              <dd className={`font-medium ${sev.text}`}>{SEVERITY_LABELS[ev.severity] ?? ev.severity}</dd>
                            </div>
                            {ev.ipAddress && (
                              <div>
                                <dt className="text-muted-foreground flex items-center gap-1"><Globe className="w-2.5 h-2.5" /> IP</dt>
                                <dd className="font-mono">{ev.ipAddress}</dd>
                              </div>
                            )}
                            {ev.userAgent && (
                              <div>
                                <dt className="text-muted-foreground flex items-center gap-1"><MonitorSmartphone className="w-2.5 h-2.5" /> Dispositivo</dt>
                                <dd>{browserFromUserAgent(ev.userAgent)} · {deviceFromUserAgent(ev.userAgent)}</dd>
                              </div>
                            )}
                          </dl>

                          {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground mb-1">Detalles</p>
                              <pre className="text-[10px] bg-background border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                                {JSON.stringify(ev.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {events.length > 20 && !showAll && (
          <div className="p-2 text-center border-t">
            <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="text-xs">
              Ver {events.length - 20} eventos más
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
