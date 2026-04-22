// Catálogo de plantillas por tipo de importación

export type ImportEntityType =
  | "SALES"
  | "EXPENSES"
  | "WITHDRAWALS"
  | "HOTEL_RESERVATIONS"
  | "GUESTS"
  | "INVENTORY_ITEMS"
  | "EMPLOYEES";

export type TemplateColumn = {
  key: string;           // nombre en el CSV/Excel
  label: string;         // etiqueta legible
  required: boolean;
  type: "text" | "number" | "date" | "datetime" | "boolean" | "money" | "enum";
  description: string;
  example: string | number | boolean;
  enumOptions?: string[];
};

export type TemplateDefinition = {
  entityType: ImportEntityType;
  label: string;
  description: string;
  icon: string; // nombre de ícono lucide-react
  needsBusiness: boolean;
  columns: TemplateColumn[];
  exampleRows: Record<string, string | number | boolean>[];
};

/* ═══════════════════════════ VENTAS ═══════════════════════════ */

export const TEMPLATE_SALES: TemplateDefinition = {
  entityType: "SALES",
  label: "Ventas",
  description: "Registra transacciones de venta históricas",
  icon: "DollarSign",
  needsBusiness: true,
  columns: [
    { key: "fecha",      label: "Fecha",      required: true,  type: "date",
      description: "Fecha de la venta. Formato YYYY-MM-DD o DD/MM/YYYY",
      example: "2026-01-15" },
    { key: "hora",       label: "Hora",       required: false, type: "text",
      description: "Hora (HH:MM). Si no se da, se asume 12:00",
      example: "14:30" },
    { key: "concepto",   label: "Concepto",   required: true,  type: "text",
      description: "Descripción de la venta",
      example: "Desayuno mesa 3" },
    { key: "monto",      label: "Monto",      required: true,  type: "money",
      description: "Total de la venta en pesos (ej: 1500.50)",
      example: 1500.50 },
    { key: "metodo",     label: "Método pago", required: true, type: "enum",
      enumOptions: ["CASH", "CARD", "TRANSFER", "efectivo", "tarjeta", "transferencia"],
      description: "CASH | CARD | TRANSFER (o en español)",
      example: "CASH" },
    { key: "cajero",     label: "Cajero",     required: false, type: "text",
      description: "Email o username del cajero (si existe lo asocia)",
      example: "juan@optcaminodepiedra.com" },
    { key: "caja",       label: "Caja",       required: false, type: "text",
      description: "Nombre de la caja (cashpoint). Si no existe se crea",
      example: "Caja Principal" },
    { key: "folio",      label: "Folio",      required: false, type: "text",
      description: "Folio/ticket externo (opcional)",
      example: "A-0123" },
  ],
  exampleRows: [
    { fecha: "2026-01-15", hora: "14:30", concepto: "Comida familia", monto: 1250.00, metodo: "CASH", cajero: "", caja: "Caja Principal", folio: "A-001" },
    { fecha: "2026-01-15", hora: "20:15", concepto: "Cena romántica", monto: 2800.00, metodo: "CARD", cajero: "", caja: "Caja Principal", folio: "A-002" },
    { fecha: "2026-01-16", hora: "09:00", concepto: "Desayunos grupo", monto: 3500.00, metodo: "TRANSFER", cajero: "", caja: "Caja Principal", folio: "A-003" },
  ],
};

/* ═══════════════════════════ GASTOS ═══════════════════════════ */

export const TEMPLATE_EXPENSES: TemplateDefinition = {
  entityType: "EXPENSES",
  label: "Gastos",
  description: "Registra gastos operativos históricos",
  icon: "TrendingDown",
  needsBusiness: true,
  columns: [
    { key: "fecha",      label: "Fecha",      required: true,  type: "date",
      description: "Formato YYYY-MM-DD o DD/MM/YYYY", example: "2026-01-15" },
    { key: "categoria",  label: "Categoría",  required: true,  type: "text",
      description: "Categoría del gasto (libre)", example: "Servicios" },
    { key: "monto",      label: "Monto",      required: true,  type: "money",
      description: "Monto en pesos", example: 2500.00 },
    { key: "nota",       label: "Nota/Detalle",required: false,type: "text",
      description: "Descripción del gasto", example: "Pago CFE enero" },
    { key: "proveedor",  label: "Proveedor",  required: false, type: "text",
      description: "Nombre del proveedor", example: "CFE" },
    { key: "responsable",label: "Responsable",required: false, type: "text",
      description: "Email o username de quien autorizó",
      example: "claudia.o" },
  ],
  exampleRows: [
    { fecha: "2026-01-05", categoria: "Servicios",    monto: 3200.00, nota: "CFE enero",         proveedor: "CFE",          responsable: "" },
    { fecha: "2026-01-10", categoria: "Insumos",      monto: 1500.00, nota: "Compra frutas",     proveedor: "Mercado",      responsable: "" },
    { fecha: "2026-01-15", categoria: "Mantenimiento",monto: 800.00,  nota: "Reparación bomba",  proveedor: "Pedro Flores", responsable: "" },
  ],
};

