import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  resolveRestaurantBusinessId,
  listRestaurantOptions,
} from "@/lib/restaurant-resolve";
import { RestaurantSelector } from "@/components/restaurant/RestaurantSelector";
import { getMenuForEdit } from "@/lib/menu-edit.actions";
import { MenuEditorClient } from "@/components/restaurant/MenuEditorClient";

export const dynamic = "force-dynamic";

const EDIT_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH",
];

export default async function MenuEditPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const me = session.user as { id?: string; role?: string; primaryBusinessId?: string | null };
  const role = me.role as string;
  const userId = me.id ?? "";

  if (!EDIT_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" /> Sin acceso
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Solo gerentes y administradores pueden editar el menú.
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
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Sin restaurante</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No tienes acceso a ningún restaurante.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [business, options, menu] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    listRestaurantOptions(userId, role),
    getMenuForEdit(businessId),
  ]);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4 pb-24 md:pb-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/restaurant/menu?businessId=${businessId}`}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Ver menú
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-orange-500" />
            Editor de Menú
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {business?.name} · {menu.items.length} productos · {menu.modifierGroups.length} grupos de modificadores
          </p>
        </div>

        <RestaurantSelector current={businessId} options={options} />
      </div>

      <MenuEditorClient
        businessId={businessId}
        initialItems={menu.items}
        initialModifierGroups={menu.modifierGroups}
        initialCategories={menu.categories}
      />
    </div>
  );
}
