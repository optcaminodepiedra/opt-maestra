"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function mustUserId(session: any) {
  const id = session?.user?.id;
  if (!id) throw new Error("No session user id");
  return id as string;
}

export async function createTaskAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  const createdById = mustUserId(session);

  const type = String(formData.get("type") ?? "ACTIVITY");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const status = String(formData.get("status") ?? "TODO");
  const priority = String(formData.get("priority") ?? "MEDIUM");
  const area = String(formData.get("area") ?? "OPERATIONS");

  const businessIdRaw = String(formData.get("businessId") ?? "");
  const assignedIdRaw = String(formData.get("assignedId") ?? "");
  const dueDateRaw = String(formData.get("dueDate") ?? "");

  if (!title) return;

  await prisma.task.create({
    data: {
      type: type as any,
      title,
      description: description || null,
      status: status as any,
      priority: priority as any,
      area: area as any,
      businessId: businessIdRaw ? businessIdRaw : null,
      assignedId: assignedIdRaw ? assignedIdRaw : null,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      createdById,
    },
  });

  revalidatePath("/app/ops/kanban/activities/activities");
  revalidatePath("/app/ops/kanban/activities/tickets");
}

export async function updateTaskAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  mustUserId(session);

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  const priority = String(formData.get("priority") ?? "");
  const area = String(formData.get("area") ?? "");
  const businessIdRaw = String(formData.get("businessId") ?? "");
  const assignedIdRaw = String(formData.get("assignedId") ?? "");
  const dueDateRaw = String(formData.get("dueDate") ?? "");

  await prisma.task.update({
    where: { id },
    data: {
      title: title || undefined,
      description: description || null,
      status: (status as any) || undefined,
      priority: (priority as any) || undefined,
      area: (area as any) || undefined,
      businessId: businessIdRaw ? businessIdRaw : null,
      assignedId: assignedIdRaw ? assignedIdRaw : null,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
    },
  });

  revalidatePath("/app/ops/kanban/activities/activities");
  revalidatePath("/app/ops/kanban/activities/tickets");
}

export async function quickMoveTaskStatusAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  mustUserId(session);

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) return;

  await prisma.task.update({
    where: { id },
    data: { status: status as any },
  });

  revalidatePath("/app/ops/kanban/activities/activities");
  revalidatePath("/app/ops/kanban/activities/tickets");
}
