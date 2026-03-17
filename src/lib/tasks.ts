import { prisma } from "@/lib/prisma";

export type TaskDTO = {
  id: string;
  title: string;
  description: string;
  type: "ACTIVITY" | "TICKET";
  status: "TODO" | "DOING" | "BLOCKED" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  area: "OPERATIONS" | "SYSTEMS" | "MARKETING" | "ADMIN";
  businessId: string | null;
  businessName: string | null;
  assignedId: string | null;
  assignedName: string | null;
  createdByName: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

function toDTO(t: any): TaskDTO {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    type: t.type,
    status: t.status,
    priority: t.priority,
    area: t.area,
    businessId: t.businessId ?? null,
    businessName: t.business?.name ?? null,
    assignedId: t.assignedId ?? null,
    assignedName: t.assigned?.fullName ?? t.assigned?.name ?? null,
    createdByName: t.createdBy?.fullName ?? t.createdBy?.name ?? null,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    createdAt: new Date(t.createdAt).toISOString(),
    updatedAt: new Date(t.updatedAt).toISOString(),
  };
}

export async function getKanbanTasks(type: "ACTIVITY" | "TICKET") {
  const tasks = await prisma.task.findMany({
    where: { type },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      business: true,
      assigned: true,
      createdBy: true,
    },
  });

  return tasks.map(toDTO);
}

export async function getTaskAssignees() {
  // Ajusta si tu "User" maneja roles/active, etc.
  const users = await prisma.user.findMany({
    orderBy: { fullName: "asc" as any },
    select: { id: true, fullName: true },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.fullName ?? "—",
  }));
}

export async function getBusinessesForSelect() {
  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return businesses;
}
