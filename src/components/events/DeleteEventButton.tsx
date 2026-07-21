"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { deleteEvent } from "@/lib/events.actions";
import { Button } from "@/components/ui/button";

export function DeleteEventButton({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `¿Eliminar el evento “${eventTitle}”?\n\nLos requerimientos del evento se eliminarán. Las requisiciones se conservarán, pero quedarán desvinculadas.`
    );
    if (!confirmed) return;

    setDeleting(true);
    const result = await deleteEvent(eventId);
    setDeleting(false);

    if (!result.ok) {
      window.alert(result.error);
      return;
    }

    router.push("/app/events?deleted=1");
    router.refresh();
  }

  return (
    <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {deleting ? "Eliminando..." : "Eliminar"}
    </Button>
  );
}
