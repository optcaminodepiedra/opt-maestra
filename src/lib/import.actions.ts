"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";
import type { ImportEntityType } from "@/lib/import-templates";
import {
  parseDate, combineDateTime, parseMoneyCents, parseInteger,
  parseBool, normString, parseEnum, generateUsername,
  PAYMENT_METHOD_MAP, WITHDRAWAL_KIND_MAP, RESERVATION_STATUS_MAP,
} from "@/lib/import-parsers";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

async function assertAdmin() {
  const me = await getMe();
  if (!ADMIN_ROLES.includes(me.role as string)) {
    throw new Error("Solo administradores pueden importar data.");
  }
  return me;
}

export type ImportRow = Record<string, unknown>;
export type ImportError = { row: number; message: string };

export type ImportResult = {
  batchId: string;
  total: number;
  success: number;
  errors: ImportError[];
};

/* ═══════════════════════════ Dispatcher ═══════════════════════════ */

export async function runImport(
  entityType: ImportEntityType,
  businessId: string | null,
  filename: string,
  rows: ImportRow[]
): Promise<ImportResult> {
  const me = await assertAdmin();

  // Crear el batch
  const batch = await prisma.importBatch.create({
    data: {
      entityType,
      businessId,
      filename,
      totalRows: rows.length,
      status: "PROCESSING",
      createdById: (me as any).id,
    },
  });

  let result: ImportResult;
  try {
    switch (entityType) {
      case "SALES":
        result = await importSales(batch.id, businessId!, rows);
        break;
      case "EXPENSES":
        result = await importExpenses(batch.id, businessId!, rows);
        break;
      case "WITHDRAWALS":
        result = await importWithdrawals(batch.id, businessId!, rows);
        break;
      case "HOTEL_RESERVATIONS":
        result = await importReservations(batch.id, businessId!, rows);
        break;
      case "INVENTORY_ITEMS":
        result = await importInventory(batch.id, businessId!, rows);
        break;
      case "EMPLOYEES":
        result = await importEmployees(batch.id, rows);
        break;
      case "GUESTS":
        result = await importGuests(batch.id, rows);
        break;
      default:
        throw new Error("Tipo de importación no soportado.");
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: result.errors.length === result.total ? "FAILED" : "COMPLETED",
        successRows: result.success,
        errorRows: result.errors.length,
        errors: result.errors as any,
        completedAt: new Date(),
      },
    });

    revalidatePath("/app/admin/import");
    return result;
  } catch (err: any) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "FAILED",
        errors: [{ row: 0, message: err.message }] as any,
        errorRows: rows.length,
        completedAt: new Date(),
      },
    });
    throw err;
  }
}

/* ═══════════════════════════ Ventas ═══════════════════════════ */

async function importSales(
  batchId: string,
  businessId: string,
  rows: ImportRow[]
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let success = 0;

  // Cache de cashpoints y users
  const cashpoints = await prisma.cashpoint.findMany({
    where: { businessId },
    select: { id: true, name: true },
  });
  const cpByName = new Map(cashpoints.map((c) => [c.name.toLowerCase(), c.id]));

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, username: true },
  });
  const userByKey = new Map<string, string>();
  for (const u of users) {
    if (u.email) userByKey.set(u.email.toLowerCase(), u.id);
    if (u.username) userByKey.set(u.username.toLowerCase(), u.id);
  }

  // Usuario del sistema para registrar si no se especifica cajero
  const me = await getMe();
  const fallbackUserId = (me as any).id as string;
  const firstCashpoint = cashpoints[0]?.id ?? null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +1 por el header, +1 porque filas son 1-indexadas

    try {
      const date = combineDateTime(row.fecha, row.hora);
      if (!date) throw new Error("Fecha inválida");

      const concept = normString(row.concepto);
      if (!concept) throw new Error("Concepto requerido");

      const amountCents = parseMoneyCents(row.monto);
      if (amountCents == null || amountCents <= 0) throw new Error("Monto inválido");

      const method = parseEnum(row.metodo, PAYMENT_METHOD_MAP, "CASH");

      // Cajero
      const cashierKey = normString(row.cajero).toLowerCase();
      const userId = cashierKey ? userByKey.get(cashierKey) ?? fallbackUserId : fallbackUserId;

      // Caja
      const cashpointName = normString(row.caja);
      let cashpointId: string | null = null;
      if (cashpointName) {
        cashpointId = cpByName.get(cashpointName.toLowerCase()) ?? null;
        if (!cashpointId) {
          // Crear cashpoint si no existe
          const created = await prisma.cashpoint.create({
            data: { businessId, name: cashpointName, isActive: true },
            select: { id: true, name: true },
          });
          cashpointId = created.id;
          cpByName.set(created.name.toLowerCase(), created.id);
        }
      } else {
        cashpointId = firstCashpoint;
      }

      if (!cashpointId) {
        throw new Error("No hay caja (cashpoint) disponible para este negocio. Crea al menos una.");
      }

      await prisma.sale.create({
        data: {
          businessId,
          cashpointId,
          userId,
          amountCents,
          method: method!,
          concept,
          createdAt: date,
          importBatchId: batchId,
        },
      });
      success++;
    } catch (err: any) {
      errors.push({ row: rowNum, message: err.message });
    }
  }

  return { batchId, total: rows.length, success, errors };
}

