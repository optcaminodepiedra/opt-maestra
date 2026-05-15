import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BookOpen, ArrowLeft, LayoutDashboard, DollarSign, FileText, Lightbulb,
} from "lucide-react";

import { HelpClient } from "@/components/help/HelpClient";
import { METRICS, GLOSSARY, FAQS, GUIDES } from "@/lib/help-catalog";

export const dynamic = "force-static";

export default function HelpPage() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-1 -ml-2">
          <Link href="/app/manager/ops">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Volver al panel
          </Link>
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-blue-500" />
          Centro de ayuda
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aprende qué significa cada métrica, cómo se calcula, y para qué te sirve.
        </p>
      </div>

      {/* Banner de intro */}
      <Card className="bg-gradient-to-br from-blue-50 to-transparent border-blue-200">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">¿Es tu primera vez aquí?</p>
            <p className="text-xs text-muted-foreground">
              Te recomendamos empezar por la guía <strong>"Cómo dar tu primer vistazo al panel"</strong> en la pestaña "Guías paso a paso". Solo toma 5 minutos.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Accesos rápidos a las páginas principales */}
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" asChild className="h-auto py-3 flex-col">
          <Link href="/app/manager/ops">
            <LayoutDashboard className="w-5 h-5 mb-1 text-blue-500" />
            <span className="text-xs">Dashboard</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col">
          <Link href="/app/manager/ops/finances">
            <DollarSign className="w-5 h-5 mb-1 text-green-500" />
            <span className="text-xs">Finanzas</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col">
          <Link href="/app/manager/ops/reports">
            <FileText className="w-5 h-5 mb-1 text-indigo-500" />
            <span className="text-xs">Reportes</span>
          </Link>
        </Button>
      </div>

      {/* Cliente interactivo */}
      <HelpClient
        metrics={METRICS}
        glossary={GLOSSARY}
        faqs={FAQS}
        guides={GUIDES}
      />

      {/* Footer */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 text-center text-xs text-muted-foreground">
          ¿No encuentras lo que buscas? Avisa al administrador del sistema para que actualice esta ayuda con la información que necesitas.
        </CardContent>
      </Card>
    </div>
  );
}
