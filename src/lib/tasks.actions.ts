"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { TaskStatus, TaskType, Priority, Area } from "@prisma/client";

function kanbanPaths() {
  return [
    "/app/ops/kanban/activities",
    "/app/ops/kanban/tickets",
    "/app/ops/kanban/progress",
    "/app/operation/activities",
    "/app/operation/tickets",
    "/app/operation/progress",
  ];
}

function revalidateKanban() {
  for (const p of kanbanPaths()) revalidatePath(p);
}

export type CreateTaskInput = {
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: Priority;
  area: Area;
  businessId?: string | null;
  assignedId?: string | null;
  createdById: string;

  startDate?: string | null; // ISO
  dueDate?: string | null; // ISO
  endDate?: string | null; // ISO
};

export async function getKanbanMeta() {
  const [users, businesses] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, role: true },
    }),
    prisma.business.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return { users, businesses };
}

export async function getTasksByType(type: TaskType) {
  return prisma.task.findMany({
    where: { type },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: {
      assigned: true,
      business: true,
      createdBy: true,
      comments: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
      attachments: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function createTask(input: CreateTaskInput) {
  if (!input.title?.trim()) throw new Error("Falta título");

  const task = await prisma.task.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      type: input.type,
      status: input.status,
      priority: input.priority,
      area: input.area,
      businessId: input.businessId || null,
      assignedId: input.assignedId || null,
      createdById: input.createdById,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
    select: { id: true },
  });

  revalidateKanban();
  return task.id;
}

export async function moveTask(taskId: string, status: TaskStatus) {
  await prisma.task.update({
    where: { id: taskId },
    data: { status },
  });

  revalidateKanban();
}

export async function assignTask(taskId: string, assignedId: string | null) {
  await prisma.task.update({
    where: { id: taskId },
    data: { assignedId: assignedId || null },
  });

  revalidateKanban();
}

export async function updateTask(
  taskId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    priority: Priority;
    area: Area;
    businessId: string | null;
    assignedId: string | null;
    startDate: string | null;
    dueDate: string | null;
    endDate: string | null;
    status: TaskStatus;
  }>
) {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      title: patch.title === undefined ? undefined : patch.title.trim(),
      description:
        patch.description === undefined
          ? undefined
          : patch.description?.trim() || null,
      priority: patch.priority,
      area: patch.area,
      businessId: patch.businessId,
      assignedId: patch.assignedId,
      startDate:
        patch.startDate === undefined
          ? undefined
          : patch.startDate
          ? new Date(patch.startDate)
          : null,
      dueDate:
        patch.dueDate === undefined
          ? undefined
          : patch.dueDate
          ? new Date(patch.dueDate)
          : null,
      endDate:
        patch.endDate === undefined
          ? undefined
          : patch.endDate
          ? new Date(patch.endDate)
          : null,
      status: patch.status,
    },
  });

  revalidateKanban();
}

export async function addTaskComment(params: {
  taskId: string;
  userId: string;
  body: string;
}) {
  if (!params.body?.trim()) throw new Error("Comentario vacío");

  await prisma.taskComment.create({
    data: {
      taskId: params.taskId,
      userId: params.userId,
      body: params.body.trim(),
    },
  });

  revalidateKanban();
}

export async function addTaskAttachment(params: {
  taskId: string;
  userId: string;
  name: string;
  url: string;
}) {
  if (!params.name?.trim()) throw new Error("Falta nombre");
  if (!params.url?.trim()) throw new Error("Falta URL");

  await prisma.taskAttachment.create({
    data: {
      taskId: params.taskId,
      userId: params.userId,
      name: params.name.trim(),
      url: params.url.trim(),
    },
  });

  revalidateKanban();
}
