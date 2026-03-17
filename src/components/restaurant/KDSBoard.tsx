"use client";

import * as React from "react";
import { KitchenStatus } from "@prisma/client";
import { setKitchenStatus } from "@/lib/restaurant.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function moneyFromCents(cents: number) {
  return (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export function KDSBoard({ items }: { items: any[] }) {
  const groups: Record<string, any[]> = {
    NEW: [],
    PREPARING: [],
    READY: [],
  };

  for (const it of items) groups[it.kitchenStatus]?.push(it);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {(["NEW", "PREPARING", "READY"] as KitchenStatus[]).map((status) => (
        <Card key={status}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {status === "NEW" ? "Nuevo" : status === "PREPARING" ? "Preparando" : "Listo"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {groups[status].length === 0 ? (
              <div className="text-sm text-muted-foreground">Sin items</div>
            ) : (
              groups[status].map((it) => (
                <div key={it.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{it.menuItem.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {moneyFromCents(it.priceCents)} × {it.qty}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground mt-1">
                    Mesa: <b>{it.order.table.name}</b> — {it.order.user.fullName}
                  </div>

                  {it.note ? (
                    <div className="text-xs mt-2 rounded-lg bg-muted/40 p-2">{it.note}</div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 mt-3">
                    {status !== "PREPARING" ? (
                      <Button size="sm" variant="outline" onClick={() => setKitchenStatus(it.id, KitchenStatus.PREPARING)}>
                        Preparar
                      </Button>
                    ) : null}

                    {status !== "READY" ? (
                      <Button size="sm" onClick={() => setKitchenStatus(it.id, KitchenStatus.READY)}>
                        Marcar listo
                      </Button>
                    ) : null}

                    <Button size="sm" variant="secondary" onClick={() => setKitchenStatus(it.id, KitchenStatus.DELIVERED)}>
                      Entregado
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
