import { redirect } from "next/navigation";

/**
 * Si el usuario va a /app/restaurant/pos sin orderId,
 * lo redirigimos a la pantalla de mesas para que abra una.
 */
export default async function POSIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const qs = sp.businessId ? `?businessId=${sp.businessId}` : "";
  redirect(`/app/restaurant/tables${qs}`);
}
