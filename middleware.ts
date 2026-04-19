/**
 * middleware.ts
 * 
 * Este archivo va en la RAÍZ del proyecto (mismo nivel que package.json).
 * Next.js lo ejecuta automáticamente en CADA petición antes de mostrar la página.
 * 
 * Ventaja: no tienes que tocar cada página individual.
 * Solo defines aquí qué rutas puede ver cada rol.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// ─── Qué rutas puede acceder cada rol ────────────────────────────────────────
//
// La clave es el PREFIJO de la ruta. Si el rol tiene "/app/pos" puede
// acceder a /app/pos, /app/pos/abrir, /app/pos/cierre, etc.
//
// Orden de evaluación: de más específico a más general.

const ROUTE_PERMISSIONS: Record<string, string[]> = {
  // Rutas que VE TODO EL MUNDO (con sesión)
  "/app":                    ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","STAFF_STORE","MANAGER"],
  "/app/profile":            ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","STAFF_STORE","MANAGER"],
  "/app/attendance":         ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","STAFF_STORE","MANAGER"],

  // POS y Caja
  "/app/pos":                ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_RANCH","STAFF_BAR","STAFF_CASHIER","STAFF_STORE","MANAGER"],
  "/app/cashpoint":          ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_RANCH","STAFF_CASHIER","MANAGER"],
  "/app/shifts":             ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_RANCH","STAFF_CASHIER","MANAGER"],

  // Restaurante
  "/app/tables":             ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_WAITER","MANAGER"],
  "/app/orders":             ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_WAITER","STAFF_BAR","STAFF_CASHIER","MANAGER"],
  "/app/menu":               ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER"],
  "/app/kds":                ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_KITCHEN","MANAGER"],

  // Hotel
  "/app/hotel":              ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","RESERVATIONS","STAFF_RECEPTION","MANAGER"],
  "/app/reservations":       ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","RESERVATIONS","SALES","STAFF_RECEPTION","MANAGER"],

  // Inventario
  "/app/inventory":          ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","MANAGER"],
  "/app/requisitions":       ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","INVENTORY","MANAGER"],

  // Retiros
  "/app/withdrawals":        ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_RANCH","ACCOUNTING","MANAGER"],

  // Experiencias (Rancho)
  "/app/experiences":        ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RANCH","STAFF_EXPERIENCES","MANAGER"],

  // Spa (Tierra Adentro)
  "/app/spa":                ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER"],

  // Tienda y Torniquete
  "/app/store":              ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","STAFF_STORE","MANAGER"],
  "/app/turnstile":          ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","STAFF_STORE","MANAGER"],

  // Tareas y Tickets
  "/app/tasks":              ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","MANAGER"],

  // Horarios / Plantilla
  "/app/schedule":           ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","MANAGER"],

  // RRHH y Vacaciones
  "/app/hr":                 ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","MANAGER"],
  "/app/vacations":          ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","STAFF_STORE","MANAGER"],

  // Reportes y Contabilidad
  "/app/reports":            ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","MANAGER"],
  "/app/accounting":         ["MASTER_ADMIN","OWNER","SUPERIOR","ACCOUNTING"],

  // Usuarios y Configuración (solo admins y dueños)
  "/app/owner":              ["MASTER_ADMIN","OWNER","SUPERIOR"],
  "/app/settings":           ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH"],
}

// ─── Lógica del middleware ────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Las rutas públicas no necesitan revisión
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next()
  }

  // Obtener sesión del usuario
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  // Sin sesión → al login
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const userRole = token.role as string

  // Buscar qué ruta aplica (de más específica a más general)
  const sortedRoutes = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length)
  const matchedRoute = sortedRoutes.find(route => pathname.startsWith(route))

  if (matchedRoute) {
    const allowedRoles = ROUTE_PERMISSIONS[matchedRoute]
    if (!allowedRoles.includes(userRole)) {
      // No tiene permiso → redirige al inicio de la app
      return NextResponse.redirect(new URL("/app", request.url))
    }
  }

  return NextResponse.next()
}

// Qué rutas procesa el middleware (todas las de la app)
export const config = {
  matcher: ["/app/:path*", "/login"],
}