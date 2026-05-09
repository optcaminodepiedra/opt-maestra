import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RestaurantBottomNav } from "@/components/app/RestaurantBottomNav";

export default async function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // Determinar businessId activo para usar en el bottom nav
  const me = session.user as { id?: string; primaryBusinessId?: string | null };
  let businessId = me.primaryBusinessId ?? undefined;

  if (!businessId) {
    const first = await prisma.restaurantTable.findFirst({
      where: { isActive: true },
      select: { businessId: true },
      orderBy: { createdAt: "asc" },
    });
    businessId = first?.businessId ?? undefined;
  }

  return (
    <div className="min-h-screen">
      {children}
      <RestaurantBottomNav businessId={businessId} />
    </div>
  );
}
