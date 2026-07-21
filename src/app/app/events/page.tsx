import { EventsDashboard } from "@/components/events/EventsDashboard";
import { getEventsDashboardData } from "@/lib/events.queries";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filters = await searchParams;
  const data = await getEventsDashboardData(filters);

  return (
    <EventsDashboard
      data={data}
      createdEventId={filters.created ?? null}
      deletedEvent={filters.deleted === "1"}
    />
  );
}
