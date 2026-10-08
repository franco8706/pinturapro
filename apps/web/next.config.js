/**
 * Content-Security-Policy ajustada a lo que esta app carga de verdad:
 *   - Supabase: REST, Auth, Storage y realtime (wss).
 *   - OpenStreetMap: los tiles del mapa de pintores (painter-map.tsx).
 *   - data: y blob: en img/media: el simulador arma canvas, previews y máscaras base64.
 * 'unsafe-inline' en script-src es requisito de Next (bootstrap de hidratación); 'unsafe-eval'
 * sólo en desarrollo, que es donde lo necesita el refresh rápido.
 */
const isDev = process.env.NODE_ENV !== 'production'

// La base local de pruebas (tools/auditoria/base-local) habla por http://127.0.0.1:54321. Sin
// esto el navegador no podía ni ingresar ("Failed to fetch": la CSP sólo permitía
// *.supabase.co). En producción la URL es siempre https://<ref>.supabase.co y esto queda vacío.
const supabaseLocal = (() => {
  try {
    const origen = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin
    return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origen) ? origen : ''
  } catch {
    return ''
  }
})()
const local = supabaseLocal ? ` ${supabaseLocal} ${supabaseLocal.replace('http:', 'ws:')}` : ''

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://replicate.delivery https://images.unsplash.com${local}`,
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${local}`,
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Con la base local (http) no se fuerza https: rompería cada pedido a ella.
  ...(supabaseLocal ? [] : ['upgrade-insecure-requests']),
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
  // El motor de color vive en packages/color como TypeScript sin compilar; Next tiene que
  // transpilarlo igual que al código de la app.
  transpilePackages: ['@pinturapro/color', '@pinturapro/dominio'],
  /**
   * Para Google Cloud Run (decisión del dueño). `standalone` hace que la compilación deje en
   * `.next/standalone` un servidor que trae SÓLO lo que usa: sin esto la imagen tendría que
   * llevar el `node_modules` entero del monorepo, que mide ~980 MB (medido por el agente
   * `nube-google`). Ver `apps/web/Dockerfile`.
   *
   * `outputFileTracingRoot` apunta a la raíz del monorepo: pnpm guarda las dependencias y los
   * paquetes compartidos (@pinturapro/color, @pinturapro/dominio) FUERA de apps/web, y sin
   * esto el rastreo de archivos no los encuentra y el servidor arranca sin ellos.
   *
   * En desarrollo (`next dev`) no cambia nada.
   */
  output: 'standalone',
  outputFileTracingRoot: require('path').join(__dirname, '../..'),
  reactStrictMode: true,
  poweredByHeader: false, // no anunciar la versión del framework
  images: {
    // `domains` está deprecado en Next 15. Antes apuntaba a cdn.sanity.io, que nunca se
    // integró; las fotos hoy viven en el Storage de Supabase. Unsplash es de las fotos
    // sembradas como demo (scripts/seed_supabase.py) — sin esto next/image las rechaza.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  experimental: {
    // Las fotos se redimensionan en el cliente (~200-500KB), pero damos margen.
    serverActions: { bodySizeLimit: '6mb' },
  },
  /**
   * `/cotizar` era el pedido de presupuesto A LA EMPRESA: el visitante le pedía a Pintura Pro
   * que lo cotizara y se le prometía una respuesta "en menos de 24 horas". Pintura Pro es un
   * marketplace puro (decisión del dueño, 27/9/2026): no cotiza, cotizan los pintores. Y un
   * pedido que entraba por ahí no podía recibir cotizaciones de nadie — en el marketplace una
   * cotización necesita una cuenta de cliente del otro lado (`jobs.client_id`). Era el botón
   * principal del sitio y no llevaba a ninguna parte.
   *
   * Permanente (308): los enlaces viejos, los favoritos y lo que Google tenga guardado llegan
   * al flujo que sí consigue cotizaciones. `/publicar` pide cuenta y vuelve solo después de
   * ingresar.
   */
  async redirects() {
    return [{ source: "/cotizar", destination: "/publicar", permanent: true }];
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