/* ═══════════════════════════ RETIROS ═══════════════════════════ */

export const TEMPLATE_WITHDRAWALS: TemplateDefinition = {
  entityType: "WITHDRAWALS",
  label: "Retiros de caja",
  description: "Registra retiros de efectivo históricos",
  icon: "Wallet",
  needsBusiness: true,
  columns: [
    { key: "fecha",      label: "Fecha",      required: true,  type: "date",
      description: "Fecha del retiro", example: "2026-01-15" },
    { key: "monto",      label: "Monto",      required: true,  type: "money",
      description: "Monto en pesos", example: 5000.00 },
    { key: "motivo",     label: "Motivo",     required: false, type: "text",
      description: "Razón del retiro", example: "Pago proveedor semanal" },
    { key: "tipo",       label: "Tipo",       required: false, type: "enum",
      enumOptions: ["PETTY_CASH", "LARGE_REQUEST", "chica", "grande"],
      description: "PETTY_CASH (caja chica) | LARGE_REQUEST (grande). Default: grande",
      example: "LARGE_REQUEST" },
    { key: "caja",       label: "Caja",       required: false, type: "text",
      description: "Nombre del cashpoint", example: "Caja Principal" },
    { key: "solicitante",label: "Solicitante",required: false, type: "text",
      description: "Email o username de quien retiró",
      example: "judith.r" },
  ],
  exampleRows: [
    { fecha: "2026-01-07", monto: 8000.00, motivo: "Depósito bancario",   tipo: "LARGE_REQUEST", caja: "Caja Principal", solicitante: "" },
    { fecha: "2026-01-14", monto: 500.00,  motivo: "Compra gas cocina",   tipo: "PETTY_CASH",    caja: "Caja Principal", solicitante: "" },
    { fecha: "2026-01-21", monto: 12000.00,motivo: "Pago nómina parcial", tipo: "LARGE_REQUEST", caja: "Caja Principal", solicitante: "" },
  ],
};

/* ═══════════════════════════ RESERVACIONES DE HOTEL ═══════════════════════════ */

export const TEMPLATE_HOTEL_RESERVATIONS: TemplateDefinition = {
  entityType: "HOTEL_RESERVATIONS",
  label: "Reservaciones de hotel",
  description: "Historial de reservaciones de habitaciones",
  icon: "BedDouble",
  needsBusiness: true,
  columns: [
    { key: "checkin",       label: "Check-in",       required: true,  type: "date",
      description: "Fecha de llegada", example: "2026-02-10" },
    { key: "checkout",      label: "Check-out",      required: true,  type: "date",
      description: "Fecha de salida", example: "2026-02-13" },
    { key: "huesped",       label: "Nombre huésped", required: true,  type: "text",
      description: "Nombre completo del huésped", example: "Juan Pérez López" },
    { key: "email",         label: "Email huésped",  required: false, type: "text",
      description: "Email del huésped", example: "juan@example.com" },
    { key: "telefono",      label: "Teléfono",       required: false, type: "text",
      description: "Teléfono del huésped", example: "4151234567" },
    { key: "habitacion",    label: "Habitación",     required: false, type: "text",
      description: "Nombre o número de habitación", example: "Suite 101" },
    { key: "adultos",       label: "Adultos",        required: true,  type: "number",
      description: "Número de adultos", example: 2 },
    { key: "ninos",         label: "Niños",          required: false, type: "number",
      description: "Número de niños", example: 0 },
    { key: "monto_total",   label: "Monto total",    required: false, type: "money",
      description: "Total cobrado por la reserva", example: 4500.00 },
    { key: "estado",        label: "Estado",         required: false, type: "enum",
      enumOptions: ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELED"],
      description: "Default: CHECKED_OUT (si ya pasó)", example: "CHECKED_OUT" },
    { key: "incluye_alimentos", label: "Incluye alimentos", required: false, type: "boolean",
      description: "Sí/No. Si Sí, revisar pax_alimentos", example: false },
    { key: "pax_alimentos", label: "Pax alimentos",  required: false, type: "number",
      description: "Cantidad de comensales con alimentos", example: 0 },
    { key: "notas",         label: "Notas",          required: false, type: "text",
      description: "Observaciones", example: "Aniversario" },
  ],
  exampleRows: [
    { checkin: "2026-02-10", checkout: "2026-02-13", huesped: "Juan Pérez López", email: "juan@ex.com", telefono: "4151234567", habitacion: "Suite 101", adultos: 2, ninos: 0, monto_total: 4500, estado: "CHECKED_OUT", incluye_alimentos: false, pax_alimentos: 0, notas: "Aniversario" },
    { checkin: "2026-02-12", checkout: "2026-02-14", huesped: "Ana Gómez", email: "", telefono: "", habitacion: "Cabaña 2", adultos: 2, ninos: 1, monto_total: 3200, estado: "CHECKED_OUT", incluye_alimentos: true, pax_alimentos: 3, notas: "" },
  ],
};

