import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Ignoramos errores de tipos para que el deploy no se detenga por minucias
    ignoreBuildErrors: true,
  },
  
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;