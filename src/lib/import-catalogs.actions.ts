"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/session";
import {
  parseVFPRecords,
  asNum,
  asCents,
  asInt,
  asBool,
} from "@/lib/softrestaurant-parser";

// ==============================================================
// importGrupos: importa el catálogo de grupos (categorías) de SR
// ==============================================================
//
// Archivo: grupos.xml — formato: <curtemp> con <clave>, <descripcion>
// Los grupos se guardan en MenuItem.groupCode/groupName denormalizados.
// No usamos una tabla separada para mantener el modelo simple.
//
// Retorna: { totalGrupos, batchId }
export async function importGrupos(input: {
  businessId: string;
  xml: string;
  filename: string;
}) {
  if (!input.businessId) throw new Error("Falta businessId");
  if (!input.xml) throw new Error("XML vacío");

  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");

  const records = parseVFPRecords(input.xml, "curtemp");
  if (records.length === 0) {
    throw new Error("El XML no contiene registros <curtemp>");
  }

  const batch = await prisma.importBatch.create({
    data: {
      entityType: "MENU_ITEMS",  // reutilizamos enum existente
      businessId: input.businessId,
      filename: input.filename,
      totalRows: records.length,
      status: "PROCESSING",
      note: `Grupos SoftRestaurant (${records.length} grupos)`,
      createdById: me.id as string,
    },
  });

  let success = 0;
  let errors: any[] = [];

  // No es necesario hacer nada con grupos solos. Solo los registramos en el batch.
  // Sus nombres se aplicarán al importar productos.
  for (const r of records) {
    if (r.clave && r.descripcion) {
      success++;
    } else {
      errors.push({ record: r, reason: "Sin clave o descripción" });
    }
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      successRows: success,
      errorRows: errors.length,
      status: errors.length === records.length ? "FAILED" : "COMPLETED",
      completedAt: new Date(),
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  revalidatePath("/app/manager/ops/imports-v2");

  return { totalGrupos: records.length, success, errors: errors.length, batchId: batch.id };
}

// ==============================================================
// importProductos: importa el catálogo de productos de SR
// ==============================================================
//
// Archivo: productos.xml — formato: <curtemp> con <clave>, <descripcion>, <grupo>, <precio>, <iva>...
// Crea/actualiza MenuItem con externalCode = clave.
// Requiere que grupos.xml haya sido procesado primero (para tener los groupName).
//
// Estrategia:
// 1. Parsea grupos.xml en memoria si se pasa, para tener groupCode → groupName
// 2. Para cada producto, upsert por (businessId, externalCode)
// 3. Si ya existe, actualiza precio/categoría
// 4. Si no, lo crea con isPhantom=false (es del catálogo real)
//
// Retorna: { totalProductos, created, updated, batchId }
export async function importProductos(input: {
  businessId: string;
  productosXml: string;
  gruposXml?: string;
  filename: string;
}) {
  if (!input.businessId) throw new Error("Falta businessId");
  if (!input.productosXml) throw new Error("productosXml vacío");

  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");

  // Parsear grupos si vienen
  const groupNames = new Map<string, string>();
  if (input.gruposXml) {
    const groups = parseVFPRecords(input.gruposXml, "curtemp");
    for (const g of groups) {
      if (g.clave) groupNames.set(g.clave, g.descripcion || g.clave);
    }
  }

  const productos = parseVFPRecords(input.productosXml, "curtemp");
  if (productos.length === 0) {
    throw new Error("El XML no contiene registros <curtemp>");
  }

  const batch = await prisma.importBatch.create({
    data: {
      entityType: "MENU_ITEMS",
      businessId: input.businessId,
      filename: input.filename,
      totalRows: productos.length,
      status: "PROCESSING",
      note: `Productos SoftRestaurant (${productos.length} productos${input.gruposXml ? ` + ${groupNames.size} grupos` : ""})`,
      createdById: me.id as string,
    },
  });

  let created = 0;
  let updated = 0;
  let errors: any[] = [];

  // Procesamos en chunks de 50 para no sobrecargar
  const chunkSize = 50;
  for (let i = 0; i < productos.length; i += chunkSize) {
    const chunk = productos.slice(i, i + chunkSize);

    for (const p of chunk) {
      try {
        const clave = p.clave?.trim();
        const descripcion = p.descripcion?.trim();
        const grupo = p.grupo?.trim();
        const precio = asCents(p.precio);

        if (!clave || !descripcion) {
          errors.push({ clave, reason: "Sin clave o descripción" });
          continue;
        }

        const existing = await prisma.menuItem.findFirst({
          where: { businessId: input.businessId, externalCode: clave },
        });

        const data = {
          businessId: input.businessId,
          name: descripcion,
          category: groupNames.get(grupo || "") || grupo || "Sin categoría",
          priceCents: precio,
          isActive: !asBool(p.bloqueado),
          externalCode: clave,
          groupCode: grupo || null,
          groupName: groupNames.get(grupo || "") || null,
          isPhantom: false,
        };

        if (existing) {
          await prisma.menuItem.update({
            where: { id: existing.id },
            data,
          });
          updated++;
        } else {
          await prisma.menuItem.create({ data });
          created++;
        }
      } catch (e: any) {
        errors.push({ clave: p.clave, reason: e.message });
      }
    }
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      successRows: created + updated,
      errorRows: errors.length,
      status: errors.length === productos.length ? "FAILED" : "COMPLETED",
      completedAt: new Date(),
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  revalidatePath("/app/manager/ops/imports-v2");

  return {
    totalProductos: productos.length,
    created,
    updated,
    errors: errors.length,
    batchId: batch.id,
  };
}

// ==============================================================
// importMeseros: importa lista de meseros como ExternalUserMapping
// ==============================================================
//
// Archivo: meseros.xml — formato: <curtemp> con <clave>, <nombre>
// Crea entradas en ExternalUserMapping para vincular IDs externos a usuarios reales.
// El campo userId queda null (lo mapeas manualmente después en la UI).
export async function importMeseros(input: {
  businessId: string;
  xml: string;
  filename: string;
}) {
  if (!input.businessId) throw new Error("Falta businessId");
  if (!input.xml) throw new Error("XML vacío");

  const me = await getMe();
  if (!me?.id) throw new Error("Sin sesión");

  const records = parseVFPRecords(input.xml, "curtemp");

  const batch = await prisma.importBatch.create({
    data: {
      entityType: "EMPLOYEES",
      businessId: input.businessId,
      filename: input.filename,
      totalRows: records.length,
      status: "PROCESSING",
      note: `Meseros SoftRestaurant (${records.length} meseros)`,
      createdById: me.id as string,
    },
  });

  let success = 0;
  let errors: any[] = [];

  for (const r of records) {
    try {
      if (!r.clave) {
        errors.push({ r, reason: "Sin clave" });
        continue;
      }
      const existing = await prisma.externalUserMapping.findUnique({
        where: {
          businessId_externalSource_externalUserId_kind: {
            businessId: input.businessId,
            externalSource: "softrestaurant",
            externalUserId: r.clave,
            kind: "WAITER",
          },
        },
      });
      if (existing) {
        await prisma.externalUserMapping.update({
          where: { id: existing.id },
          data: { externalUserName: r.nombre || null },
        });
      } else {
        await prisma.externalUserMapping.create({
          data: {
            businessId: input.businessId,
            externalSource: "softrestaurant",
            externalUserId: r.clave,
            externalUserName: r.nombre || null,
            kind: "WAITER",
          },
        });
      }
      success++;
    } catch (e: any) {
      errors.push({ r, reason: e.message });
    }
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      successRows: success,
      errorRows: errors.length,
      status: errors.length === records.length ? "FAILED" : "COMPLETED",
      completedAt: new Date(),
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  revalidatePath("/app/manager/ops/imports-v2");

  return {
    totalMeseros: records.length,
    success,
    errors: errors.length,
    batchId: batch.id,
  };
}
