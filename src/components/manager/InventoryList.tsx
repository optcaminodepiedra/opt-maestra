import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";

type Item = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  onHandQty: number;
  minQty: number;
  lastPriceCents: number;
  supplierName: string | null;
  businessId: string;
  businessName: string;
};

type Props = {
  items: Item[];
  showBusinessColumn: boolean;   // true si el gerente ve varios negocios
  newRequisitionHref: string;    // link para pedir insumos
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

export function InventoryList({ items, showBusinessColumn, newRequisitionHref }: Props) {
  const lowStock = items.filter((i) => i.onHandQty <= i.minQty);
  const total = items.length;
  const estimatedValue = items.reduce(
    (sum, i) => sum + i.onHandQty * i.lastPriceCents,
    0
  );

  // Agrupar por categoría
  const grouped: Record<string, Item[]> = {};
  for (const it of items) {
    const cat = it.category ?? "Sin categoría";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(it);
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <Card className="py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Productos</CardTitle>
            <Package className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground">Activos en catálogo</p>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Bajo mínimo</CardTitle>
            <AlertTriangle className={`h-3.5 w-3.5 ${lowStock.length > 0 ? "text-red-500" : "text-green-500"}`} />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className={`text-xl font-bold ${lowStock.length > 0 ? "text-red-600" : ""}`}>
              {lowStock.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {lowStock.length === 0 ? "Stock óptimo" : "Necesitan reposición"}
            </p>
          </CardContent>
        </Card>

        <Card className="py-0 col-span-2 md:col-span-1">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Valor estimado</CardTitle>
            <Package className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(estimatedValue)}</div>
            <p className="text-xs text-muted-foreground">Stock × último precio</p>
          </CardContent>
        </Card>
      </div>

      {/* Call to action principal */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {lowStock.length > 0 && (
            <span className="text-red-600 font-medium">
              {lowStock.length} producto(s) requieren reposición ·{" "}
            </span>
          )}
          {total} productos en tu catálogo
        </p>
        <Button size="sm" asChild>
          <Link href={newRequisitionHref}>
            <Plus className="w-4 h-4 mr-1.5" /> Nueva requisición
          </Link>
        </Button>
      </div>

      {/* Lista agrupada por categoría */}
      {total === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No hay productos en tu catálogo. Contacta con el almacenista para agregar productos.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([cat, catItems]) => (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{cat}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {catItems.length} producto(s)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {catItems.map((it) => {
                  const isLow = it.onHandQty <= it.minQty;
                  return (
                    <div
                      key={it.id}
                      className="flex items-center justify-between px-4 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{it.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {it.sku && `${it.sku} · `}
                          Stock: {it.onHandQty} {it.unit}
                          {it.minQty > 0 && ` · Mín ${it.minQty}`}
                          {showBusinessColumn && ` · ${it.businessName}`}
                          {it.supplierName && ` · Prov: ${it.supplierName}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {it.lastPriceCents > 0 && (
                          <span className="text-xs font-medium text-muted-foreground">
                            {fmt(it.lastPriceCents)}
                          </span>
                        )}
                        {isLow && (
                          <Badge variant="destructive" className="text-[10px]">
                            <AlertTriangle className="w-3 h-3 mr-0.5" />
                            Bajo
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {lowStock.length > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm">
                <span className="font-medium">{lowStock.length} producto(s)</span> necesitan
                reposición. Crea una requisición al almacén.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href={newRequisitionHref}>
                Crear ahora <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
