/**
 * Content-Security-Policy ajustada a lo que esta app carga de verdad:
 *   - Supabase: REST, Auth, Storage y realtime (wss).
 *   - OpenStreetMap: los tiles del mapa de pintores (painter-map.tsx).
 *   - data: y blob: en img/media: el simulador arma canvas, previews y máscaras base64.
 * 'unsafe-inline' en script-src es requisito de Next (bootstrap de hidratación); 'unsafe-eval'
 * sólo en desarrollo, que es donde lo necesita el refresh rápido.
 */
const isDev = process.env.NODE_ENV !== 'production'

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://replicate.delivery",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Clickjacking: el sitio no se embebe en ningún iframe.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Sin sniffing: un archivo del Storage no puede reinterpretarse como otro tipo.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // La app no usa cámara, micrófono ni geolocalización.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // no anunciar la versión del framework
  images: {
    // `domains` está deprecado en Next 15. Antes apuntaba a cdn.sanity.io, que nunca se
    // integró; las fotos hoy viven en el Storage de Supabase.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    // Las fotos se redimensionan en el cliente (~200-500KB), pero damos margen.
    serverActions: { bodySizeLimit: '6mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...securityHeaders,
          // HSTS sólo en producción: en local se sirve por http y romperia el desarrollo.
          ...(isDev
            ? []
            : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
        ],
      },
    ]
  },
}

module.exports = nextConfig
