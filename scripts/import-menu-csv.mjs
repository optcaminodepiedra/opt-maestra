#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

function usage() {
  console.log(`
Uso:
  node scripts/import-menu-csv.mjs <ruta.csv> [--dry]

Ej:
  node scripts/import-menu-csv.mjs scripts/menus/bodega-4.csv --dry
  node scripts/import-menu-csv.mjs scripts/menus/bodega-4.csv
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const dry = args.includes("--dry") || args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--"));
  return { file, dry };
}

function parseMoneyToCents(raw) {
  const s = String(raw ?? "").trim().replace(/\$/g, "").replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

// CSV parser simple con comillas
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((c) => String(c).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  row.push(cur);
  if (row.some((c) => String(c).trim() !== "")) rows.push(row);

  return rows;
}

function norm(s) {
  return String(s ?? "").trim();
}

// ID estable para que no duplique
function stableId({ businessId, cashpointId, category, name }) {
  const cp = cashpointId || "GENERAL";
  return `${businessId}:${cp}:${category}:${name}`;
}

async function main() {
  const { file, dry } = parseArgs(process.argv);
  if (!file) {
    usage();
    process.exit(1);
  }

  console.log("=== IMPORT MENU CSV ===");
  console.log("CWD:", process.cwd());
  console.log("DATABASE_URL:", process.env.DATABASE_URL || "(no definida)");

  const csvPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(csvPath)) {
    console.error("No existe CSV:", csvPath);
    process.exit(1);
  }

  const text = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  if (rows.length < 2) {
    console.error("CSV vacío o sin header.");
    process.exit(1);
  }

  const header = rows[0].map((h) => norm(h));
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const required = ["businessName", "cashpointName", "category", "name", "price"];
  for (const k of required) {
    if (!(k in idx)) {
      console.error("Falta columna requerida:", k);
      console.error("Header:", header);
      process.exit(1);
    }
  }

  // cache
  const bizCache = new Map(); // name -> {id,name}
  const cpCache = new Map();  // `${bizId}:${cpName}` -> id

  let upserts = 0;
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];

    const businessName = norm(row[idx.businessName]);
    const cashpointName = norm(row[idx.cashpointName]); // puede ir vacío
    const category = norm(row[idx.category]) || "General";
    const name = norm(row[idx.name]);
    const priceRaw = norm(row[idx.price]);

    if (!businessName || !name || !priceRaw) {
      skipped++;
      continue;
    }

    const priceCents = parseMoneyToCents(priceRaw);
    if (!priceCents) {
      console.warn(`[SKIP] fila ${r + 1} precio inválido: "${priceRaw}"`);
      skipped++;
      continue;
    }

    // ✅ encontrar business por nombre exacto (es unique)
    let biz = bizCache.get(businessName);
    if (!biz) {
      biz = await prisma.business.findUnique({
        where: { name: businessName },
        select: { id: true, name: true },
      });
      if (!biz) {
        console.warn(`[SKIP] fila ${r + 1} business no existe: "${businessName}"`);
        skipped++;
        continue;
      }
      bizCache.set(businessName, biz);
    }

    let cashpointId = null;
    if (cashpointName) {
      const key = `${biz.id}:${cashpointName}`;
      cashpointId = cpCache.get(key) || null;

      if (!cashpointId) {
        const cp = await prisma.cashpoint.findUnique({
          where: { businessId_name: { businessId: biz.id, name: cashpointName } },
          select: { id: true, name: true },
        });
        if (!cp) {
          console.warn(
            `[WARN] fila ${r + 1} cashpoint no existe: "${cashpointName}" en "${biz.name}". Se importará como GENERAL.`
          );
          cashpointId = null;
        } else {
          cashpointId = cp.id;
          cpCache.set(key, cashpointId);
        }
      }
    }

    const id = stableId({ businessId: biz.id, cashpointId, category, name });

    if (dry) {
      console.log(`[DRY] ${biz.name} | ${cashpointName || "GENERAL"} | ${category} | ${name} | $${(priceCents / 100).toFixed(2)}`);
      continue;
    }

    await prisma.menuItem.upsert({
      where: { id },
      update: {
        businessId: biz.id,
        cashpointId: cashpointId ?? null,
        category,
        name,
        priceCents,
        isActive: true,
      },
      create: {
        id,
        businessId: biz.id,
        cashpointId: cashpointId ?? null,
        category,
        name,
        priceCents,
        isActive: true,
      },
    });

    upserts++;
  }

  console.log("DONE ✅");
  console.log("upserts:", upserts);
  console.log("skipped:", skipped);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Import error:", e);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
