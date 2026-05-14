import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ShieldAlert, Pencil, Search, Star } from "lucide-react";
import Link from "next/link";
import { resolveRestaurantBusinessId, listRestaurantOptions } from "@/lib/restaurant-resolve";
import { RestaurantSelector } from "@/components/restaurant/RestaurantSelector";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "MANAGER",
];

// Roles que pueden EDITAR el menú (no solo verlo)
const EDIT_ROLES = [
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

  const canEdit = EDIT_ROLES.includes(role);

  const [business, options, menuItems] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    listRestaurantOptions(userId, role),
    prisma.menuItem.findMany({
      where: { businessId },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
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
  const totalFeatured = menuItems.filter((i) => i.isActive && (i as any).isFeatured).length;

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-orange-500" />
            Menú
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {business?.name} · {totalActive} producto{totalActive !== 1 ? "s" : ""} activo{totalActive !== 1 ? "s" : ""}
            {totalFeatured > 0 && (
              <span className="ml-2">
                · <Star className="w-3 h-3 inline mb-0.5 text-amber-500" /> {totalFeatured} destacado{totalFeatured !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2 items-center">
          <RestaurantSelector current={businessId} options={options} />
          {canEdit && (
            <Button asChild size="default" className="bg-orange-500 hover:bg-orange-600">
              <Link href={`/app/restaurant/menu/edit?businessId=${businessId}`}>
                <Pencil className="w-4 h-4 mr-1.5" /> Editar menú
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {menuItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-3">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <p>Este restaurante no tiene productos en el menú todavía.</p>
            {canEdit && (
              <Button asChild>
                <Link href={`/app/restaurant/menu/edit?businessId=${businessId}`}>
                  <Pencil className="w-4 h-4 mr-1.5" /> Crear el primer producto
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Categorías con productos */}
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
                        flex items-start gap-2 p-3 border rounded-lg
                        ${!item.isActive ? "opacity-50 bg-muted/30" : "bg-background"}
                      `}
                    >
                      {/* Imagen si existe */}
                      {(item as any).imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={(item as any).imageUrl}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          {(item as any).isFeatured && (
                            <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" />
                          )}
                        </div>
                        {(item as any).description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {(item as any).description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm font-bold">{fmt(item.priceCents)}</p>
                          {!item.isActive && (
                            <Badge variant="outline" className="text-[9px]">Inactivo</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Footer hint para editar */}
          {canEdit && (
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Pencil className="w-5 h-5 text-orange-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">¿Quieres modificar el menú?</p>
                    <p className="text-xs text-muted-foreground">
                      Agregar productos, cambiar precios, asignar fotos, configurar modificadores
                    </p>
                  </div>
                </div>
                <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600">
                  <Link href={`/app/restaurant/menu/edit?businessId=${businessId}`}>
                    Editar menú →
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
