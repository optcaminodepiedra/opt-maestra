/**
 * types/next-auth.d.ts
 *
 * Extiende los tipos de NextAuth para que TypeScript reconozca
 * los campos extras que guardas en el token (role, username, etc.)
 *
 * Sin este archivo verás errores como:
 *   "Property 'role' does not exist on type 'Session'"
 */

import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      username: string
      role: string
      primaryBusinessId: string | null
    }
  }

  interface User {
    id: string
    username: string
    role: string
    primaryBusinessId: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string
    username: string
    role: string
    primaryBusinessId: string | null
  }
}