/* ═══════════════════════════ Gastos ═══════════════════════════ */

async function importExpenses(
  batchId: string,
  businessId: string,
  rows: ImportRow[]
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let success = 0;

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, username: true },
  });
  const userByKey = new Map<string, string>();
  for (const u of users) {
    if (u.email) userByKey.set(u.email.toLowerCase(), u.id);
    if (u.username) userByKey.set(u.username.toLowerCase(), u.id);
  }

  const me = await getMe();
  const fallbackUserId = (me as any).id as string;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const date = parseDate(row.fecha);
      if (!date) throw new Error("Fecha inválida");

      const category = normString(row.categoria);
      if (!category) throw new Error("Categoría requerida");

      const amountCents = parseMoneyCents(row.monto);
      if (amountCents == null || amountCents <= 0) throw new Error("Monto inválido");

      const note = normString(row.nota);
      const supplier = normString(row.proveedor);

      const responsableKey = normString(row.responsable).toLowerCase();
      const userId = responsableKey ? userByKey.get(responsableKey) ?? fallbackUserId : fallbackUserId;

      const fullNote = [note, supplier ? `Proveedor: ${supplier}` : ""].filter(Boolean).join(" · ");

      await prisma.expense.create({
        data: {
          businessId,
          userId,
          amountCents,
          category,
          note: fullNote || null,
          createdAt: date,
          importBatchId: batchId,
        },
      });
      success++;
    } catch (err: any) {
      errors.push({ row: rowNum, message: err.message });
    }
  }

  return { batchId, total: rows.length, success, errors };
}

/* ═══════════════════════════ Retiros ═══════════════════════════ */

async function importWithdrawals(
  batchId: string,
  businessId: string,
  rows: ImportRow[]
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let success = 0;

  const cashpoints = await prisma.cashpoint.findMany({
    where: { businessId },
    select: { id: true, name: true },
  });
  const cpByName = new Map(cashpoints.map((c) => [c.name.toLowerCase(), c.id]));

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, username: true },
  });
  const userByKey = new Map<string, string>();
  for (const u of users) {
    if (u.email) userByKey.set(u.email.toLowerCase(), u.id);
    if (u.username) userByKey.set(u.username.toLowerCase(), u.id);
  }

  const me = await getMe();
  const fallbackUserId = (me as any).id as string;
  const firstCashpoint = cashpoints[0]?.id ?? null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const date = parseDate(row.fecha);
      if (!date) throw new Error("Fecha inválida");

      const amountCents = parseMoneyCents(row.monto);
      if (amountCents == null || amountCents <= 0) throw new Error("Monto inválido");

      const reason = normString(row.motivo) || null;
      const kind = parseEnum(row.tipo, WITHDRAWAL_KIND_MAP, "LARGE_REQUEST");

      const cashpointName = normString(row.caja);
      let cashpointId = cashpointName ? cpByName.get(cashpointName.toLowerCase()) ?? null : firstCashpoint;

      const requesterKey = normString(row.solicitante).toLowerCase();
      const requesterId = requesterKey ? userByKey.get(requesterKey) ?? fallbackUserId : fallbackUserId;

      await prisma.withdrawal.create({
        data: {
          businessId,
          cashpointId,
          requestedById: requesterId,
          amountCents,
          reason,
          kind: kind!,
          status: "APPROVED", // datos históricos = ya aprobados
          decidedById: fallbackUserId,
          decidedAt: date,
          createdAt: date,
          importBatchId: batchId,
        },
      });
      success++;
    } catch (err: any) {
      errors.push({ row: rowNum, message: err.message });
    }
  }

  return { batchId, total: rows.length, success, errors };
}

/* ═══════════════════════════ Reservaciones ═══════════════════════════ */

