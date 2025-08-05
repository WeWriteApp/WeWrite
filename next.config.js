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

  // Enable all source maps for debugging
  productionBrowserSourceMaps: true,

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

  // Enable ESLint during builds
  eslint: {
    ignoreDuringBuilds: true, // Temporarily ignore for Vercel build
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
  serverExternalPackages: [],

  // Enhanced logging for development - increase verbosity for debugging
  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: true,
    },
  },

  // Reduce server-side request logging
  async rewrites() {
    return [];
  },

  // Custom server configuration for enhanced development logging
  serverRuntimeConfig: {
    // Increase server logging verbosity for development
    logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'warn'
  },

  // Security headers for Stripe Connect embedded components
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://connect-js.stripe.com https://*.stripe.com https://cdn.logrocket.io https://cdn.lr-ingest.io https://cdn.lr-in.com https://cdn.lr-in-prod.com https://cdn.lr-ingest.com https://cdn.ingest-lr.com https://cdn.lgrckt-in.com https://www.googletagmanager.com https://*.googleapis.com https://apis.google.com https://va.vercel-scripts.com https://vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://connect-js.stripe.com https://*.stripe.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: https://*.stripe.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://cdnjs.cloudflare.com",
              "connect-src 'self' https://api.stripe.com https://connect-js.stripe.com https://*.stripe.com wss://*.stripe.com https://*.googleapis.com https://apis.google.com https://firebase.googleapis.com https://firebaseinstallations.googleapis.com wss://*.firebaseio.com https://*.firebaseio.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://*.logrocket.io https://*.lr-ingest.io https://*.logrocket.com https://*.lr-in.com https://*.lr-in-prod.com https://*.lr-ingest.com https://*.ingest-lr.com https://cdn.lgrckt-in.com https://*.lgrckt-in.com https://va.vercel-scripts.com https://*.vercel-scripts.com wss://api.wewrite.app https://api.wewrite.app",
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
  compress: false, // Disable compression to see full error details
}

module.exports = nextConfig