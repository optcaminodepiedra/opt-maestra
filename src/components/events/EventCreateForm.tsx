import type { EventCreateData } from "@/lib/events.types";
import { EventForm } from "@/components/events/EventForm";

export function EventCreateForm({ data }: { data: EventCreateData }) {
  return <EventForm data={data} />;
}