async function importReservations(
  batchId: string,
  businessId: string,
  rows: ImportRow[]
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let success = 0;

  const rooms = await prisma.hotelRoom.findMany({
    where: { businessId },
    select: { id: true, name: true },
  });
  const roomByName = new Map(rooms.map((r) => [r.name.toLowerCase(), r.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const checkIn = parseDate(row.checkin);
      const checkOut = parseDate(row.checkout);
      if (!checkIn) throw new Error("Fecha check-in inválida");
      if (!checkOut) throw new Error("Fecha check-out inválida");
      if (checkOut <= checkIn) throw new Error("Check-out debe ser después de check-in");

      const guestName = normString(row.huesped);
      if (!guestName) throw new Error("Nombre del huésped requerido");

      const adults = parseInteger(row.adultos) ?? 1;
      const children = parseInteger(row.ninos) ?? 0;
      const amountCents = parseMoneyCents(row.monto_total) ?? 0;

      // Estado: si ya pasó checkout, asumimos CHECKED_OUT
      const providedStatus = parseEnum(row.estado, RESERVATION_STATUS_MAP, null);
      const defaultStatus = checkOut < new Date() ? "CHECKED_OUT" : "CONFIRMED";
      const status = providedStatus ?? defaultStatus;

      // Habitación (opcional)
      const roomName = normString(row.habitacion);
      const roomId = roomName ? roomByName.get(roomName.toLowerCase()) ?? null : null;

      const hasFoodService = parseBool(row.incluye_alimentos);
      const foodServicePax = parseInteger(row.pax_alimentos);

      await prisma.hotelReservation.create({
        data: {
          businessId,
          roomId,
          guestName,
          guestEmail: normString(row.email) || null,
          guestPhone: normString(row.telefono) || null,
          checkIn,
          checkOut,
          adults,
          children,
          totalCents: amountCents,
          status: status as any,
          notes: normString(row.notas) || null,
          hasFoodService,
          foodServicePax: hasFoodService ? foodServicePax ?? (adults + children) : null,
          createdAt: checkIn, // para que los reportes históricos lo agrupen bien
          importBatchId: batchId,
        },
      });
      success++;
    } catch (err: any) {
      errors.push({ row: rowNum, message: err.message });
    }
  }

  return { batchId, total: rows.length, success, errors };
}

/* ═══════════════════════════ Inventario ═══════════════════════════ */

async function importInventory(
  batchId: string,
  businessId: string,
  rows: ImportRow[]
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let success = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const name = normString(row.nombre);
      if (!name) throw new Error("Nombre requerido");

      const unit = normString(row.unidad);
      if (!unit) throw new Error("Unidad requerida");

      const stock = parseInteger(row.stock) ?? 0;
      const minimo = parseInteger(row.minimo) ?? 0;
      const price = parseMoneyCents(row.precio) ?? 0;
      const sku = normString(row.sku) || null;
      const category = normString(row.categoria) || null;
      const supplier = normString(row.proveedor) || null;

      // Si existe por SKU o nombre en el mismo negocio, actualizar; si no, crear
      const existing = sku
        ? await prisma.inventoryItem.findFirst({ where: { businessId, sku } })
        : await prisma.inventoryItem.findFirst({ where: { businessId, name } });

      if (existing) {
        await prisma.inventoryItem.update({
          where: { id: existing.id },
          data: {
            onHandQty: stock,
            minQty: minimo,
            lastPriceCents: price,
            category,
            supplierName: supplier,
            unit,
            importBatchId: batchId,
          },
        });
      } else {
        await prisma.inventoryItem.create({
          data: {
            businessId,
            name,
            sku,
            category,
            unit,
            onHandQty: stock,
            minQty: minimo,
            lastPriceCents: price,
            supplierName: supplier,
            isActive: true,
            importBatchId: batchId,
          },
        });
      }
      success++;
    } catch (err: any) {
      errors.push({ row: rowNum, message: err.message });
    }
  }

  return { batchId, total: rows.length, success, errors };
}

/* ═══════════════════════════ Empleados ═══════════════════════════ */

