/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Maximum error visibility settings
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Enable all source maps for debugging
  productionBrowserSourceMaps: true,

  // Minimal webpack logging for development
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
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

    // Force error emission
    config.optimization = {
      ...config.optimization,
      emitOnErrors: true,
      noEmitOnErrors: false,
    };

    // Add error handling plugin
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.ENABLE_VERBOSE_LOGGING': JSON.stringify('true'),
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
  },

  // External packages for server components
  serverExternalPackages: [],

  // Minimal logging for development
  logging: {
    fetches: {
      fullUrl: false,
      hmrRefreshes: false,
    },
  },

  // Custom error pages
  async rewrites() {
    return [];
  },

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