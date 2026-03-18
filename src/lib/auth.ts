import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
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
        if (!user || !user.isActive) return null;

        const ok = password === user.passwordHash;
        if (!ok) return null;

        // lo que regresas aquí se guarda en el token (jwt)
        return {
          id: user.id,
          name: user.fullName,
          username: user.username,
          role: user.role,
          primaryBusinessId: user.primaryBusinessId ?? null,
        } as any;
      },
    }),
  ],
  callbacks: {
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
      (session as any).user.id = token.uid;
      (session as any).user.role = token.role;
      (session as any).user.username = token.username;
      (session as any).user.primaryBusinessId = token.primaryBusinessId;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
