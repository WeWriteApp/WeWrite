/** @type {import('next').NextConfig} */
const nextConfig = {
  // Try to fix webpack runtime error with specific configuration
  trailingSlash: false,
  // Only enable StrictMode in development to prevent double rendering in production
  reactStrictMode: process.env.NODE_ENV === 'development',
  // Completely disable all Next.js development overlays and indicators
  devIndicators: {
    buildActivity: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Image optimization for SEO and performance
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  experimental: {
    optimizePackageImports: [
      'react-icons',
      'lucide-react',
      '@radix-ui/react-icons',
      '@mui/material',
      '@mui/icons-material',
      'recharts',
      'date-fns'
    ],
    // Disable automatic scroll restoration since we handle it manually
    scrollRestoration: false,
    // Temporarily disable CSS optimization to fix webpack runtime error
    // optimizeCss: true,
  },
  // Turbopack and serverExternalPackages not supported in Next.js 14
  // These features are available in Next.js 15+
  // turbopack: {
  //   rules: {
  //     '*.svg': {
  //       loaders: ['@svgr/webpack'],
  //       as: '*.js',
  //     },
  //   },
  // },
  // serverExternalPackages: [
  //   'firebase-admin',
  //   '@fastify/busboy',
  //   '@grpc/grpc-js',
  // ],
  webpack(config, { dev, isServer }) {
    // Add debugging for webpack runtime error
    if (isServer) {
      console.log('🔍 Server webpack config - investigating runtime error');
    }

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false
    }

    // Temporarily disable all webpack optimizations to fix runtime error
    // This will help us identify if the issue is with chunk splitting
    if (!dev) {
      // Minimize bundle size
      config.resolve.alias = {
        ...config.resolve.alias,
        // Fix lodash imports
        'lodash/debounce': 'lodash.debounce',
      };
    }

    return config;
  },
  // Add security and performance headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Security headers
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Performance headers for better caching
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Static assets caching
      {
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // API routes caching
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  }
}

module.exports = nextConfig
