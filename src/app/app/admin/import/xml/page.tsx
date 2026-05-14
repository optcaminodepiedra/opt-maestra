import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, FileCode, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { XmlImportClient } from "@/components/admin/XmlImportClient";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

export default async function XmlImportPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const me = session.user as { id?: string; role?: string };
  const role = me.role as string;

  if (!ADMIN_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" /> Sin acceso
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Solo administradores pueden importar data.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Variables de entorno públicas para que el cliente pueda subir a Storage
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="w-5 h-5" /> Configuración incompleta
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Faltan variables de entorno en Vercel:</p>
            <ul className="list-disc ml-5 text-muted-foreground">
              {!supabaseUrl && <li><code>NEXT_PUBLIC_SUPABASE_URL</code></li>}
              {!supabaseAnonKey && <li><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>}
            </ul>
            <p className="text-muted-foreground">
              Configura en Vercel → Settings → Environment Variables.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const businessId = sp.businessId;

  const businesses = await prisma.business.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (!businessId) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/admin/import">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver a Imports
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-blue-500" />
              Importar XMLs SoftRestaurant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecciona el negocio destino para importar los respaldos XML.
            </p>
            <div className="grid gap-2">
              {businesses.map((b) => (
                <Button
                  key={b.id}
                  variant="outline"
                  className="justify-start h-auto py-3"
                  asChild
                >
                  <Link href={`/app/admin/import/xml?businessId=${b.id}`}>
                    <div className="text-left">
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground font-normal">
                        Importar XMLs a este negocio
                      </p>
                    </div>
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });

  if (!business) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader><CardTitle>Negocio no encontrado</CardTitle></CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/admin/import/xml">
          <ArrowLeft className="w-4 h-4 mr-1" /> Cambiar negocio
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileCode className="w-7 h-7 text-blue-500" />
          Importar XMLs SoftRestaurant
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Subiendo a: <strong>{business.name}</strong>
        </p>
      </div>

      <XmlImportClient
        businessId={business.id}
        businessName={business.name}
        supabaseUrl={supabaseUrl}
        supabaseAnonKey={supabaseAnonKey}
      />
    </div>
  );
}
