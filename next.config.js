/** @type {import('next').NextConfig} */
const nextConfig = {
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



    // Performance optimizations for production builds
    if (!dev) {
      // Enable tree shaking for better bundle optimization
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
        // Split chunks for better caching
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Separate vendor chunks for better caching
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            // Separate common chunks
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 5,
              reuseExistingChunk: true,
            },
            // Firebase-specific chunk (large dependency)
            firebase: {
              test: /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/,
              name: 'firebase',
              chunks: 'all',
              priority: 15,
            },
            // UI library chunks
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|@nextui-org|@mui)[\\/]/,
              name: 'ui-libs',
              chunks: 'all',
              priority: 12,
            },
            // Mapbox chunk (very large)
            mapbox: {
              test: /[\\/]node_modules[\\/](mapbox-gl|@mapbox)[\\/]/,
              name: 'mapbox',
              chunks: 'async', // Only load when needed
              priority: 20,
            },
            // Charts chunk (large)
            charts: {
              test: /[\\/]node_modules[\\/](recharts|d3)[\\/]/,
              name: 'charts',
              chunks: 'async', // Only load when needed
              priority: 18,
            },
            // Stripe chunk
            stripe: {
              test: /[\\/]node_modules[\\/](@stripe|stripe)[\\/]/,
              name: 'stripe',
              chunks: 'async', // Only load when needed
              priority: 16,
            },
          },
        },
      };

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
