import { PrismaClient } from "@prisma/client";
import fs from "fs";
import { XMLParser } from "fast-xml-parser";

const prisma = new PrismaClient();

async function main() {
  // 1. Buscamos el ID de Bodega 4 en tu DB
  const business = await prisma.business.findFirst({
    where: { name: "Bodega 4" }
  });

  if (!business) {
    console.error("❌ No se encontró el negocio 'Bodega 4'. Corre el seed primero.");
    return;
  }

  // 2. Leer y parsear el XML
  const xmlPath = "./prisma/productos.xml";
  if (!fs.existsSync(xmlPath)) {
    console.error(`❌ No se encontró el archivo en ${xmlPath}. Asegúrate de que el archivo productos.xml esté dentro de la carpeta prisma.`);
    return;
  }

  const xmlData = fs.readFileSync(xmlPath, "utf-8");
  const parser = new XMLParser();
  const jsonObj = parser.parse(xmlData);
  
  const rawData = jsonObj?.VFPData?.curtemp;
  const productosRaw = Array.isArray(rawData) ? rawData : (rawData ? [rawData] : []);

  if (productosRaw.length === 0) {
    console.error("❌ No se encontraron productos dentro del archivo XML.");
    return;
  }

  console.log(`🚀 Iniciando importación de ${productosRaw.length} productos...`);

  // Para rastrear qué productos hay en cada ID desconocido
  const ayudaCategorias = new Map<string, string>();

  for (const prod of productosRaw) {
    // Normalizamos el ID: "1" se vuelve "01", "2" se vuelve "02", etc.
    const grupoRaw = String(prod.grupo || "").trim();
    const grupoId = grupoRaw.length === 1 ? grupoRaw.padStart(2, '0') : grupoRaw;

    // Mapeo de Grupos a Categorías
    const categorias: Record<string, string> = {
      "01": "Bebidas",
      "02": "Buffet",
      "03": "Cocina",
      "04": "Extras",
      "05": "Complementos",
      "06": "Vinos/Licores",
      "07": "Postres",
      "08": "Desayunos",
      "09": "Entradas",
      "10": "Cortes",
      // Agregamos los que vimos en tu lista anterior por si acaso
      "51": "Grupo 51",
      "60": "Grupo 60",
      "70": "Grupo 70"
    };

    const categoryName = categorias[grupoId] || "Otros";
    
    // Si no sabemos qué es, guardamos un ejemplo para mostrártelo
    if (categoryName === "Otros" || categoryName.startsWith("Grupo")) {
      if (!ayudaCategorias.has(grupoId)) {
        ayudaCategorias.set(grupoId, prod.descripcion);
      }
    }

    try {
      await prisma.menuItem.upsert({
        where: { id: `B4-${prod.clave}` },
        update: {
          name: prod.descripcion,
          priceCents: Math.round((prod.precio || 0) * 100),
          category: categoryName,
          isActive: !prod.bloqueado
        },
        create: {
          id: `B4-${prod.clave}`,
          businessId: business.id,
          name: prod.descripcion,
          priceCents: Math.round((prod.precio || 0) * 100),
          category: categoryName,
          isActive: !prod.bloqueado
        }
      });
    } catch (err) {
      console.error(`❌ Error con producto ${prod.descripcion}:`, err);
    }
  }

  // Imprimimos el "traductor" para que Rodrigo nos diga los nombres
  if (ayudaCategorias.size > 0) {
    console.log("\n--- 📝 GUÍA DE TRADUCCIÓN DE CATEGORÍAS ---");
    console.log("Dime qué nombre quieres para estos grupos:");
    const sortedKeys = Array.from(ayudaCategorias.keys()).sort();
    sortedKeys.forEach(id => {
      console.log(`ID ${id} -> Ejemplo: "${ayudaCategorias.get(id)}"`);
    });
    console.log("-------------------------------------------\n");
  }

  console.log("✅ Importación completa. Revisa app.optcaminodepiedra.com");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());