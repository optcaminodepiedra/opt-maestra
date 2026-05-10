import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ShieldAlert, Construction } from "lucide-react";
import { resolveRestaurantBusinessId, listRestaurantOptions } from "@/lib/restaurant-resolve";
import { RestaurantSelector } from "@/components/restaurant/RestaurantSelector";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "MANAGER",
];

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const me = session.user as { id?: string; role?: string; primaryBusinessId?: string | null };
  const role = me.role as string;
  const userId = me.id ?? "";

  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto pb-24">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" /> Sin acceso
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Tu rol no tiene permisos para gestionar el menú.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const businessId = await resolveRestaurantBusinessId({
    queryBusinessId: sp.businessId,
    userId,
    userRole: role,
    userPrimaryBusinessId: me.primaryBusinessId,
  });

  if (!businessId) {
    return (
      <div className="p-6 max-w-xl mx-auto pb-24">
        <Card>
          <CardHeader><CardTitle>Sin restaurante asignado</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No tienes acceso a ningún restaurante.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [business, options, menuItems] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    listRestaurantOptions(userId, role),
    prisma.menuItem.findMany({
      where: { businessId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);

  // Agrupar por categoría
  const byCategory: Record<string, typeof menuItems> = {};
  for (const item of menuItems) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  }
  const categories = Object.keys(byCategory).sort();

  const totalActive = menuItems.filter((i) => i.isActive).length;

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4 pb-24 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-orange-500" />
            Menú
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {business?.name} · {totalActive} producto{totalActive !== 1 ? "s" : ""} activo{totalActive !== 1 ? "s" : ""}
          </p>
        </div>

        <RestaurantSelector current={businessId} options={options} />
      </div>

      {menuItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-3">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <p>Este restaurante no tiene productos en el menú todavía.</p>
            <p className="text-xs">
              Puedes importarlos desde <code className="bg-muted px-1 rounded">/app/admin/import</code> →
              "Productos del menú"
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Construction className="w-4 h-4 text-amber-500" />
                Vista solo lectura — Editor avanzado en Fase 8B
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Por ahora puedes ver todos los productos del menú. La funcionalidad para
              editar precios, agregar productos nuevos, asignar fotos, y configurar
              modificadores llega en Fase 8B junto con el POS rediseñado.
            </CardContent>
          </Card>

          {categories.map((cat) => (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {cat}
                  <Badge variant="secondary" className="text-[10px]">
                    {byCategory[cat].length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {byCategory[cat].map((item) => (
                    <div
                      key={item.id}
                      className={`
                        flex items-center justify-between p-3 border rounded-lg
                        ${!item.isActive ? "opacity-50 bg-muted/30" : "bg-background"}
                      `}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        {!item.isActive && (
                          <Badge variant="outline" className="text-[9px] mt-1">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-bold ml-2">{fmt(item.priceCents)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