async function importEmployees(
  batchId: string,
  rows: ImportRow[]
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let success = 0;

  const businesses = await prisma.business.findMany({
    select: { id: true, name: true },
  });
  const bizByName = new Map(businesses.map((b) => [b.name.toLowerCase(), b.id]));

  const existingUsers = await prisma.user.findMany({
    select: { email: true, username: true },
  });
  const usedEmails = new Set(existingUsers.map((u) => u.email?.toLowerCase()).filter(Boolean));
  const usedUsernames = new Set(existingUsers.map((u) => u.username.toLowerCase()));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const fullName = normString(row.nombre);
      if (!fullName) throw new Error("Nombre requerido");

      const email = normString(row.email).toLowerCase();
      if (!email) throw new Error("Email requerido (para login con Gmail)");
      if (!email.includes("@")) throw new Error("Email inválido");
      if (usedEmails.has(email)) throw new Error(`Email ${email} ya existe`);

      let username = normString(row.username).toLowerCase();
      if (!username) username = generateUsername(fullName);

      // Asegurar username único
      let finalUsername = username;
      let attempt = 1;
      while (usedUsernames.has(finalUsername)) {
        finalUsername = `${username}${attempt}`;
        attempt++;
        if (attempt > 99) throw new Error("No se pudo generar username único");
      }

      const role = normString(row.rol);
      if (!role) throw new Error("Rol requerido");

      const businessName = normString(row.negocio).toLowerCase();
      const primaryBusinessId = businessName ? bizByName.get(businessName) ?? null : null;

      const jobTitle = normString(row.puesto) || null;
      const department = normString(row.departamento) || null;
      const hireDate = parseDate(row.fecha_ingreso);

      await prisma.user.create({
        data: {
          fullName,
          email,
          username: finalUsername,
          role: role as any,
          primaryBusinessId,
          businessId: primaryBusinessId,
          jobTitle,
          department,
          hireDate,
          isActive: true,
          // Sin password: solo login con Google OAuth
          importBatchId: batchId,
        } as any,
      });

      usedEmails.add(email);
      usedUsernames.add(finalUsername);
      success++;
    } catch (err: any) {
      errors.push({ row: rowNum, message: err.message });
    }
  }

  return { batchId, total: rows.length, success, errors };
}

/* ═══════════════════════════ Huéspedes ═══════════════════════════ */

async function importGuests(
  batchId: string,
  rows: ImportRow[]
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let success = 0;

  // Verificar si la tabla Guest existe
  let guestModelExists = true;
  try {
    await (prisma as any).guest.count();
  } catch {
    guestModelExists = false;
  }

  if (!guestModelExists) {
    return {
      batchId,
      total: rows.length,
      success: 0,
      errors: [{ row: 0, message: "Tu schema no tiene modelo Guest. Usa el importador de Reservaciones, que registra al huésped dentro de la reserva." }],
    };
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const name = normString(row.nombre);
      if (!name) throw new Error("Nombre requerido");

      await (prisma as any).guest.create({
        data: {
          fullName: name,
          email: normString(row.email) || null,
          phone: normString(row.telefono) || null,
          documentNumber: normString(row.documento) || null,
          country: normString(row.pais) || null,
          notes: normString(row.notas) || null,
          importBatchId: batchId,
        },
      });
      success++;
    } catch (err: any) {
      errors.push({ row: rowNum, message: err.message });
    }
  }

  return { batchId, total: rows.length, success, errors };
}

/* ═══════════════════════════ Deshacer import ═══════════════════════════ */

export async function revertImport(batchId: string, note?: string) {
  const me = await assertAdmin();

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: { id: true, entityType: true, status: true },
  });
  if (!batch) throw new Error("Batch no encontrado.");
  if (batch.status === "REVERTED") throw new Error("Ya fue revertido.");

  let deleted = 0;
  switch (batch.entityType) {
    case "SALES":
      deleted = (await prisma.sale.deleteMany({ where: { importBatchId: batchId } })).count;
      break;
    case "EXPENSES":
      deleted = (await prisma.expense.deleteMany({ where: { importBatchId: batchId } })).count;
      break;
    case "WITHDRAWALS":
      deleted = (await prisma.withdrawal.deleteMany({ where: { importBatchId: batchId } })).count;
      break;
    case "HOTEL_RESERVATIONS":
      deleted = (await prisma.hotelReservation.deleteMany({ where: { importBatchId: batchId } })).count;
      break;
    case "INVENTORY_ITEMS":
      deleted = (await prisma.inventoryItem.deleteMany({ where: { importBatchId: batchId } })).count;
      break;
    case "EMPLOYEES":
      // Empleados: soft-disable + remover importBatchId para no bloquear la reversión
      const res = await prisma.user.updateMany({
        where: { importBatchId: batchId },
        data: { isActive: false },
      });
      deleted = res.count;
      break;
    case "GUESTS":
      try {
        deleted = (await (prisma as any).guest.deleteMany({ where: { importBatchId: batchId } })).count;
      } catch {}
      break;
  }

  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: "REVERTED",
      revertedAt: new Date(),
      revertedById: (me as any).id,
      note: note ?? `Revertido: ${deleted} registro(s) eliminados`,
    },
  });

  revalidatePath("/app/admin/import");
  return { ok: true, deleted };
}

/* ═══════════════════════════ Listar batches ═══════════════════════════ */

export async function getImportBatches(limit = 50) {
  await assertAdmin();
  const batches = await prisma.importBatch.findMany({
    include: {
      createdBy: { select: { fullName: true } },
      revertedBy: { select: { fullName: true } },
      business: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return batches;
}
