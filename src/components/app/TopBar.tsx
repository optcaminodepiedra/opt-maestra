"use client";

import Image from "next/image";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { QuickActions } from "@/components/app/QuickActions";

export function TopBar({
  name,
  leftSlot,
}: {
  name: string;
  leftSlot?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/70 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {leftSlot}

          <div className="hidden sm:flex items-center gap-3">
            <Image
              src="/brand/logo-color.png"
              alt="Camino de Piedra"
              width={140}
              height={28}
              className="h-7 w-auto"
              priority
            />
            <div className="h-6 w-px bg-border" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">Panel Operativo</div>
              <div className="text-xs text-muted-foreground">
                Sesión: {name}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Acciones rápidas */}
          <QuickActions />

          {/* acento */}
          <div className="hidden md:block h-2 w-40 rounded-full bg-gradient-to-r from-primary to-accent opacity-90" />

          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </Button>
        </div>
      </div>
    </header>
  );
}
