import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

/**
 * Qué roles pueden entrar a cada sección.
 * El sistema revisa el prefijo más largo que coincida con la URL actual.
 * Ejemplo: si alguien va a /app/owner/users, coincide con "/app/owner" antes que "/app".
 */
const RUTAS: Record<string, string[]> = {
  // Sección de administración — solo Rodrigo, dueños y dirección
  "/app/owner":        ["MASTER_ADMIN", "OWNER", "SUPERIOR"],
  "/app/settings":     ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH"],

  // POS y caja
  "/app/pos":          ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "STAFF_BAR", "STAFF_CASHIER", "STAFF_STORE", "MANAGER"],
  "/app/shifts":       ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "STAFF_CASHIER", "MANAGER"],
  "/app/cashpoint":    ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "STAFF_CASHIER", "MANAGER"],

  // Restaurante
  "/app/tables":       ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "STAFF_WAITER", "MANAGER"],
  "/app/orders":       ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "STAFF_WAITER", "STAFF_BAR", "STAFF_CASHIER", "MANAGER"],
  "/app/menu":         ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER"],
  "/app/kds":          ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "STAFF_KITCHEN", "MANAGER"],

  // Hotel
  "/app/hotel":        ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_HOTEL", "MANAGER_RANCH", "RESERVATIONS", "SALES", "STAFF_RECEPTION", "MANAGER"],
  "/app/reservations": ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_HOTEL", "MANAGER_RANCH", "RESERVATIONS", "SALES", "STAFF_RECEPTION", "MANAGER"],

  // Inventario
  "/app/inventory":    ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH", "ACCOUNTING", "INVENTORY", "MANAGER"],
  "/app/requisitions": ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH", "INVENTORY", "MANAGER"],

  // Retiros
  "/app/withdrawals":  ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "ACCOUNTING", "MANAGER"],

  // Experiencias (Rancho)
  "/app/experiences":  ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RANCH", "STAFF_EXPERIENCES", "STAFF_FIELD", "MANAGER"],

  // Spa (Tierra Adentro)
  "/app/spa":          ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER"],

  // Tienda y torniquete (Casa de los Lamentos)
  "/app/store":        ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "STAFF_STORE", "MANAGER"],
  "/app/turnstile":    ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "STAFF_STORE", "MANAGER"],

  // Finanzas y contabilidad
  "/app/reports":      ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH", "ACCOUNTING", "MANAGER"],
  "/app/accounting":   ["MASTER_ADMIN", "OWNER", "SUPERIOR", "ACCOUNTING"],

  // RRHH — solo gerentes y arriba
  "/app/hr":           ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH", "ACCOUNTING", "MANAGER"],
  "/app/schedule":     ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH", "MANAGER"],

  // Estas rutas las ve todo el mundo (con sesión activa)
  "/app/tasks":        ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","STAFF_STORE","MANAGER"],
  "/app/vacations":    ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","STAFF_STORE","MANAGER"],
  "/app/attendance":   ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","STAFF_STORE","MANAGER"],
  "/app/profile":      ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","STAFF_STORE","MANAGER"],
  "/app":              ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","STAFF_STORE","MANAGER"],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas — no requieren revisión
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next()
  }

  // Leer el token JWT (funciona con tu configuración actual de NextAuth)
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // Sin sesión → al login
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const rol = token.role as string

  // Buscar la ruta más específica que coincida con la URL actual
  // (ordena de más larga a más corta para que /app/owner gane sobre /app)
  const rutaCoincide = Object.keys(RUTAS)
    .sort((a, b) => b.length - a.length)
    .find(ruta => pathname.startsWith(ruta))

  if (rutaCoincide) {
    const rolesPermitidos = RUTAS[rutaCoincide]
    if (!rolesPermitidos.includes(rol)) {
      // No tiene permiso → regresa al inicio de la app
      return NextResponse.redirect(new URL("/app", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/app/:path*", "/login"],
}