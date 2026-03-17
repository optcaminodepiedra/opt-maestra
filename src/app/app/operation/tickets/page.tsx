import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ActivitiesBoard } from "@/components/kanban/ActivitiesBoard";
import { TaskType } from "@prisma/client";

export default async function TicketsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session as any).user.id as string;

  const [tasks, businesses, users] = await Promise.all([
    prisma.task.findMany({
      where: { type: TaskType.TICKET },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        business: true,
        assigned: true,
      },
    }),
    prisma.business.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  return (
    <ActivitiesBoard
  tasks={tasks}
  currentUserId={userId}
/>
  );
}
