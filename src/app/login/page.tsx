"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await signIn("credentials", {
      redirect: false,
      username: username.trim().toLowerCase(),
      password,
    });

    setLoading(false);

    if (res?.ok) {
      toast.success("Bienvenido");
      window.location.href = "/app";
      return;
    }

    toast.error("Usuario o contraseña incorrectos");
  }

  async function onGoogleSignIn() {
    setLoadingGoogle(true);
    // NextAuth redirige automáticamente a la página de Google
    await signIn("google", { callbackUrl: "/app" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">OPT Maestra</CardTitle>
          <p className="text-sm text-muted-foreground">
            Operadora Turística Camino de Piedra
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="arroiz"
                autoComplete="username"
                disabled={loading || loadingGoogle}
              />
            </div>

            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading || loadingGoogle}
              />
            </div>

            <Button className="w-full" disabled={loading || loadingGoogle}>
              {loading ? "Entrando..." : "Iniciar sesión"}
            </Button>
          </form>

          {/* Separador visual */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                O continuar con
              </span>
            </div>
          </div>

          {/* Botón de Google */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onGoogleSignIn}
            disabled={loading || loadingGoogle}
          >
            {loadingGoogle ? (
              "Conectando..."
            ) : (
              <>
                <svg
                  className="mr-2 h-4 w-4"
                  aria-hidden="true"
                  focusable="false"
                  data-prefix="fab"
                  data-icon="google"
                  role="img"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 488 512"
                >
                  <path
                    fill="currentColor"
                    d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                  ></path>
                </svg>
                Google
              </>
            )}
          </Button>

          <div className="mt-4 text-center text-xs text-muted-foreground">
            Version 1.0.0 Beta
          </div>
        </CardContent>
      </Card>
    </div>
  );
}