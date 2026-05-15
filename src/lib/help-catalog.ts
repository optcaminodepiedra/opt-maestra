/**
 * Catálogo central de ayuda — todas las explicaciones en un solo lugar.
 *
 * Estructura:
 *  - METRICS: cada KPI/gráfica con resumen + propósito + técnico
 *  - GLOSSARY: definiciones cortas
 *  - FAQS: preguntas frecuentes
 *  - GUIDES: tutoriales paso a paso (importar XML, etc.)
 */

export type HelpEntry = {
  slug: string;         // para anclas URL: /help#utilidad-neta
  title: string;
  shortDescription: string;  // 1-2 líneas para tooltips
  category: HelpCategory;
  summary: string;
  purpose: string;
  technical: string;
  /** Opcional: qué hacer si se ve mal. */
  troubleshoot?: string;
};

export type HelpCategory =
  | "kpi"           // KPIs como Ventas, Neto, Ticket
  | "chart"         // Gráficas
  | "filter"        // Filtros (período, comparación)
  | "comparison"    // Comparativos y análisis
  | "action";       // Acciones (drill-down, export)

export const METRICS: HelpEntry[] = [
  // ─── KPIs ────────────────────────────────────────────────────
  {
    slug: "ventas-totales",
    title: "Ventas totales",
    category: "kpi",
    shortDescription: "Suma de todos los tickets cobrados en el período seleccionado.",
    summary:
      "Es el dinero total que ingresó al negocio durante el período que tienes seleccionado arriba (Hoy, Este mes, etc.). Cuenta todos los tickets que se marcaron como pagados, sin importar el método de pago (efectivo, tarjeta, transferencia).",
    purpose:
      "Te dice cuánto vendiste en bruto. Es la línea de arriba de tu negocio. Sirve para:\n\n• Saber si estás creciendo o decreciendo vs períodos anteriores.\n• Comparar entre negocios (¿cuál vende más?).\n• Identificar tendencias estacionales (¿vendes más en diciembre que en febrero?).\n\n💡 Recuerda: ventas NO es lo mismo que utilidad. Una venta de $1,000 puede dejarte $100 de utilidad después de gastos.",
    technical:
      "Suma del campo `amountCents` de la tabla `Sale` (en centavos, luego dividido entre 100 para mostrar pesos).\n\nFiltros aplicados:\n• `businessId IN (negocios del manager)` o el subset seleccionado.\n• `createdAt >= range.from AND createdAt < range.to`\n• Sin filtro por método: incluye CASH + CARD + TRANSFER.\n• Sin filtro por estado: todo Sale registrado cuenta.\n\nSQL equivalente:\n```\nSELECT SUM(\"amountCents\")/100\nFROM \"Sale\"\nWHERE \"businessId\" IN (...)\n  AND \"createdAt\" >= from\n  AND \"createdAt\" < to\n```",
    troubleshoot:
      "Si ves $0 cuando debería haber ventas:\n• Revisa el filtro de período arriba (¿está en 'Hoy' pero las ventas son de ayer?).\n• Revisa el selector de negocios (¿filtraste a un solo negocio sin ventas?).\n• Si importaste de XML, verifica que el respaldo se procesara correctamente en /app/admin/import.",
  },
  {
    slug: "gastos-totales",
    title: "Gastos totales",
    category: "kpi",
    shortDescription: "Todo lo que salió de caja registrado como gasto operativo.",
    summary:
      "Total de gastos operativos en el período: insumos, nóminas, propinas pagadas, y cualquier otra salida que se haya registrado como Gasto. NO incluye retiros de caja chica (esos van por su propio flujo).",
    purpose:
      "Te dice cuánto le costó operar al negocio en el período. Sirve para:\n\n• Detectar gastos crecientes inesperados.\n• Comparar estructura de costos entre negocios.\n• Identificar la categoría que más pesa (nómina, insumos, etc.).\n\n💡 La flecha de cambio se invierte: cuando los gastos BAJAN se muestra en verde (es bueno), y cuando SUBEN en rojo.",
    technical:
      "Suma del campo `amountCents` de la tabla `Expense`.\n\nFiltros:\n• `businessId IN (...)`\n• `createdAt >= from AND createdAt < to`\n\nNo incluye `Withdrawal` (retiros) ni transferencias internas.\n\nLos gastos importados de SoftRestaurant se etiquetan con `externalSource = 'softrestaurant'` y conservan categorías como 'Nóminas', 'Propina pagada', 'Insumos del día', 'Otros'.",
  },
  {
    slug: "utilidad-neta",
    title: "Utilidad neta",
    category: "kpi",
    shortDescription: "Ventas − Gastos. Es lo que dejó el negocio en el período.",
    summary:
      "La diferencia entre tus ventas y tus gastos. Si es positiva (verde), ganaste dinero. Si es negativa (rojo), perdiste.\n\n⚠️ Importante: esto NO incluye costos que no se registran como Gasto (renta, impuestos del corporativo, depreciaciones, etc.). Es utilidad operativa, no contable.",
    purpose:
      "Es la métrica más importante: ¿el negocio está ganando dinero?\n\nQué hacer si...\n\n• Es positiva y creciendo: el negocio va bien, mantén lo que estás haciendo.\n• Es positiva pero bajando: investiga qué cambió (¿más gastos? ¿menos ventas?).\n• Es negativa: revisa la tabla 'Por negocio' para ver cuál está rentable y cuál no.\n• Bajó >20% vs período anterior: investiga categorías de gasto, puede haber un gasto extraordinario.",
    technical:
      "`netTotal = salesTotal − expensesTotal`\n\nDonde:\n• salesTotal = SUM(Sale.amountCents) del período\n• expensesTotal = SUM(Expense.amountCents) del período\n\nNo se incluyen:\n• Retiros (Withdrawal) — son flujo de efectivo, no gasto contable\n• Cancelaciones — Sales con `status = 'CANCELED'` no entran al amountCents original\n• Reservas hoteleras pendientes — no son venta hasta el checkout\n\nLa flecha % vs período anterior se calcula:\n`delta = (netActual − netAnterior) / |netAnterior| × 100`",
  },
  {
    slug: "ticket-promedio",
    title: "Ticket promedio",
    category: "kpi",
    shortDescription: "Cuánto gasta en promedio cada cliente por visita.",
    summary:
      "El valor promedio de cada ticket. Se calcula dividiendo las ventas totales entre el número de tickets cobrados.",
    purpose:
      "Sirve para entender el comportamiento del cliente:\n\n• Si SUBE: tus clientes están gastando más por visita (mejor mezcla de productos, ventas adicionales).\n• Si BAJA: tus clientes están gastando menos. Investiga si bajaron las propinas, si están pidiendo menos platos, o si entraron clientes con tickets pequeños.\n\n💡 Es útil para comparar entre restaurantes: si uno tiene ticket promedio de $300 y otro de $150, el menú o el público son distintos.",
    technical:
      "`avgTicket = salesCount > 0 ? Math.round(salesTotal / salesCount) : 0`\n\nUsa enteros (Math.round) para evitar decimales raros en centavos.\n\nSi no hay ventas, devuelve 0 (no NaN).",
  },

  // ─── GRÁFICAS ────────────────────────────────────────────────
  {
    slug: "grafica-ventas-tiempo",
    title: "Ventas en el tiempo",
    category: "chart",
    shortDescription: "Cómo evolucionaron las ventas día a día (o semana/mes según el rango).",
    summary:
      "Gráfica de área que muestra cómo se distribuyeron tus ventas a lo largo del período seleccionado. La línea punteada gris (si aparece) es el período de comparación (mes pasado, año pasado, etc.).",
    purpose:
      "Detectar patrones temporales:\n\n• Picos: ¿qué días vendiste mucho? Pueden ser feriados, eventos, fines de semana.\n• Valles: ¿días con poca venta? Pueden ser oportunidades para promociones.\n• Tendencia general: ¿la línea va subiendo o bajando con el tiempo?\n• Comparar con período anterior: si la línea actual está arriba de la punteada, vas mejor.",
    technical:
      "Usa SQL raw con `DATE_TRUNC(...AT TIME ZONE 'America/Mexico_City')` para agrupar correctamente respetando el horario México (UTC-6 sin DST desde 2022).\n\nGranularidad automática según el rango:\n• ≤31 días → agrupa por día\n• 32-180 días → agrupa por semana\n• >180 días → agrupa por mes\n\nQuery equivalente:\n```\nSELECT \n  DATE_TRUNC('day', \"createdAt\" AT TIME ZONE 'America/Mexico_City') AS bucket,\n  SUM(\"amountCents\")/100 AS total\nFROM \"Sale\"\nWHERE \"businessId\" IN (...) AND \"createdAt\" BETWEEN from AND to\nGROUP BY bucket\nORDER BY bucket\n```",
  },
  {
    slug: "metodos-pago",
    title: "Ventas por método de pago",
    category: "chart",
    shortDescription: "Distribución entre efectivo, tarjeta y transferencia.",
    summary:
      "Gráfica de dona que muestra qué porcentaje de tus ventas se hizo en efectivo, tarjeta y transferencia.\n\nColores:\n• Verde = Efectivo\n• Azul = Tarjeta\n• Morado = Transferencia",
    purpose:
      "Sirve para varias cosas:\n\n• Control de efectivo: si vendes mucho en efectivo, necesitas más caja y más cuidado contable.\n• Cobertura de pagos: si todo es tarjeta, tu negocio depende de que funcione la terminal.\n• Comisiones: bancos cobran ~2-3% por tarjeta. Si 80% es tarjeta, hay $$ que se va en comisión.\n• Tendencias: ¿está creciendo la transferencia (típica de hoteles) vs efectivo?",
    technical:
      "Agrupa por el campo `method` de Sale, que es un enum:\n• `CASH` = Efectivo\n• `CARD` = Tarjeta\n• `TRANSFER` = Transferencia\n\nPara imports XML de SoftRestaurant, se determina el método según el monto dominante del cheque (efectivo vs tarjeta vs otros).",
  },
  {
    slug: "gastos-categoria",
    title: "Gastos por categoría",
    category: "chart",
    shortDescription: "En qué categorías se concentran los gastos.",
    summary:
      "Distribución de los gastos por categoría: Nóminas, Insumos del día, Propina pagada, Otros, etc.",
    purpose:
      "Identificar dónde se va el dinero:\n\n• Categoría dominante: ¿nóminas es el 60%? Es normal en restaurantes con mucho personal.\n• Categorías inesperadas: si 'Otros' es alto, hay gastos sin clasificar que vale la pena revisar.\n• Cambios entre períodos: si una categoría creció mucho, vale la pena auditarla.",
    technical:
      "Agrupa por el campo `category` de Expense (string libre).\n\nCategorías comunes en datos importados:\n• 'Nóminas' (detectado por concepto que contenga 'NOMINA')\n• 'Propina pagada' (concepto contiene 'PROPINA')\n• 'Insumos del día' (concepto contiene 'PAN', 'BOLILLO', 'BROTE')\n• 'Otros' (todo lo demás)",
  },
  {
    slug: "ventas-dia-semana",
    title: "Ventas por día de la semana",
    category: "chart",
    shortDescription: "Qué días de la semana vendes más.",
    summary:
      "Barras que muestran cuánto vendiste en total cada día de la semana durante el período. El día con más ventas se resalta en verde.",
    purpose:
      "Optimizar operaciones:\n\n• Programar más personal los días pico.\n• Programar promociones los días bajos.\n• Decidir cuándo abrir/cerrar (si un día siempre vende muy poco, ¿vale la pena abrir?).\n• Planear inventario: comprar más insumos antes del día pico.",
    technical:
      "SQL raw con `EXTRACT(DOW FROM ... AT TIME ZONE 'America/Mexico_City')`.\n\nDOW devuelve 0=Domingo, 1=Lunes, ..., 6=Sábado.\n\nSe ordena Lun→Dom para presentación natural (Postgres por defecto da Dom primero).\n\nRellena días sin ventas con 0 para que la gráfica tenga 7 barras siempre.",
  },
  {
    slug: "ventas-hora",
    title: "Ventas por hora del día",
    category: "chart",
    shortDescription: "Las horas pico de tu operación (00:00 a 23:00).",
    summary:
      "Distribución de ventas por hora del día (24 horas). La hora con más ventas se resalta en verde como 'Hora pico'.",
    purpose:
      "Útil para:\n\n• Saber a qué hora maximizar personal (chef, meseros, cajeros).\n• Identificar horas muertas.\n• Decidir horarios de promoción (happy hour, breakfast specials, etc.).\n• Detectar problemas: si esperabas pico a las 14h pero ves pico a las 16h, algo cambió.\n\n⚠️ Limitación: si tus imports de SoftRestaurant tienen hora 00:00 todos (por como se guardó el respaldo), esta gráfica no será útil para datos históricos. Sí funciona perfecto para ventas registradas en vivo en el POS.",
    technical:
      "SQL raw con `EXTRACT(HOUR FROM ... AT TIME ZONE 'America/Mexico_City')`.\n\nDevuelve 0-23. Rellena horas sin ventas con 0.",
    troubleshoot:
      "Si todas las ventas se ven concentradas en una hora (ej: 00:00), es porque tus datos importados de XML no traen hora del ticket. Para verificar:\n\n```\nSELECT EXTRACT(HOUR FROM (\"createdAt\" AT TIME ZONE 'America/Mexico_City')) AS h, COUNT(*)\nFROM \"Sale\"\nWHERE \"externalSource\" = 'softrestaurant'\nGROUP BY h ORDER BY h;\n```\n\nSi todo aparece a la hora 0, no hay solución automática para datos históricos. Ventas nuevas registradas en POS sí guardan la hora correcta.",
  },

  // ─── FILTROS ────────────────────────────────────────────────
  {
    slug: "filtro-periodo",
    title: "Selector de período",
    category: "filter",
    shortDescription: "Define qué rango de fechas analizas.",
    summary:
      "Cambia qué fechas se incluyen en TODAS las gráficas y KPIs de la página. Tiene 10 presets rápidos:\n\n• Hoy / Ayer\n• Últimos 7 días\n• Esta semana (Lun-Dom)\n• Este mes / Mes pasado\n• Últimos 3 meses\n• Este año / Año pasado\n• Personalizado (eliges desde-hasta)",
    purpose:
      "Es el filtro más importante. Todo lo demás se calcula sobre el rango que elijas.\n\n💡 Tip: el período se guarda en la URL. Puedes:\n• Compartir el link con un compañero para que vea lo mismo.\n• Guardar como favorito y volver al mismo análisis.\n• Hacer F5 sin perder los filtros.",
    technical:
      "Usa timezone fija 'America/Mexico_City' (UTC-6 sin horario de verano desde 2022).\n\nLos rangos son [from, to) — from inclusive, to exclusive. Esto evita ambigüedades en el límite (ej: 'Este mes' incluye desde el día 1 00:00 hasta el día 1 del siguiente mes 00:00).\n\nGuarda en URL como `?preset=thismonth` o `?preset=custom&from=2026-01-01&to=2026-01-31`.",
  },
  {
    slug: "filtro-negocios",
    title: "Selector de negocios",
    category: "filter",
    shortDescription: "Filtra a uno o varios negocios.",
    summary:
      "Si tienes acceso a varios negocios, este selector te permite analizar uno solo, varios, o todos. Click en 'Todos los negocios' para volver al global.",
    purpose:
      "Útil para:\n\n• Analizar un negocio específico sin que los demás 'diluyan' las cifras.\n• Comparar dos negocios entre sí (selecciona Bodega 4 + TA y ve cómo se distribuyen).\n• Ver solo los negocios bajo tu responsabilidad si tienes acceso múltiple.",
    technical:
      "Si seleccionas N>0 negocios, se guarda en URL como `?biz=id1,id2,id3`.\n\nSi seleccionas TODOS (=N total), se borra de URL para mantenerla limpia.\n\nNunca puedes ver negocios fuera de tu manager scope (la seguridad la hace el servidor).",
  },
  {
    slug: "filtro-comparar",
    title: "Modo de comparación",
    category: "filter",
    shortDescription: "Compara con período anterior o año anterior.",
    summary:
      "Define con qué se compara tu período actual. Tres opciones:\n\n• Período anterior: el mismo número de días previos (Este mes → Mes pasado)\n• Hace 1 año: mismo bloque pero hace 12 meses\n• Sin comparar: oculta las flechas de cambio",
    purpose:
      "Para saber si estás mejorando o empeorando.\n\nUsa 'Período anterior' para movimientos rápidos (¿esta semana mejor que la pasada?).\n\nUsa 'Hace 1 año' para análisis de tendencia real (eliminando estacionalidad: febrero siempre es bajo, comparar febrero 2026 con enero 2026 no tiene sentido, compáralo con febrero 2025).",
    technical:
      "• Período anterior: `compFrom = currentFrom − duración; compTo = currentFrom`\n• Hace 1 año: `compFrom = currentFrom − 1 año; compTo = currentTo − 1 año`\n\nEl cálculo de delta %:\n`delta = (actual − comp) / |comp| × 100`\n\nSi comp=0 y actual>0, delta es null (no hay comparación válida, evita división por 0).",
  },

  // ─── COMPARATIVOS ────────────────────────────────────────────
  {
    slug: "delta-porcentaje",
    title: "Cambio porcentual (la flecha %)",
    category: "comparison",
    shortDescription: "Cuánto creció/cayó vs el período de comparación.",
    summary:
      "Esa flechita verde o roja que ves al lado de cada KPI te dice cuánto cambió vs el período de comparación.\n\nVerde + ↑ = aumentó (bueno para ventas, malo para gastos)\nRojo + ↓ = disminuyó\nGris + − = sin cambio significativo (<0.5%)",
    purpose:
      "Identificar tendencias rápidamente sin tener que calcular mentalmente:\n\n• Ventas +15%: vas creciendo, sigue así.\n• Gastos +30%: revisa qué pasó (subió alguna categoría).\n• Neto −20%: la utilidad se deterioró, investiga qué KPI causó.\n\n💡 En 'Gastos', la lógica se invierte: bajar gastos se muestra en verde (es bueno), subir gastos en rojo.",
    technical:
      "Fórmula: `delta = (valorActual − valorComparacion) / |valorComparacion| × 100`\n\nCasos especiales:\n• Si valorComparacion = 0 y valorActual = 0: delta = 0%\n• Si valorComparacion = 0 y valorActual > 0: delta = null (no se muestra)\n• Si |delta| < 0.5%: se muestra como 0% con ícono de '—'",
  },
  {
    slug: "comparativa-negocios",
    title: "Comparativa entre negocios",
    category: "comparison",
    shortDescription: "Tabla que compara todos tus negocios lado a lado.",
    summary:
      "Tabla en Finanzas/Reportes que muestra cada negocio en filas, con sus ventas, gastos, neto y opcionalmente delta % vs comparación.\n\nLos negocios se ordenan por ventas (de mayor a menor). Al final hay una fila 'Total' con los acumulados.",
    purpose:
      "Identificar:\n\n• Qué negocio es el más rentable.\n• Qué negocio está perdiendo dinero (neto rojo).\n• Cuál creció más vs período de comparación.\n• Cuál tiene mejor ticket promedio (cliente más valioso).\n\n💡 Las columnas con menos importancia se ocultan en pantallas pequeñas (Tickets y Ticket promedio se ven solo en desktop).",
    technical:
      "Usa `prisma.sale.groupBy({ by: ['businessId'] })` para agregaciones eficientes.\n\nSi hay comparación, hace 2 queries paralelas: una para el período actual y una para el anterior, luego junta por businessId.",
  },

  // ─── ACCIONES ────────────────────────────────────────────────
  {
    slug: "drill-down",
    title: "Drill-down (ver detalle)",
    category: "action",
    shortDescription: "Click en una venta o gasto para ver TODAS las del período.",
    summary:
      "En las listas de 'Ventas recientes' o 'Gastos recientes', haz click en cualquier fila para abrir un modal con TODAS las transacciones del período (hasta 500).\n\nDentro del modal:\n• Tabla completa con fecha, hora, concepto, monto, etc.\n• Buscador en vivo (filtra mientras escribes).\n• Botón 'CSV' para descargar.",
    purpose:
      "Investigar a fondo:\n\n• ¿Por qué saltaron los gastos? Click → buscar 'NOMINA' → ver detalle.\n• ¿Cuántas ventas grandes hubo? Click → ordenar por monto.\n• Auditar transacciones específicas (¿quién la hizo, en qué caja?).\n• Compartir CSV con contabilidad.",
    technical:
      "El modal hace fetch al cargar mediante una Server Action (`loadSalesDrillDown` o `loadExpensesDrillDown`).\n\nValida en el server que el usuario tenga acceso a los negocios consultados antes de devolver datos. Devuelve hasta 500 registros ordenados por createdAt DESC.\n\nEl filtro de búsqueda se hace en el cliente (no requiere nueva query).",
  },
  {
    slug: "exportar",
    title: "Exportar (Excel / PDF / CSV)",
    category: "action",
    shortDescription: "Descargar reportes para compartir con contabilidad o jefes.",
    summary:
      "Click en el botón 'Exportar' arriba a la derecha (en Finanzas/Reportes) para:\n\n• Excel (.xlsx): archivo con 6 hojas (Resumen, Ventas, Gastos, Por negocio, Por método, Por categoría).\n• Imprimir / PDF: usa la función nativa del navegador. Puedes elegir 'Guardar como PDF' en el diálogo.\n\nDesde el modal de drill-down también puedes exportar CSV de los registros filtrados.",
    purpose:
      "Compartir con:\n\n• Contabilidad: el Excel viene listo para auditoría.\n• Jefes / dueños: el PDF se ve profesional para juntas.\n• Otros sistemas: el CSV se importa a cualquier herramienta.\n\n💡 El export respeta los filtros aplicados (período + negocios). Si filtras a 'Bodega 4 último mes', el Excel solo trae eso.",
    technical:
      "Excel:\n• Server Action `exportToExcel(searchParams)` genera el archivo con SheetJS (xlsx)\n• Devuelve base64 que el cliente decodifica y descarga\n• Hasta 10,000 ventas y 10,000 gastos por exportación\n\nPDF:\n• Llama a `window.print()` del navegador\n• El navegador muestra diálogo donde puedes 'Guardar como PDF'\n• Respeta los estilos CSS de la página (incluye gráficas si están renderizadas)\n\nCSV (en drill-down):\n• Generado 100% en el cliente (sin viaje al servidor)\n• Encodea correctamente comillas y comas",
  },
];

