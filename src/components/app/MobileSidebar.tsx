"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { NavSection } from "@/lib/nav";
import { Sidebar } from "@/components/app/Sidebar";

export function MobileSidebar({ sections }: { sections: NavSection[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Abrir menú</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="p-0 w-[90vw] max-w-[360px]">
        {/* ✅ Requerido por accesibilidad (Radix) */}
        <DialogHeader className="sr-only">
          <DialogTitle>Menú de navegación</DialogTitle>
        </DialogHeader>

        <div className="h-[85vh]">
          <Sidebar sections={sections} onNavigate={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
