import { EventCreateForm } from "@/components/events/EventCreateForm";
import { getEventCreateData } from "@/lib/events.queries";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const data = await getEventCreateData();
  return <EventCreateForm data={data} />;
}