/* ═══════════════════════════════════════════════════════════════
 * GLOSARIO
 * ═══════════════════════════════════════════════════════════════ */

export type GlossaryEntry = {
  term: string;
  definition: string;
};

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "Venta (Sale)",
    definition:
      "Una transacción cobrada al cliente. Cada ticket del POS o cada cuenta cerrada del restaurante genera 1 Venta en la BD. Incluye método de pago, monto, caja, usuario, y opcionalmente folio externo si vino de SoftRestaurant.",
  },
  {
    term: "Gasto (Expense)",
    definition:
      "Salida de dinero registrada para fines operativos: nómina, insumos, propinas pagadas, etc. NO incluye retiros de caja chica (Withdrawal) que son flujo de efectivo aparte.",
  },
  {
    term: "Retiro (Withdrawal)",
    definition:
      "Salida temporal o autorizada de dinero de la caja. Hay 2 tipos: 'Caja chica' (gastos del día como propinas, papelería) y 'Retiro grande' (requiere aprobación de un superior). NO cuenta como gasto operativo en los KPIs.",
  },
  {
    term: "Neto / Utilidad neta",
    definition:
      "Ventas − Gastos del período. Si es positivo el negocio ganó dinero ese período; si es negativo perdió. No incluye costos contables como renta, impuestos del corporativo o depreciación.",
  },
  {
    term: "Método de pago",
    definition:
      "Cómo se cobró la venta. Hay 3 categorías: CASH (efectivo), CARD (tarjeta de débito/crédito), TRANSFER (transferencia bancaria, vales, etc.).",
  },
  {
    term: "Negocio (Business)",
    definition:
      "Una unidad de operación que tiene su propio control: Bodega 4, Restaurante Tierra Adentro, Hotel Camino de Piedra, etc. Cada negocio tiene sus propias ventas, gastos, inventario, empleados.",
  },
  {
    term: "Importación XML",
    definition:
      "Proceso para subir respaldos de SoftRestaurant (sistema antiguo de punto de venta) y cargarlos en OPT Maestra. Los datos se etiquetan con `externalSource = 'softrestaurant'` y `externalFolio = número de cheque original` para evitar duplicados.",
  },
  {
    term: "Caja (Cashpoint)",
    definition:
      "Punto de venta físico dentro de un negocio. Un negocio puede tener varias cajas (ej: 'Caja Principal', 'Caja Bar', 'Caja Spa'). Cada Venta se registra en una caja específica.",
  },
  {
    term: "Período de comparación",
    definition:
      "Rango de fechas con el que se compara tu período actual. Por defecto, es el período inmediatamente anterior del mismo tamaño (ej: este mes vs mes pasado). Puedes cambiarlo a 'Hace 1 año' o 'Sin comparar'.",
  },
  {
    term: "Drill-down",
    definition:
      "Acción de hacer click en una métrica agregada (como una gráfica o un KPI) para ver los datos individuales que la componen. En este sistema, drill-down se hace clickeando filas de 'Ventas recientes' o 'Gastos recientes' para ver TODAS las transacciones del período.",
  },
  {
    term: "Sparkline",
    definition:
      "Gráfica diminuta inline en una card que muestra la tendencia en el tiempo de una métrica.",
  },
  {
    term: "Delta % / Cambio porcentual",
    definition:
      "Cuánto creció o cayó una métrica vs el período de comparación, expresado en porcentaje. Calculado como (actual − comparación) / |comparación| × 100.",
  },
  {
    term: "Granularidad",
    definition:
      "Nivel de detalle temporal en las gráficas. Automática: ≤31 días → por día, 32-180 días → por semana, >180 días → por mes.",
  },
];

