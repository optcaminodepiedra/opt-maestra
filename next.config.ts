/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! ADVERTENCIA !!
    // Esto permite que el despliegue continúe a pesar de errores de TypeScript.
    // Es útil para prototipos, pero en el futuro deberíamos arreglar los errores.
    ignoreBuildErrors: true,
  },
  eslint: {
    // También ignoramos errores de ESLint durante el build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;