/* ═══════════════════════════ HUÉSPEDES (catálogo) ═══════════════════════════ */

export const TEMPLATE_GUESTS: TemplateDefinition = {
  entityType: "GUESTS",
  label: "Huéspedes",
  description: "Catálogo de huéspedes para reservas futuras",
  icon: "Users",
  needsBusiness: false,
  columns: [
    { key: "nombre",     label: "Nombre completo", required: true,  type: "text",
      description: "Nombre del huésped", example: "Juan Pérez" },
    { key: "email",      label: "Email",           required: false, type: "text",
      description: "Email del huésped", example: "juan@example.com" },
    { key: "telefono",   label: "Teléfono",        required: false, type: "text",
      description: "Teléfono", example: "4151234567" },
    { key: "documento",  label: "Documento/INE",   required: false, type: "text",
      description: "Número de documento de identidad", example: "123456789" },
    { key: "pais",       label: "País",            required: false, type: "text",
      description: "País de origen", example: "México" },
    { key: "notas",      label: "Notas",           required: false, type: "text",
      description: "Observaciones", example: "Cliente frecuente" },
  ],
  exampleRows: [
    { nombre: "Juan Pérez López", email: "juan@ex.com", telefono: "4151234567", documento: "123456789", pais: "México", notas: "VIP" },
    { nombre: "Ana Gómez",         email: "",            telefono: "5512345678", documento: "",         pais: "México", notas: "" },
  ],
};

/* ═══════════════════════════ INVENTARIO ═══════════════════════════ */

export const TEMPLATE_INVENTORY: TemplateDefinition = {
  entityType: "INVENTORY_ITEMS",
  label: "Productos de inventario",
  description: "Catálogo de items con stock inicial",
  icon: "Package",
  needsBusiness: true,
  columns: [
    { key: "nombre",      label: "Nombre",           required: true,  type: "text",
      description: "Nombre del producto", example: "Tomate saladet" },
    { key: "sku",         label: "SKU",              required: false, type: "text",
      description: "Código único", example: "TOM-SAL-001" },
    { key: "categoria",   label: "Categoría",        required: false, type: "text",
      description: "Categoría", example: "Verduras" },
    { key: "unidad",      label: "Unidad",           required: true,  type: "text",
      description: "kg, pz, l, etc", example: "kg" },
    { key: "stock",       label: "Stock inicial",    required: false, type: "number",
      description: "Cantidad en existencia", example: 50 },
    { key: "minimo",      label: "Stock mínimo",     required: false, type: "number",
      description: "Cantidad mínima antes de alerta", example: 10 },
    { key: "precio",      label: "Último precio",    required: false, type: "money",
      description: "Último precio de compra", example: 25.50 },
    { key: "proveedor",   label: "Proveedor",        required: false, type: "text",
      description: "Nombre del proveedor principal", example: "Mercado Central" },
  ],
  exampleRows: [
    { nombre: "Tomate saladet",  sku: "TOM-001", categoria: "Verduras",  unidad: "kg", stock: 50,  minimo: 10, precio: 25.50, proveedor: "Mercado" },
    { nombre: "Harina de trigo", sku: "HAR-001", categoria: "Abarrotes", unidad: "kg", stock: 100, minimo: 20, precio: 18.00, proveedor: "Costco" },
    { nombre: "Gas LP 20kg",     sku: "GAS-020", categoria: "Energía",   unidad: "tanque", stock: 2, minimo: 1, precio: 620.00, proveedor: "Gasomatico" },
  ],
};

