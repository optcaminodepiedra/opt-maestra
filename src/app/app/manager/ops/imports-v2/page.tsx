// src/app/app/manager/ops/imports-v2/page.tsx
import { resolveManagerScope } from "@/lib/manager-scope";
import { prisma } from "@/lib/prisma";
import ImportsV2Client from "@/components/imports/ImportsV2Client";

export const dynamic = "force-dynamic";

export default async function ImportsV2Page() {
  const scope = await resolveManagerScope();

  // Para esta página, solo MASTER_ADMIN/OWNER/SUPERIOR pueden ver todos los negocios
  const businesses = scope.isGlobal
    ? await prisma.business.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : await prisma.business.findMany({
        where: { id: { in: scope.businessIds } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Importar respaldos SoftRestaurant</h1>
        <p className="text-sm text-slate-500 mt-1">
          Importa los respaldos XML completos (cheques, líneas, productos, pagos, turnos) en una sola operación.
        </p>
      </div>

      <ImportsV2Client businesses={businesses} />
    </div>
  );
}
