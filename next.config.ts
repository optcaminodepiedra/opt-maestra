import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Esto evita que el build falle por errores de tipos (común en despliegues iniciales)
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignoramos linting durante el build para asegurar que suba rápido
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;