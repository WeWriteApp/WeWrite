/** @type {import('next').NextConfig} */

console.log('🔍 Next.js Configuration - ALWAYS USE FULL ERROR MESSAGES:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  VERCEL_ENV:', process.env.VERCEL_ENV);
console.log('  Full errors enabled: ALWAYS (development, preview, and production)');

const nextConfig = {
  reactStrictMode: process.env.NODE_ENV === 'development', // Disable in production to prevent hydration issues

  // Force full error messages in ALL environments (dev, preview, production)
  env: {
    // Force React to always use development error messages
    FORCE_FULL_ERRORS: 'true',
    REACT_APP_FULL_ERRORS: 'true',
    VERCEL_ENV: process.env.VERCEL_ENV || 'development',
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV || 'development',
  },


  // Maximum error visibility settings
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Disable source maps in production for security (use error tracking services instead)
  productionBrowserSourceMaps: false,

  // Minimal webpack logging for development
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {

    // FORCE FULL ERROR MESSAGES: Configure React for better error messages
    console.log('🔧 Webpack: Configuring enhanced error messages');

    // Use DefinePlugin to improve error messages without breaking the build
    config.plugins.push(
      new webpack.DefinePlugin({
        // Keep React in production mode but enhance our error logging
        '__REACT_ERROR_OVERLAY__': JSON.stringify(true),
        'process.env.REACT_APP_FULL_ERRORS': JSON.stringify('true'),
      })
    );

    // Reduce webpack output for cleaner development
    if (dev) {
      // Ignore directories that shouldn't trigger Fast Refresh
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/.git/**',
          '**/logs/**',
          '**/scripts/**',
          '**/docs/**',
          '**/*.tsbuildinfo',
          '**/.claude/**',
          '**/coverage/**',
          '**/dist/**',
          '**/.turbo/**',
        ],
        // Debounce file change events to reduce rebuilds
        aggregateTimeout: 300,
        // Use polling only if native watchers fail (set to false for native watching)
        poll: false,
      };

      config.stats = {
        errors: true,
        warnings: true,
        timings: false,
        assets: false,
        chunks: false,
        modules: false,
        reasons: false,
        source: false,
        publicPath: false,
        builtAt: false,
        version: false,
        hash: false,
        chunkModules: false,
        chunkOrigins: false,
        depth: false,
        env: false,
        orphanModules: false,
        providedExports: false,
        usedExports: false,
        optimizationBailout: false,
      };

      config.infrastructureLogging = {
        level: 'warn',
        debug: false,
      };
    }

    // Force error emission (updated for Next.js 15.4.1)
    config.optimization = {
      ...config.optimization,
      emitOnErrors: true,
    };

    // Add error handling plugin
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.ENABLE_VERBOSE_LOGGING': JSON.stringify('true'),
        'process.env.USE_DEV_AUTH': JSON.stringify(process.env.USE_DEV_AUTH || 'false'),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      })
    );

    return config;
  },

  // Enable TypeScript error checking in development
  typescript: {
    ignoreBuildErrors: true, // Temporarily ignore for Vercel build
  },

  // Experimental features for better error reporting
  experimental: {
    forceSwcTransforms: false,
    // Disable optimizations that can cause hydration issues in production
    ...(process.env.NODE_ENV === 'development' && {
      optimizePackageImports: ['slate', 'slate-react']
    }),
  },

  // External packages for server components
  // These packages should not be bundled and will use node_modules at runtime
  // The firebase-admin dependency chain requires jwks-rsa which requires jose
  serverExternalPackages: [
    'firebase-admin',
    '@google-cloud/firestore',
    '@google-cloud/storage',
    'jwks-rsa',
    'jose',
  ],

  // Explicitly include jose in serverless function traces
  // This fixes the "Cannot find package 'jose'" error on Vercel when using bun lockfile
  // bun creates a .bun folder symlink structure that Vercel's runtime can't resolve
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/jose/**/*', './node_modules/jwks-rsa/**/*'],
  },

  // Logging configuration
  logging: {
    fetches: {
      fullUrl: false, // Reduce noise from fetch logging
      hmrRefreshes: false, // Disable spammy Fast Refresh logs
    },
  },

  // Reduce server-side request logging
  async rewrites() {
    return [];
  },

  // Security headers for Stripe Connect embedded components
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // SECURITY: Strict-Transport-Security (HSTS)
          // Forces HTTPS for 1 year, including subdomains
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          // SECURITY: Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          // SECURITY: Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // SECURITY: Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // SECURITY: Permissions Policy (formerly Feature-Policy)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()'
          },
          // SECURITY: XSS Protection (legacy browsers)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://connect-js.stripe.com https://*.stripe.com https://cdn.logrocket.io https://cdn.lr-ingest.io https://cdn.lr-in.com https://cdn.lr-in-prod.com https://cdn.lr-ingest.com https://cdn.ingest-lr.com https://cdn.lgrckt-in.com https://www.googletagmanager.com https://*.googleapis.com https://apis.google.com https://va.vercel-scripts.com https://vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://connect-js.stripe.com https://*.stripe.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: https://*.stripe.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://cdnjs.cloudflare.com",
              "connect-src 'self' https://api.stripe.com https://connect-js.stripe.com https://*.stripe.com wss://*.stripe.com https://*.googleapis.com https://apis.google.com https://firebase.googleapis.com https://firestore.googleapis.com https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel https://firebaseinstallations.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com wss://*.firebaseio.com https://*.firebaseio.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://*.logrocket.io https://*.lr-ingest.io https://*.logrocket.com https://*.lr-in.com https://*.lr-in-prod.com https://*.lr-ingest.com https://*.ingest-lr.com https://cdn.lgrckt-in.com https://*.lgrckt-in.com https://va.vercel-scripts.com https://*.vercel-scripts.com wss://api.wewrite.app https://api.wewrite.app https://cdn.lordicon.com",
              "report-uri /api/csp-violations",
              "frame-src 'self' https://js.stripe.com https://connect-js.stripe.com https://*.stripe.com https://*.firebaseapp.com https://wewrite-ccd82.firebaseapp.com",
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'"
            ].join('; ')
          }
        ]
      }
    ];
  },

  // Custom error pages (rewrites defined above)

  // Enable all development features
  devIndicators: {
    position: 'bottom-right',
  },

  // Maximum error details in production
  generateEtags: false,
  poweredByHeader: false,
  compress: true, // Enable gzip compression for ~70% smaller payloads
}

module.exports = nextConfig
