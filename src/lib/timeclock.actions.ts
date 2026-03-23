"use server";

import { prisma } from "@/lib/prisma";
import { PunchType } from "@prisma/client";

export async function registerTimePunch(input: {
  userId: string;
  type: PunchType;
  photoBase64: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  deviceType: string;
}) {
  if (!input.userId) throw new Error("Usuario no identificado");

  // 1. Buscamos si el usuario ya tiene un turno abierto HOY
  // Usamos la fecha local de México para no confundir días por el horario UTC
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let workDay = await prisma.workDay.findFirst({
    where: {
      userId: input.userId,
      date: { gte: today },
    },
    orderBy: { createdAt: "desc" },
  });

  // 2. Si no tiene turno abierto y está marcando ENTRADA, le creamos su día
  if (!workDay) {
    if (input.type !== "ENTRADA") {
      throw new Error("Debes marcar ENTRADA antes de registrar otro evento.");
    }
    workDay = await prisma.workDay.create({
      data: {
        userId: input.userId,
        date: today,
        status: "OPEN",
      },
    });
  }

  // 3. Registramos el "Punch" (la checada)
  await prisma.timePunch.create({
    data: {
      workDayId: workDay.id,
      type: input.type,
      photoUrl: input.photoBase64, // Guardamos la foto en Base64 por ahora
      gpsLat: input.lat,
      gpsLng: input.lng,
      note: input.note?.trim() || null,
      deviceType: input.deviceType,
    },
  });

  // 4. Si es SALIDA, marcamos el día para revisión
  if (input.type === "SALIDA") {
    await prisma.workDay.update({
      where: { id: workDay.id },
      data: { status: "NEEDS_REVIEW" },
    });
  }

  return true;
}