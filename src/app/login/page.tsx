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
              />
            </div>

            <Button className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Iniciar sesión"}
            </Button>

            <div className="text-xs text-muted-foreground">
              Demo: contraseña temporal{" "}
              <span className="font-medium">Camino2026!</span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
