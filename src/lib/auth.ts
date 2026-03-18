import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    // Proveedor de Google
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Tu proveedor de credenciales actual
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim().toLowerCase();
        const password = credentials?.password ?? "";

        if (!username || !password) return null;

        const user = await prisma.user.findUnique({ where: { username } });
        // Verificamos que el usuario exista y esté activo
        if (!user || !user.isActive) return null;

        // NOTA: Mantengo tu validación temporal de texto plano. 
        // Recuerda volver a usar bcrypt.compare cuando encriptes las contraseñas.
        const ok = password === user.passwordHash;
        if (!ok) return null;

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          username: user.username,
          role: user.role,
          primaryBusinessId: user.primaryBusinessId ?? null,
        } as any;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Si el usuario entra con Google, verificamos que su correo exista en nuestra DB
      if (account?.provider === "google") {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email as string }
        });
        
        // Si el correo no está registrado en el sistema, no lo dejamos entrar
        if (!existingUser || !existingUser.isActive) return false;
        
        // Actualizamos el objeto user con los datos de nuestra base de datos
        user.id = existingUser.id;
        (user as any).role = existingUser.role;
        (user as any).username = existingUser.username;
        (user as any).primaryBusinessId = existingUser.primaryBusinessId;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id;
        token.role = (user as any).role;
        token.username = (user as any).username;
        token.primaryBusinessId = (user as any).primaryBusinessId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.uid;
        (session.user as any).role = token.role;
        (session.user as any).username = token.username;
        (session.user as any).primaryBusinessId = token.primaryBusinessId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};