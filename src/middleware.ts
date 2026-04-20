/**
 * src/middleware.ts
 *
 * IMPORTANTE: Este archivo va en src/middleware.ts
 * NO en la raíz del proyecto. Next.js con directorio src/
 * busca el middleware DENTRO de src/.
 *
 * Si tienes un middleware.ts en la raíz, BÓRRALO.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const ROUTE_PERMISSIONS: Record<string, string[]> = {
  // Rutas que VE TODO EL MUNDO (con sesión activa)
  "/app/reloj":      ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","STAFF_STORE","MANAGER"],
  "/app/vacations":  ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","STAFF_STORE","MANAGER"],
  "/app/ops":        ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","STAFF_STORE","MANAGER"],
  "/app/profile":    ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","STAFF_STORE","MANAGER"],

  // Dashboards de gerentes — cada gerente solo ve el suyo (el page.tsx hace el redirect)
  "/app/manager":    ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","MANAGER"],

  // Administración — solo directivos
  "/app/owner":      ["MASTER_ADMIN","OWNER","SUPERIOR"],

  // Contabilidad
  "/app/accounting": ["MASTER_ADMIN","OWNER","SUPERIOR","ACCOUNTING"],

  // Inventario
  "/app/inventory":  ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","STAFF_STORE","MANAGER"],

  // Restaurante
  "/app/restaurant": ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_WAITER","STAFF_BAR","STAFF_CASHIER","STAFF_KITCHEN","MANAGER"],

  // Hotel
  "/app/hotel":      ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","RESERVATIONS","SALES","STAFF_RECEPTION","MANAGER"],

  // Finanzas
  "/app/reports":    ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","MANAGER"],
  "/app/payroll":    ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","MANAGER"],

  // Experiencias
  "/app/adventure":  ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RANCH","STAFF_EXPERIENCES","STAFF_FIELD","MANAGER"],

  // Tienda
  "/app/store":      ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","STAFF_STORE","MANAGER"],

  // Museos
  "/app/museums":    ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS"],

  // Settings
  "/app/settings":   ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH"],

  // Raíz /app — todos los roles con sesión pueden entrar (el page.tsx hace el redirect por rol)
  "/app":            ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS","INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION","STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE","STAFF_FIELD","STAFF_STORE","MANAGER"],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas — sin revisión
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next()
  }

  // Leer token JWT
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  // Sin sesión → login
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const userRole = token.role as string

  // Buscar la ruta más específica que coincida (orden: más larga primero)
  const sortedRoutes = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length)
  const matchedRoute = sortedRoutes.find(route => pathname.startsWith(route))

  if (matchedRoute) {
    const allowedRoles = ROUTE_PERMISSIONS[matchedRoute]
    if (!allowedRoles.includes(userRole)) {
      // Sin permiso → al dashboard raíz (que redirige según rol)
      return NextResponse.redirect(new URL("/app", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/app/:path*", "/login"],
}