/* ═══════════════════════════════════════════════════════════════
 * FAQs
 * ═══════════════════════════════════════════════════════════════ */

export type FaqEntry = {
  question: string;
  answer: string;
};

export const FAQS: FaqEntry[] = [
  {
    question: "¿Por qué veo $0 en ventas si sé que vendimos?",
    answer:
      "Revisa estos 3 puntos:\n\n1. **Período seleccionado** — Arriba está el filtro de fechas. Si dice 'Hoy' pero las ventas son de ayer, no las vas a ver. Cambia a 'Últimos 7 días' o 'Este mes'.\n\n2. **Negocio filtrado** — Si tienes seleccionado solo un negocio que no tuvo ventas en el período, verás $0. Click en 'Todos los negocios' para verificar.\n\n3. **Ventas registradas** — Si las ventas se registraron en SoftRestaurant pero no se han importado el XML aún, no aparecen. Ve a /app/admin/import/xml para importar el respaldo.",
  },
  {
    question: "¿Cuál es la diferencia entre Gasto y Retiro de caja?",
    answer:
      "**Gasto (Expense)** es algo que SALIÓ del negocio por una operación legítima: pagar nómina, comprar insumos, pagar propinas. Es un costo operativo real que afecta tu utilidad neta.\n\n**Retiro (Withdrawal)** es cuando alguien saca dinero de la caja para un propósito específico. Puede ser:\n• Caja chica: gastos pequeños del día (propinas, papelería). Está autorizado por default.\n• Retiro grande: requiere aprobación de un superior. Para gastos no rutinarios.\n\nLos retiros NO cuentan como gastos en la utilidad neta. Son movimientos de dinero, no costos. Solo afectan tu disponible en caja.",
  },
  {
    question: "¿Cómo importo el respaldo de SoftRestaurant?",
    answer:
      "1. Ve a `/app/admin/import/xml` (solo usuarios admin tienen acceso)\n\n2. Selecciona el negocio destino (importante: si subes a Bodega 4, se etiqueta como Bodega 4)\n\n3. Click 'Seleccionar archivos' y arrastra todos los XML del respaldo (puedes subir varios a la vez)\n\n4. Click 'Importar a [negocio]'\n\n5. Espera a que termine. Verás:\n   • ✓ Importados (cuántos sí entraron)\n   • Omitidos (duplicados — esto es normal si re-importas)\n   • Errores (si los hay)\n\nLa idempotencia evita duplicados: si subes el mismo respaldo 2 veces, la segunda no duplica nada.",
  },
  {
    question: "¿Cómo se calcula la utilidad neta?",
    answer:
      "Es simple: **Utilidad neta = Ventas totales − Gastos totales**\n\nDel período que tengas filtrado arriba.\n\n**Qué SÍ incluye:**\n• Todas las Sales pagadas (CASH + CARD + TRANSFER)\n• Todos los Expense (todas las categorías)\n\n**Qué NO incluye:**\n• Retiros de caja (Withdrawal) — son flujo de efectivo, no costos\n• Reservas hoteleras no cobradas todavía\n• Impuestos del corporativo (los gestiona contabilidad por separado)\n• Renta del local, depreciación, etc. (también contabilidad aparte)\n• Ventas canceladas (no entran porque su amountCents queda en 0)\n\nAsí que esta 'utilidad neta' es realmente **utilidad operativa**: cuánto generó el negocio de su operación pura.",
  },
  {
    question: "¿Por qué la gráfica de 'Ventas por hora' tiene todo en las 0h?",
    answer:
      "Esto pasa cuando tus ventas vienen importadas de XMLs de SoftRestaurant y el respaldo no incluye hora del ticket (solo fecha).\n\nPara ventas registradas EN VIVO en el POS (después de implementar el sistema), la hora sí se guarda y la gráfica funciona correctamente.\n\nNo hay forma automática de recuperar la hora exacta de tickets históricos. La gráfica seguirá funcionando bien para datos futuros.",
  },
  {
    question: "¿Las gráficas usan timezone de México?",
    answer:
      "Sí. Todos los cálculos respetan el horario de México (America/Mexico_City, UTC-6 sin horario de verano desde 2022).\n\nUn ticket cobrado a las 23:50 del 14 de mayo MX se cuenta en el día 14, no en el 15 (aunque en UTC sea 5:50 del día 15).\n\nLas gráficas, los filtros de período y los KPIs usan SQL con `AT TIME ZONE 'America/Mexico_City'` para garantizar esto.",
  },
  {
    question: "¿Por qué a veces no veo el porcentaje de cambio (flecha)?",
    answer:
      "Hay 3 casos donde no se muestra:\n\n1. **No hay comparación habilitada** — Click en 'Comparar' arriba y elige 'Período anterior' o 'Hace 1 año'.\n\n2. **El período de comparación no tiene datos** — Por ejemplo, si seleccionas 'Hace 1 año' pero el negocio empezó hace 6 meses, no hay datos del año anterior. La división por 0 daría infinito, así que se oculta.\n\n3. **Cambio menor a 0.5%** — Se muestra como '0%' con ícono '—' (gris).",
  },
  {
    question: "¿Puedo guardar mis filtros favoritos?",
    answer:
      "Todavía no hay un botón de 'Guardar vista', pero los filtros se guardan en la URL automáticamente.\n\nPuedes:\n\n• **Crear un marcador del navegador** con el URL del filtro que más uses (Ctrl+D en Chrome/Firefox)\n• **Compartir el link** copiando el URL y mandándolo a otro manager\n• **F5 sin perder filtros** — los mantiene siempre\n\nEjemplo de URL con filtros: `/app/manager/ops/finances?preset=thismonth&biz=cmn27it1v...&compare=prev_year`",
  },
  {
    question: "¿Qué pasa si la flecha es negativa pero el negocio va bien?",
    answer:
      "Mira el contexto:\n\n• **Comparativa con tiempo atrás puede ser engañosa** — Si comparas un mes pico (diciembre) con uno normal (febrero), febrero siempre será negativo. Usa 'Hace 1 año' para evitar estacionalidad.\n\n• **Falta de datos** — Si el negocio acaba de empezar y comparas con un período donde no había datos, el delta puede salir engañoso.\n\n• **Una sola métrica no cuenta toda la historia** — Las ventas pueden bajar mientras suben los márgenes (vendes menos pero más caro). Mira el ticket promedio y la utilidad neta también.",
  },
  {
    question: "¿Cuántos datos puedo exportar a Excel?",
    answer:
      "Hasta 10,000 ventas y 10,000 gastos por exportación. Para datasets más grandes (varios años), usa filtros de fecha más estrechos y exporta por separado.\n\nEn el drill-down (modal), el límite es 500 registros por modal.\n\nEl Excel pesa entre 100KB y 5MB típicamente. Si llegas al límite te avisamos.",
  },
  {
    question: "¿Por qué algunos negocios no aparecen en mis filtros?",
    answer:
      "Solo ves los negocios donde el sistema te dio acceso. Tu rol determina esto:\n\n• **MASTER_ADMIN / OWNER / SUPERIOR**: ven TODOS los negocios\n• **MANAGER_OPS**: ve los negocios donde está asignado\n• **MANAGER_RESTAURANT / RANCH**: ven solo su sección\n\nSi crees que falta un negocio, pide a un admin que te agregue acceso. El admin va a `/app/admin/users` y modifica tu perfil.",
  },
];

