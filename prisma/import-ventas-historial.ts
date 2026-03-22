import { PrismaClient, PaymentMethod } from "@prisma/client";
import fs from "fs";
import { XMLParser } from "fast-xml-parser";

const prisma = new PrismaClient();

async function main() {
  const businessName = "Bodega 4";
  const username = "arroiz"; // Tu usuario administrador

  // 1. Validar Negocio y Usuario
  const business = await prisma.business.findFirst({ where: { name: businessName } });
  const adminUser = await prisma.user.findFirst({ where: { username } });

  if (!business || !adminUser) {
    console.error(`❌ Error: Asegúrate de que el negocio "${businessName}" y el usuario "${username}" existan en la DB.`);
    return;
  }

  // 2. Buscar un Punto de Venta (Cashpoint) para asignar las ventas y gastos
  const cashpoint = await prisma.cashpoint.findFirst({
    where: { businessId: business.id }
  });

  if (!cashpoint) {
    console.error(`❌ Error: No se encontró ningún punto de venta (cashpoint) para "${businessName}". Por favor, corre el seed primero.`);
    return;
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    trimValues: true,
  });

  console.log(`🚀 Iniciando importación integral para ${businessName}...`);
  console.log(`📍 Usando punto de venta: ${cashpoint.name}`);

  // --- FASE 1: IMPORTACIÓN DE VENTAS (Ingresos) ---
  try {
    console.log("\n📂 FASE 1: Procesando Ventas (cheques.xml + chequespagos.xml)...");
    const chequesPath = "./prisma/cheques.xml";
    const pagosPath = "./prisma/chequespagos.xml";

    if (fs.existsSync(chequesPath) && fs.existsSync(pagosPath)) {
      console.log("⏳ Leyendo archivos XML (esto puede tomar unos segundos)...");
      const chequesRaw = parser.parse(fs.readFileSync(chequesPath, "utf-8"))?.VFPData?.curcheques;
      const pagosRaw = parser.parse(fs.readFileSync(pagosPath, "utf-8"))?.VFPData?.curchequespagos;

      const cheques = Array.isArray(chequesRaw) ? chequesRaw : (chequesRaw ? [chequesRaw] : []);
      const pagos = Array.isArray(pagosRaw) ? pagosRaw : (pagosRaw ? [pagosRaw] : []);

      const pagosMap = new Map();
      pagos.forEach((p: any) => pagosMap.set(p.folio, p.idformadepago));

      const salesToInsert = [];

      for (const ch of cheques) {
        if (!ch || ch.cancelado === true || ch.cancelado === "true") continue;

        const legacyMethod = pagosMap.get(ch.folio) || "EF";
        let method: PaymentMethod = PaymentMethod.CASH;
        if (["VISA", "MC", "TARJ", "AMEX"].includes(legacyMethod)) method = PaymentMethod.CARD;
        else if (["TRANS", "DEP"].includes(legacyMethod)) method = PaymentMethod.TRANSFER;

        salesToInsert.push({
          id: `HIST-B4-SALE-${ch.folio}`,
          businessId: business.id,
          cashpointId: cashpoint.id,
          userId: adminUser.id,
          amountCents: Math.round((ch.total || 0) * 100),
          method,
          concept: `Venta Histórica Folio: ${ch.folio} | Mesa: ${ch.mesa || 'N/A'}`,
          createdAt: new Date(ch.fecha),
        });
      }

      console.log(`📦 Preparadas ${salesToInsert.length} ventas para subir a la nube. Subiendo en lotes...`);
      
      // Inserción por lotes (Chunks) de 1000 en 1000 para no saturar la red
      const chunkSize = 1000;
      for (let i = 0; i < salesToInsert.length; i += chunkSize) {
        const chunk = salesToInsert.slice(i, i + chunkSize);
        await prisma.sale.createMany({
          data: chunk,
          skipDuplicates: true, // Si ya existe, lo salta sin dar error
        });
        console.log(`   ✅ Progreso Ventas: ${Math.min(i + chunkSize, salesToInsert.length)} / ${salesToInsert.length}`);
      }
      
    } else {
      console.log("⚠️ Saltando Ventas: No se encontraron los archivos cheques.xml o chequespagos.xml");
    }
  } catch (e) {
    console.error("❌ Error en Fase 1 (Ventas):", e);
  }

  // --- FASE 2: IMPORTACIÓN DE COMPRAS (Proveedores) ---
  try {
    console.log("\n📂 FASE 2: Procesando Compras a Proveedores (compras.xml)...");
    const comprasPath = "./prisma/compras.xml";
    
    if (fs.existsSync(comprasPath)) {
      const comprasRaw = parser.parse(fs.readFileSync(comprasPath, "utf-8"))?.VFPData?.curtemp;
      const compras = Array.isArray(comprasRaw) ? comprasRaw : (comprasRaw ? [comprasRaw] : []);

      const expensesToInsert = [];

      for (const comp of compras) {
        if (!comp || comp.cancelado === true || comp.cancelado === "true") continue;

        expensesToInsert.push({
          id: `HIST-B4-EXP-${comp.folio}`,
          businessId: business.id,
          userId: adminUser.id,
          amountCents: Math.round((comp.total || 0) * 100),
          category: "Proveedores",
          note: `Compra Histórica Folio: ${comp.folio} | Proveedor ID: ${comp.proveedor || 'N/A'}`,
          createdAt: new Date(comp.fechaaplicacion || comp.fecha),
        });
      }

      console.log(`📦 Preparadas ${expensesToInsert.length} compras. Subiendo en lotes...`);
      const chunkSize = 1000;
      for (let i = 0; i < expensesToInsert.length; i += chunkSize) {
        const chunk = expensesToInsert.slice(i, i + chunkSize);
        await prisma.expense.createMany({
          data: chunk,
          skipDuplicates: true,
        });
        console.log(`   ✅ Progreso Compras: ${Math.min(i + chunkSize, expensesToInsert.length)} / ${expensesToInsert.length}`);
      }

    } else {
      console.log("⚠️ Saltando Compras: No se encontró el archivo compras.xml");
    }
  } catch (e) {
    console.error("❌ Error en Fase 2 (Compras):", e);
  }

  // --- FASE 3: IMPORTACIÓN DE GASTOS GENERALES Y SALIDAS DE CAJA ---
  try {
    console.log("\n📂 FASE 3: Procesando Gastos Generales y Caja (gastos.xml + movtoscaja.xml)...");
    
    const generalAndCajaExpenses = [];

    // 3A. Gastos Generales
    const gastosPath = "./prisma/gastos.xml";
    if (fs.existsSync(gastosPath)) {
      const gastosRaw = parser.parse(fs.readFileSync(gastosPath, "utf-8"))?.VFPData?.curtemp;
      const gastos = Array.isArray(gastosRaw) ? gastosRaw : (gastosRaw ? [gastosRaw] : []);

      for (const gasto of gastos) {
        if (!gasto || gasto.cancelado === true || gasto.cancelado === "true") continue;

        generalAndCajaExpenses.push({
          id: `HIST-B4-GASTO-${gasto.folio}`,
          businessId: business.id,
          userId: adminUser.id,
          amountCents: Math.round((gasto.total || 0) * 100),
          category: "Gastos Generales",
          note: `Gasto Histórico Folio: ${gasto.folio} | Ref: ${gasto.referencia || 'N/A'} | Notas: ${gasto.observaciones || ''}`,
          createdAt: new Date(gasto.fecha),
        });
      }
    }

    // 3B. Movimientos de Caja (Solo Salidas/Egresos que no son ventas)
    const movCajaPath = "./prisma/movtoscaja.xml";
    if (fs.existsSync(movCajaPath)) {
      const movCajaRaw = parser.parse(fs.readFileSync(movCajaPath, "utf-8"))?.VFPData?.curmovtoscaja;
      const movCaja = Array.isArray(movCajaRaw) ? movCajaRaw : (movCajaRaw ? [movCajaRaw] : []);

      for (const mov of movCaja) {
        if (!mov || mov.cancelado === true || mov.cancelado === "true" || mov.tipo !== 1) continue;
        if (mov.concepto && typeof mov.concepto === 'string' && mov.concepto.toUpperCase().includes('CORTE')) continue;

        generalAndCajaExpenses.push({
          id: `HIST-B4-CAJA-${mov.folio}`,
          businessId: business.id,
          userId: adminUser.id,
          amountCents: Math.round((mov.importe || 0) * 100),
          category: mov.pagodepropina ? "Pago Propinas" : "Salida de Caja",
          note: `Caja Histórica Folio: ${mov.folio} | Concepto: ${mov.concepto || 'N/A'}`,
          createdAt: new Date(mov.fecha),
        });
      }
    }

    if (generalAndCajaExpenses.length > 0) {
      console.log(`📦 Preparados ${generalAndCajaExpenses.length} movimientos de caja/gastos. Subiendo en lotes...`);
      const chunkSize = 1000;
      for (let i = 0; i < generalAndCajaExpenses.length; i += chunkSize) {
        const chunk = generalAndCajaExpenses.slice(i, i + chunkSize);
        await prisma.expense.createMany({
          data: chunk,
          skipDuplicates: true,
        });
        console.log(`   ✅ Progreso Caja/Gastos: ${Math.min(i + chunkSize, generalAndCajaExpenses.length)} / ${generalAndCajaExpenses.length}`);
      }
    }
    
  } catch (e) {
    console.error("❌ Error en Fase 3 (Gastos/Caja):", e);
  }

  console.log("\n✨ Importación finalizada. Los reportes financieros históricos están listos.");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());