import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

export const metadata = {
  title: "OPT Maestra",
  description: "Sistema Operativo – Camino de Piedra",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