/* ═══════════════════════════════════════════════════════════════
 * GUÍAS PASO A PASO
 * ═══════════════════════════════════════════════════════════════ */

export type GuideEntry = {
  slug: string;
  title: string;
  description: string;
  steps: string[];
  tip?: string;
};

export const GUIDES: GuideEntry[] = [
  {
    slug: "primer-vistazo",
    title: "Cómo dar tu primer vistazo al panel",
    description: "Si es tu primera vez aquí, sigue estos 5 pasos para sacar provecho.",
    steps: [
      "Mira los **4 KPI cards** arriba. Te dicen: cuánto vendiste, gastaste, ganaste neto, y tu ticket promedio. La flecha verde/roja te dice si subió o bajó vs el período de comparación.",
      "Cambia el **período arriba** (donde dice 'Este mes'). Prueba 'Últimos 3 meses' para ver tendencias.",
      "Mira la **gráfica de ventas**. Identifica picos y valles. ¿Qué día/semana fue el mejor?",
      "Mira la **dona de métodos de pago**. ¿Tu negocio depende mucho de tarjeta? ¿O de efectivo?",
      "Si tienes varios negocios, baja a la sección **'Por negocio'**. Identifica cuál vende más y cuál genera más utilidad.",
    ],
    tip: "Tómate 10 minutos cada mañana para revisar el panel del día anterior. Vas a empezar a detectar patrones rápido.",
  },
  {
    slug: "investigar-baja-ventas",
    title: "Cómo investigar una baja en ventas",
    description: "Si la flecha de Ventas está en rojo, sigue estos pasos.",
    steps: [
      "Confirma que el **período de comparación** es relevante. Si comparas Enero vs Diciembre, la caída es por estacionalidad. Cambia a 'Hace 1 año' para una comparación más justa.",
      "Mira la **gráfica de ventas en el tiempo**: ¿la caída fue gradual o repentina? Si fue repentina, probablemente hubo un evento específico (cierre, problema operativo, etc.).",
      "Ve a **Reportes** y revisa **'Por día de la semana'**: ¿cayeron específicos días? Por ejemplo, si Lunes a Jueves caen pero el fin de semana se mantiene, puede ser un cambio de hábito del cliente local.",
      "Mira la **dona de métodos de pago**: ¿cambió la distribución? Si bajó la tarjeta, ¿hubo problema con la terminal?",
      "Mira la **comparativa entre negocios**: ¿cayeron todos o solo uno? Si fue solo uno, enfócate ahí.",
      "Haz **drill-down** clickeando 'Ventas recientes' → revisa las 50 últimas. ¿Hay tickets que se vean raros? ¿Cancelaciones?",
    ],
    tip: "Las bajas raramente son por una sola causa. Cruza varios datos antes de concluir.",
  },
  {
    slug: "importar-xml",
    title: "Cómo importar respaldo de SoftRestaurant",
    description: "Subir un respaldo histórico para poblar el sistema con datos viejos.",
    steps: [
      "Necesitas rol **MASTER_ADMIN, OWNER o SUPERIOR**. Si eres manager normal, pide a un admin que lo haga.",
      "Ve a **`/app/admin/import/xml`**",
      "Selecciona el **negocio destino**. ⚠️ Esto es importante: si subes a Bodega 4, todos los datos se asignan ahí. NO se puede mover después.",
      "Click en 'Seleccionar archivos' y arrastra TODOS los XMLs del respaldo (puedes seleccionar varios a la vez con Ctrl+A en el explorador).",
      "Verifica los archivos cargados. Cada uno debe mostrar su nombre y tamaño.",
      "Click 'Importar a [negocio]'. **Espera** sin cerrar la ventana — puede tardar 5-30 segundos dependiendo del tamaño.",
      "Cuando termine, verás un resumen por archivo: importados, omitidos (duplicados), errores. Si hay errores, click 'Ver detalles' para entender qué falló.",
      "Ve a **`/app/manager/ops`** y cambia el período a 'Últimos 3 meses'. Deberías ver tus datos ya cargados.",
    ],
    tip: "Si re-importas el mismo XML, no se duplican datos (idempotencia por folio). Es seguro intentar de nuevo si dudas.",
  },
  {
    slug: "exportar-mes",
    title: "Cómo generar el reporte del mes para contabilidad",
    description: "Pasos para exportar todo lo necesario para entregar.",
    steps: [
      "Ve a **`/app/manager/ops/finances`**",
      "Selecciona el período: **'Mes pasado'** (si ya cerró) o **'Este mes'** (si quieres un vistazo de medio mes)",
      "Si quieres solo un negocio, selecciónalo en el filtro 'Negocios'. Si quieres todos juntos, déjalo en 'Todos'.",
      "Click **'Exportar'** arriba a la derecha → **'Excel (.xlsx)'**",
      "Después de 2-3 segundos, descarga el archivo automáticamente",
      "El archivo tendrá 6 hojas: Resumen, Ventas, Gastos, Por negocio, Por método pago, Por categoría. Mándalo a contabilidad.",
      "Si tu contador necesita PDF, repite el proceso pero elige 'Imprimir / PDF' en lugar de Excel. En el diálogo del navegador, elige 'Guardar como PDF' como destino.",
    ],
    tip: "Para reportes recurrentes, guarda el URL como marcador. La próxima vez solo abres el favorito y exportas — todo en 2 clicks.",
  },
];
