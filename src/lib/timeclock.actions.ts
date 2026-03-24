"use server";

import { prisma } from "@/lib/prisma";
import { PunchType } from "@prisma/client";

export async function registerTimePunch(input: {
  userEmail: string; // Recibimos el correo desde el celular
  type: PunchType;
  photoBase64: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  deviceType: string;
}) {
  if (!input.userEmail) throw new Error("No se recibió el correo del usuario.");

  // 1. Buscamos tu ID real en la base de datos usando tu correo
  const dbUser = await prisma.user.findUnique({
    where: { email: input.userEmail }
  });

  if (!dbUser) throw new Error("No se encontró tu usuario en la base de datos.");
  
  const realUserId = dbUser.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 2. Buscamos si ya tienes un turno abierto hoy
  let workDay = await prisma.workDay.findFirst({
    where: {
      userId: realUserId,
      date: { gte: today },
    },
    orderBy: { createdAt: "desc" },
  });

  // 3. Si no hay turno, verificamos que estés marcando ENTRADA
  if (!workDay) {
    if (input.type !== "ENTRADA") {
      throw new Error("Debes marcar ENTRADA antes de registrar otro evento.");
    }
    workDay = await prisma.workDay.create({
      data: {
        userId: realUserId,
        date: today,
        status: "OPEN",
      },
    });
  }

  // 4. Registramos el movimiento
  await prisma.timePunch.create({
    data: {
      workDayId: workDay.id,
      type: input.type,
      photoUrl: input.photoBase64,
      gpsLat: input.lat,
      gpsLng: input.lng,
      note: input.note?.trim() || null,
      deviceType: input.deviceType,
    },
  });

  // 5. Si es salida, mandamos el día a revisión
  if (input.type === "SALIDA") {
    await prisma.workDay.update({
      where: { id: workDay.id },
      data: { status: "NEEDS_REVIEW" },
    });
  }

  return true;
}