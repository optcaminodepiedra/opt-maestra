"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChefHat, Clock, Check, CheckCircle2, Volume2, VolumeX,
  RefreshCw, AlertCircle, Coffee, Utensils, Filter, StickyNote, X,
} from "lucide-react";
import { markItemReady, markItemDelivered, markOrderReady } from "@/lib/kds.actions";

type KDSItem = {
  id: string;
  name: string;
  category: string;
  station: "KITCHEN" | "BAR" | "NONE";
  qty: number;
  note: string | null;
  kitchenStatus: string;
};

type KDSOrder = {
  id: string;
  tableName: string;
  tableArea: string | null;
  mesero: string;
  note: string | null;
  openedAt: string;
  minutesElapsed: number;
  itemCount: number;
  allReady: boolean;
  anyPreparing: boolean;
  items: KDSItem[];
};

type Props = {
  businessId: string;
  station: "KITCHEN" | "BAR" | "ALL";
  initialOrders: KDSOrder[];
};

export function KDSClient({ businessId, station, initialOrders }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [orders, setOrders] = useState(initialOrders);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevOrderIds = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Sync con server
  useEffect(() => {
    setOrders(initialOrders);
    // Detectar nuevas órdenes para sonido
    const currentIds = new Set(initialOrders.map((o) => o.id));
    const newOrders = initialOrders.filter((o) => !prevOrderIds.current.has(o.id));
    if (newOrders.length > 0 && soundEnabled) {
      playNotificationSound();
    }
    prevOrderIds.current = currentIds;
  }, [initialOrders]);

  // Auto-refresh cada 8 segundos
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(interval);
  }, [autoRefresh, router]);

  // Sonido (Web Audio API)
  function playNotificationSound() {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);

      // Segundo beep
      setTimeout(() => {
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.connect(g2);
        g2.connect(ctx.destination);
        o2.frequency.value = 1000;
        g2.gain.setValueAtTime(0.3, ctx.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        o2.start();
        o2.stop(ctx.currentTime + 0.3);
      }, 200);
    } catch (err) {
      // Audio API no disponible
    }
  }

  // ─── Acciones ────────────────────────────────────────────────

  function handleItemReady(itemId: string) {
    // Optimistic
    setOrders((prev) =>
      prev.map((o) => ({
        ...o,
        items: o.items.map((i) =>
          i.id === itemId ? { ...i, kitchenStatus: "READY" } : i
        ),
      }))
    );
    markItemReady(itemId)
      .then(() => router.refresh())
      .catch((err: any) => { setError(err.message); router.refresh(); });
  }

  function handleItemDelivered(itemId: string) {
    setOrders((prev) =>
      prev.map((o) => ({
        ...o,
        items: o.items.filter((i) => i.id !== itemId), // sale del KDS
      })).filter((o) => o.items.length > 0)
    );
    markItemDelivered(itemId)
      .then(() => router.refresh())
      .catch((err: any) => { setError(err.message); router.refresh(); });
  }

  function handleOrderReady(orderId: string) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, items: o.items.map((i) => ({ ...i, kitchenStatus: "READY" })), allReady: true }
          : o
      )
    );
    markOrderReady({ orderId, station })
      .then(() => router.refresh())
      .catch((err: any) => { setError(err.message); router.refresh(); });
  }

  // ─── UI ──────────────────────────────────────────────────────

  const stationLabel = station === "KITCHEN" ? "Cocina" : station === "BAR" ? "Barra" : "Todo";
  const stationIcon = station === "KITCHEN" ? Utensils : station === "BAR" ? Coffee : ChefHat;

  return (
    <div className="space-y-4">
      {/* Header con controles */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={station === "ALL" ? "default" : "outline"}
            onClick={() => router.push(`/app/restaurant/kds?businessId=${businessId}`)}
          >
            <ChefHat className="w-3.5 h-3.5 mr-1" /> Todo ({orders.length})
          </Button>
          <Button
            size="sm"
            variant={station === "KITCHEN" ? "default" : "outline"}
            onClick={() => router.push(`/app/restaurant/kds?businessId=${businessId}&station=KITCHEN`)}
          >
            <Utensils className="w-3.5 h-3.5 mr-1" /> Cocina
          </Button>
          <Button
            size="sm"
            variant={station === "BAR" ? "default" : "outline"}
            onClick={() => router.push(`/app/restaurant/kds?businessId=${businessId}&station=BAR`)}
          >
            <Coffee className="w-3.5 h-3.5 mr-1" /> Barra
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={soundEnabled ? "secondary" : "outline"}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Sonido al llegar nueva orden"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </Button>
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="h-3 w-3" />
            Auto-refresh
          </label>
          <Button size="sm" variant="ghost" onClick={() => router.refresh()} disabled={pending}>
            <RefreshCw className={`w-3.5 h-3.5 ${pending ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Cards de órdenes */}
      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ChefHat className="w-16 h-16 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">Sin órdenes pendientes</p>
            <p className="text-sm mt-1">Las órdenes aparecerán aquí cuando los meseros las envíen a cocina</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onItemReady={handleItemReady}
              onItemDelivered={handleItemDelivered}
              onOrderReady={() => handleOrderReady(order.id)}
              pending={pending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

function OrderCard({
  order, onItemReady, onItemDelivered, onOrderReady, pending,
}: {
  order: KDSOrder;
  onItemReady: (id: string) => void;
  onItemDelivered: (id: string) => void;
  onOrderReady: () => void;
  pending: boolean;
}) {
  // Color según urgencia
  let urgencyClasses = "border-green-300 bg-green-50";
  let urgencyDot = "bg-green-500";
  let urgencyText = "text-green-700";
  if (order.minutesElapsed >= 15) {
    urgencyClasses = "border-red-400 bg-red-50";
    urgencyDot = "bg-red-500 animate-pulse";
    urgencyText = "text-red-700";
  } else if (order.minutesElapsed >= 8) {
    urgencyClasses = "border-amber-300 bg-amber-50";
    urgencyDot = "bg-amber-500";
    urgencyText = "text-amber-700";
  }

  const hasPreparingItems = order.items.some((i) => i.kitchenStatus === "PREPARING");

  return (
    <Card className={`border-2 ${urgencyClasses}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${urgencyDot}`} />
              Mesa {order.tableName}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {order.tableArea} · {order.mesero}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold ${urgencyText} flex items-center gap-1`}>
              <Clock className="w-4 h-4" />
              {order.minutesElapsed}m
            </div>
            <Badge variant="outline" className="text-[10px] mt-0.5">
              {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
        {order.note && (
          <p className="text-xs italic bg-amber-100 border border-amber-300 rounded p-1.5 mt-2 flex items-start gap-1">
            <StickyNote className="w-3 h-3 shrink-0 mt-0.5" />
            {order.note}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {order.items.map((item) => (
          <div
            key={item.id}
            className={`
              border rounded-lg p-2.5 bg-background
              ${item.kitchenStatus === "READY" ? "opacity-60" : ""}
            `}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold leading-tight">
                  <span className="text-orange-600">{item.qty}×</span> {item.name}
                </p>
                {item.note && (
                  <p className="text-xs text-amber-700 italic mt-1 flex items-center gap-1">
                    <StickyNote className="w-3 h-3" />
                    {item.note}
                  </p>
                )}
                {item.station === "BAR" && (
                  <Badge variant="outline" className="text-[9px] mt-1 bg-purple-50 text-purple-700 border-purple-200">
                    🍸 Barra
                  </Badge>
                )}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-1 mt-2">
              {item.kitchenStatus === "PREPARING" && (
                <Button
                  size="sm"
                  className="flex-1 h-9 bg-blue-600 hover:bg-blue-700"
                  onClick={() => onItemReady(item.id)}
                  disabled={pending}
                >
                  <Check className="w-4 h-4 mr-1" /> Listo
                </Button>
              )}
              {item.kitchenStatus === "READY" && (
                <Button
                  size="sm"
                  className="flex-1 h-9 bg-green-600 hover:bg-green-700"
                  onClick={() => onItemDelivered(item.id)}
                  disabled={pending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Entregado
                </Button>
              )}
            </div>
          </div>
        ))}

        {/* Botón global: marcar todo listo */}
        {hasPreparingItems && order.items.length > 1 && (
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2 h-9"
            onClick={onOrderReady}
            disabled={pending}
          >
            <CheckCircle2 className="w-4 h-4 mr-1" /> Marcar TODO listo
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
