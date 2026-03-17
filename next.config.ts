/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // ✅ fuerza a que Turbopack use ESTA carpeta como root
    root: __dirname,
  },
};

module.exports = nextConfig;