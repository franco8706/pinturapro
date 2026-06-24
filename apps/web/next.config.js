/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['cdn.sanity.io'],
  },
  experimental: {
    // Las fotos se redimensionan en el cliente (~200-500KB), pero damos margen.
    serverActions: { bodySizeLimit: '6mb' },
  },
}

module.exports = nextConfig
