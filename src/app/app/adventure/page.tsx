import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function Page() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Módulo en preparación</h1>
          <p className="text-sm text-muted-foreground">
            Este apartado está listo en la navegación para irlo construyendo después.
          </p>
        </div>
        <Badge variant="secondary">Próx</Badge>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Siguiente</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Aquí vamos a implementar el módulo completo con datos, flujos y reportes.
        </CardContent>
      </Card>
    </div>
  );
}
