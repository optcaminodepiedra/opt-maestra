import { notFound } from "next/navigation";

import { EventForm } from "@/components/events/EventForm";
import { getEventEditPageData } from "@/lib/events.queries";

export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pageData = await getEventEditPageData(id);
  if (!pageData) notFound();

  return <EventForm data={pageData.data} initialEvent={pageData.initialEvent} />;
}
