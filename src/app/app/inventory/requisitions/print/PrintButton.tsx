"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90">
      <Printer className="w-4 h-4 mr-2" />
      Imprimir Lista
    </Button>
  );
}