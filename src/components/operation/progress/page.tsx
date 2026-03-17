import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTaskProgressSummary } from "@/lib/tasks.metrics";
import { ProgressSummary } from "@/components/app/ProgressSummary";
import { TaskType } from "@prisma/client";

export default async function ProgressPage() {
  const activities = await getTaskProgressSummary(TaskType.ACTIVITY);
  const tickets = await getTaskProgressSummary(TaskType.TICKET);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Avance</h2>
      <p className="text-sm text-muted-foreground">
        Vista ejecutiva: estado general, unidades y responsables.
      </p>

      <Tabs defaultValue="activities">
        <TabsList>
          <TabsTrigger value="activities">Actividades</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="activities" className="mt-4">
          <ProgressSummary title="Actividades" data={activities} />
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <ProgressSummary title="Tickets" data={tickets} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
