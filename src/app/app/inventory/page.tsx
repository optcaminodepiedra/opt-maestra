import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // <--- ESTA FALTABA
import { Package, AlertTriangle, ClipboardCheck, ArrowRight, ShoppingCart, DollarSign, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import AlertButton from "./AlertButton";

export default async function InventoryDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // OBTENER DATOS DEL INVENTARIO
  const allItems = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    include: { business: true },
    orderBy: { name: "asc" }
  });

  // FILTROS DE LÓGICA DE NEGOCIO
  const totalItems = allItems.length;
  // Está en alerta si la cantidad física es menor o igual al mínimo establecido
  const lowStockItems = allItems.filter(item => item.onHandQty <= item.minQty);
  
  // Calcular el valor total del inventario (Precio última compra * Cantidad)
  const inventoryValueCents = allItems.reduce((acc, item) => acc + (item.lastPriceCents * item.onHandQty), 0);
  const inventoryValue = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(inventoryValueCents / 100);

  // Buscar las requisiciones pendientes de aprobar (SUBMITTED)
  const pendingRequisitions = await prisma.requisition.count({
    where: { status: "SUBMITTED" }
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ENCABEZADO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Torre de Control - Almacén</h1>
          <p className="text-muted-foreground mt-1">
            Supervisa existencias, alertas de resurtido y valor del inventario.
          </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/app/inventory/movements">Movimientos</Link>
            </Button>
            <Button className="bg-primary hover:bg-primary/90" asChild>
              <Link href="/app/inventory/items/new">+ Nuevo Producto</Link>
            </Button>
        </div>
      </div>

      {/* MÉTRICAS PRINCIPALES */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Catálogo Activo</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems} <span className="text-sm font-normal text-muted-foreground">SKUs</span></div>
            <p className="text-xs text-muted-foreground mt-1">Productos registrados en el sistema</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-orange-500 bg-orange-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-orange-800">Alertas de Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{lowStockItems.length}</div>
            <p className="text-xs text-orange-600 mt-1">Productos por debajo del mínimo</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Valor Estimado</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventoryValue}</div>
            <p className="text-xs text-muted-foreground mt-1">Capital invertido en almacén</p>
          </CardContent>
        </Card>
      </div>

      {/* SECCIÓN INFERIOR: Alertas y Requisiciones */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        
        {/* PANEL IZQUIERDO: PRODUCTOS AGOTÁNDOSE */}
        <Card className="lg:col-span-2 shadow-sm border-orange-200">
          <CardHeader className="bg-orange-50/50 border-b pb-4">
            <CardTitle className="text-orange-800 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" /> 
              Focos Rojos (Requieren Resurtido)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lowStockItems.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-200 mb-3" />
                <p>Todo en orden. Ningún producto debajo del mínimo.</p>
              </div>
            ) : (
              <div className="divide-y">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10">
                    <div>
                      <h4 className="font-semibold text-base">{item.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        Proveedor: {item.supplierName || "No asignado"} | Unidad: {item.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Físico</div>
                        <Badge variant="destructive" className="text-base px-3 py-1">{item.onHandQty}</Badge>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Mínimo</div>
                        <div className="text-base font-medium px-3 py-1">{item.minQty}</div>
                      </div>
                      
                      {/* BOTÓN INTERACTIVO PARA CREAR REQUISICIÓN */}
                      <AlertButton 
                        itemId={item.id} 
                        businessId={item.businessId} 
                        userId={session.user.id} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PANEL DERECHO: ACCIONES DE JEFE DE ALMACÉN */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Bandeja de Almacén</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-800 text-sm mb-1">Confirmar Resurtidos</h4>
                <p className="text-xs text-blue-700 mb-3">
                  Operaciones ha solicitado {pendingRequisitions} producto(s). Revisa el almacén y autoriza la compra.
                </p>
                <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700" asChild>
                    <Link href="/app/inventory/requisitions">
                      <ClipboardCheck className="w-4 h-4 mr-2" />
                      Ir a Requisiciones
                    </Link>
                </Button>
            </div>

            <div className="p-4 bg-muted/30 border rounded-lg">
                <h4 className="font-semibold text-sm mb-1">Imprimir Lista de Compras</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Genera la tabla limpia con los productos ya autorizados para ir al proveedor.
                </p>
                <Button size="sm" variant="outline" className="w-full" asChild>
                    <Link href="/app/inventory/requisitions/print">
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Generar Lista
                    </Link>
                </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
// Necesitamos importar DollarSign y CheckCircle2 de lucide-react arriba. Te recomiendo agregarlos a la línea de importaciones de iconos.