/* ═══════════════════════════ EMPLEADOS ═══════════════════════════ */

export const TEMPLATE_EMPLOYEES: TemplateDefinition = {
  entityType: "EMPLOYEES",
  label: "Empleados",
  description: "Crea usuarios que podrán entrar con su Gmail",
  icon: "Users",
  needsBusiness: false,
  columns: [
    { key: "nombre",        label: "Nombre completo",  required: true,  type: "text",
      description: "Nombre y apellidos", example: "María González Ruiz" },
    { key: "email",         label: "Email (Gmail)",    required: true,  type: "text",
      description: "Su cuenta Gmail con la que hará login",
      example: "maria.gonzalez@gmail.com" },
    { key: "username",      label: "Username",         required: false, type: "text",
      description: "Nombre de usuario (si no se da se genera)", example: "maria.g" },
    { key: "rol",           label: "Rol",              required: true,  type: "enum",
      enumOptions: [
        "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH",
        "ACCOUNTING", "SALES", "RESERVATIONS", "INVENTORY",
        "STAFF_KITCHEN", "STAFF_BAR", "STAFF_WAITER", "STAFF_RECEPTION",
        "STAFF_EXPERIENCES", "STAFF_CASHIER", "STAFF_HOUSEKEEPING",
        "STAFF_MAINTENANCE", "STAFF_FIELD", "STAFF_STORE",
      ],
      description: "Rol del empleado en el sistema",
      example: "STAFF_WAITER" },
    { key: "negocio",       label: "Negocio principal", required: false, type: "text",
      description: "Nombre del negocio al que pertenece",
      example: "Bodega 4" },
    { key: "puesto",        label: "Puesto (job title)", required: false, type: "text",
      description: "Puesto específico", example: "Mesero" },
    { key: "departamento",  label: "Departamento",      required: false, type: "text",
      description: "Área/departamento", example: "Servicio" },
    { key: "fecha_ingreso", label: "Fecha de ingreso",  required: false, type: "date",
      description: "Fecha de contratación", example: "2025-06-01" },
  ],
  exampleRows: [
    { nombre: "María González Ruiz",  email: "maria.gonzalez@gmail.com", username: "maria.g",    rol: "STAFF_WAITER",    negocio: "Bodega 4", puesto: "Mesera",    departamento: "Servicio", fecha_ingreso: "2025-06-01" },
    { nombre: "Pedro Flores Méndez",  email: "pedro.flores@gmail.com",   username: "pedro.f",    rol: "STAFF_KITCHEN",   negocio: "Bodega 4", puesto: "Cocinero",  departamento: "Cocina",   fecha_ingreso: "2024-11-15" },
    { nombre: "Laura Hernández",      email: "laura.h@gmail.com",         username: "laura.h",    rol: "STAFF_RECEPTION", negocio: "Hotel Camino de Piedra", puesto: "Recepción", departamento: "Front Desk", fecha_ingreso: "2025-03-10" },
  ],
};

/* ═══════════════════════════ REGISTRY ═══════════════════════════ */

export const TEMPLATES: Record<ImportEntityType, TemplateDefinition> = {
  SALES: TEMPLATE_SALES,
  EXPENSES: TEMPLATE_EXPENSES,
  WITHDRAWALS: TEMPLATE_WITHDRAWALS,
  HOTEL_RESERVATIONS: TEMPLATE_HOTEL_RESERVATIONS,
  GUESTS: TEMPLATE_GUESTS,
  INVENTORY_ITEMS: TEMPLATE_INVENTORY,
  EMPLOYEES: TEMPLATE_EMPLOYEES,
};

export function getTemplate(entityType: ImportEntityType): TemplateDefinition {
  return TEMPLATES[entityType];
}

export function listTemplates(): TemplateDefinition[] {
  return Object.values(TEMPLATES);
}
