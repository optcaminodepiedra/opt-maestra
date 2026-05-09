import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function POSOrderPlaceholder({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { orderId } = await params;

  const order = await prisma.restaurantOrder.findUnique({
    where: { id: orderId },
    include: {
      table: { select: { name: true, area: true, businessId: true } },
      user: { select: { fullName: true } },
      items: {
        include: { menuItem: { select: { name: true, category: true } } },
      },
    },
  });

  if (!order) notFound();

  const total = order.items.reduce((s, i) => s + i.qty * i.priceCents, 0);
  const fmt = (cents: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4 pb-24 md:pb-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/app/restaurant/tables?businessId=${order.table?.businessId ?? ""}`}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver a mesas
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart className="w-7 h-7 text-orange-500" />
          Mesa {order.table?.name ?? "?"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {order.table?.area} · Mesero: {order.user?.fullName}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">POS — Orden #{order.id.slice(-8).toUpperCase()}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
            <p className="font-medium text-blue-900">🚧 POS rediseñado en construcción</p>
            <p className="text-xs text-blue-800 mt-1">
              La interfaz completa del POS llega en Fase 8B. Por ahora ves la orden y vuelves a mesas.
            </p>
          </div>

          {order.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Esta orden está vacía. La interfaz completa permitirá agregar productos.
            </p>
          ) : (
            <div className="border rounded-lg divide-y">
              {order.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium">{it.qty}× {it.menuItem.name}</p>
                    {it.note && <p className="text-xs text-muted-foreground italic">"{it.note}"</p>}
                  </div>
                  <p className="text-sm font-medium">{fmt(it.qty * it.priceCents)}</p>
                </div>
              ))}
              <div className="p-3 flex items-center justify-between bg-muted/30">
                <p className="text-sm font-bold">Total</p>
                <p className="text-base font-bold">{fmt(total)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
