export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getRestaurantBootData } from "@/lib/restaurant.actions";
import { RestaurantPOS } from "@/components/restaurant/RestaurantPOS";

type SP = Record<string, string | string[] | undefined>;

function pickOne(v?: string | string[]) {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function RestaurantPOSPage({
  searchParams,
}: {
  // ✅ en tu build, searchParams llega como Promise
  searchParams?: Promise<SP>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session as any).user?.role as string;
  const primaryBusinessId = (session as any).user?.primaryBusinessId as string | null;
  const userId = (session as any).user?.id as string;

  const allowedToSwitch = role === "MASTER_ADMIN" || role === "OWNER";

  // ✅ unwrap searchParams
  const sp = (searchParams ? await searchParams : {}) as SP;

  const spBusinessId =
    pickOne(sp.businessId) ||
    pickOne(sp.bid) ||
    pickOne(sp.business);

  const spCashpointId =
    pickOne(sp.cashpointId) ||
    pickOne(sp.cp) ||
    pickOne(sp.cashpoint);

  const debug = pickOne(sp.debug) === "1";

  const selectedBusinessId = allowedToSwitch ? spBusinessId : primaryBusinessId || undefined;

  const boot = await getRestaurantBootData({
    businessId: selectedBusinessId,
    cashpointId: spCashpointId,
  });

  const key = `${boot?.businessId ?? "none"}:${boot?.selectedCashpointId ?? "none"}`;

  return (
    <div className="space-y-4">
      {debug ? (
        <pre className="text-xs p-3 rounded-md border bg-muted overflow-auto">
          {JSON.stringify(
            {
              spBusinessId,
              spCashpointId,
              selectedBusinessId,
              bootBusinessId: boot?.businessId,
              bootCashpoints: (boot as any)?.cashpoints?.map((c: any) => ({ id: c.id, name: c.name })),
              bootSelectedCashpointId: (boot as any)?.selectedCashpointId,
              bootMenuCount: (boot as any)?.menu?.length,
              bootTablesCount: (boot as any)?.tables?.length,
            },
            null,
            2
          )}
        </pre>
      ) : null}

      <RestaurantPOS
        key={key}
        boot={boot as any}
        me={{ id: userId, role, primaryBusinessId, allowedToSwitch }}
      />
    </div>
  );
}
