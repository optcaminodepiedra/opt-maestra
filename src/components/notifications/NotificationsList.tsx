"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, BellOff, CheckCircle2, AlertCircle, Package, FileText,
  CreditCard, PackageCheck, PackageX, AlertTriangle, ExternalLink,
} from "lucide-react";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/notifications.actions";

type Notif = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
  relatedEntityType?: string | null;
};

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  PAYMENT_DUE:           { icon: CreditCard,      color: "text-amber-600",   bg: "bg-amber-50" },
  PAYMENT_OVERDUE:       { icon: AlertTriangle,   color: "text-red-600",     bg: "bg-red-50" },
  REQUISITION_NEW:       { icon: Package,         color: "text-blue-600",    bg: "bg-blue-50" },
  REQUISITION_APPROVED:  { icon: CheckCircle2,    color: "text-green-600",   bg: "bg-green-50" },
  REQUISITION_REJECTED:  { icon: PackageX,        color: "text-red-600",     bg: "bg-red-50" },
  REQUISITION_DELIVERED: { icon: PackageCheck,    color: "text-green-600",   bg: "bg-green-50" },
  REQUISITION_PARTIAL:   { icon: AlertCircle,     color: "text-amber-600",   bg: "bg-amber-50" },
  STOCK_LOW:             { icon: AlertTriangle,   color: "text-orange-600",  bg: "bg-orange-50" },
  GENERAL:               { icon: Bell,            color: "text-gray-600",    bg: "bg-gray-50" },
};

export function NotificationsList({ notifications: initial }: { notifications: Notif[] }) {
  const [pending, start] = useTransition();
  const [items, setItems] = useState(initial);

  const unreadCount = items.filter((n) => !n.isRead).length;

  function markRead(id: string) {
    start(async () => {
      try {
        await markNotificationRead(id);
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
      } catch (err) {
        console.error(err);
      }
    });
  }

  function markAll() {
    start(async () => {
      try {
        await markAllNotificationsRead();
        setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      } catch (err) {
        console.error(err);
      }
    });
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          <BellOff className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          No tienes notificaciones.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg">
          <p className="text-sm">
            <span className="font-medium">{unreadCount}</span> notificación(es) sin leer
          </p>
          <Button size="sm" variant="outline" onClick={markAll} disabled={pending}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Marcar todas como leídas
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {items.map((n) => {
          const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.GENERAL;
          const Icon = cfg.icon;
          return (
            <Card
              key={n.id}
              className={`hover:bg-muted/20 transition-colors ${n.isRead ? "opacity-60" : ""}`}
            >
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${n.isRead ? "" : "font-semibold"} truncate`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                          Nueva
                        </Badge>
                      )}
                    </div>
                    {n.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString("es-MX", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {n.linkUrl && (
                        <Link
                          href={n.linkUrl}
                          className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                          onClick={() => !n.isRead && markRead(n.id)}
                        >
                          Ver detalle <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      )}
                      {!n.isRead && !n.linkUrl && (
                        <button
                          className="text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() => markRead(n.id)}
                          disabled={pending}
                        >
                          Marcar leída
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
