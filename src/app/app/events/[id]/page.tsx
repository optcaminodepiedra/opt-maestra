import { notFound } from "next/navigation";

import { EventDetail } from "@/components/events/EventDetail";
import { getEventDetailData } from "@/lib/events.queries";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getEventDetailData(id);
  if (!data) notFound();

  return <EventDetail data={data} created={query.created === "1"} updated={query.updated === "1"} />;
}
