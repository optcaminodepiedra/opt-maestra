import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // <--- Subimos el límite para que no haya duda
    },
  },
};

export default nextConfig;