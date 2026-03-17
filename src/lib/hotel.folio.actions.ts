"use server";

import { prisma } from "@/lib/prisma";
import { PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";

function rv() {
  revalidatePath("/app/hotel");
  revalidatePath("/app/hotel/folio");
  revalidatePath("/app/hotel/dashboard");
}

async function recomputeFolio(folioId: string) {
  const folio = await prisma.hotelFolio.findUnique({
    where: { id: folioId },
    include: {
      reservation: true,
      payments: true,
    },
  });

  if (!folio) throw new Error("Folio no existe");

  // Charges
  const chargesAgg = await prisma.hotelCharge.aggregate({
    where: {
      businessId: folio.businessId,
      reservationId: folio.reservationId,
    },
    _sum: { amountCents: true },
  });

  const chargesCents = chargesAgg._sum.amountCents ?? 0;

  // Payments
  const paymentsCents = (folio.payments ?? []).reduce(
    (s, p) => s + p.amountCents,
    0
  );

  // Reservation base
  const totalCents = folio.reservation.totalCents ?? 0;
  const depositCents = folio.reservation.depositCents ?? 0;

  const balanceCents =
    totalCents + chargesCents - depositCents - paymentsCents;

  // 🔥 SOLO guardamos charges y payments
  await prisma.hotelFolio.update({
    where: { id: folioId },
    data: {
      totalChargesCents: chargesCents,
      totalPaymentsCents: paymentsCents,
    },
  });

  return {
    totalCents,
    depositCents,
    chargesCents,
    paymentsCents,
    balanceCents,
  };
}

export async function ensureFolioForReservation(input: {
  reservationId: string;
}) {
  const r = await prisma.hotelReservation.findUnique({
    where: { id: input.reservationId },
  });

  if (!r) throw new Error("Reserva no existe");

  let folio = await prisma.hotelFolio.findUnique({
    where: { reservationId: r.id },
  });

  if (!folio) {
    folio = await prisma.hotelFolio.create({
      data: {
        reservationId: r.id,
        businessId: r.businessId,
      },
    });
  }

  await recomputeFolio(folio.id);
  rv();
  return true;
}

export async function addHotelPayment(input: {
  reservationId: string;
  userId: string;
  method: PaymentMethod;
  amount: number;
  note?: string;
}) {
  const folio = await prisma.hotelFolio.findUnique({
    where: { reservationId: input.reservationId },
  });

  if (!folio) throw new Error("Folio no existe");
  if (folio.isClosed) throw new Error("Folio no está abierto");

  const amountCents = Math.round((input.amount || 0) * 100);

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("Monto inválido");
  }

  await prisma.hotelPayment.create({
    data: {
      folioId: folio.id,
      businessId: folio.businessId,
      method: input.method,
      amountCents,
    },
  });

  await recomputeFolio(folio.id);
  rv();
  return true;
}

export async function closeFolioAndCreateSale(input: {
  reservationId: string;
  userId: string;
  cashpointId: string;
}) {
  const folio = await prisma.hotelFolio.findUnique({
    where: { reservationId: input.reservationId },
    include: { reservation: true },
  });

  if (!folio) throw new Error("Folio no existe");
  if (folio.isClosed) throw new Error("Folio no está abierto");

  const computed = await recomputeFolio(folio.id);

  if (computed.balanceCents !== 0) {
    throw new Error(
      `No puedes cerrar: balance pendiente ${computed.balanceCents / 100} MXN`
    );
  }

  const payAgg = await prisma.hotelPayment.groupBy({
    by: ["method"],
    where: { folioId: folio.id },
    _sum: { amountCents: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.hotelFolio.update({
      where: { id: folio.id },
      data: {
        isClosed: true,
        closedAt: new Date(),
      },
    });

    for (const row of payAgg) {
      const cents = row._sum.amountCents ?? 0;
      if (cents <= 0) continue;

      await tx.sale.create({
        data: {
          businessId: folio.businessId,
          cashpointId: input.cashpointId,
          userId: input.userId,
          amountCents: cents,
          method: row.method,
          concept: "PMS Hotel",
        },
      });
    }
  });

  rv();
  return true;
}
