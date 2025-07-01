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

  // Maximum webpack error reporting
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Enable maximum webpack output
    if (dev) {
      config.stats = {
        all: true,
        modules: true,
        errors: true,
        errorDetails: true,
        errorStack: true,
        warnings: true,
        publicPath: true,
        reasons: true,
        source: true,
        timings: true,
        version: true,
        builtAt: true,
        assets: true,
        chunks: true,
        chunkModules: true,
        chunkOrigins: true,
        depth: true,
        env: true,
        orphanModules: true,
        providedExports: true,
        usedExports: true,
        optimizationBailout: true,
      };
      
      config.infrastructureLogging = {
        level: 'verbose',
        debug: true,
      };
    }

    // Force error emission (updated for webpack 5)
    config.optimization = {
      ...config.optimization,
      emitOnErrors: true,
    };

    // Add error handling plugin
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.ENABLE_VERBOSE_LOGGING': JSON.stringify('true'),
      })
    );

    return config;
  },

  // Enable TypeScript and ESLint error reporting for terminal visibility
  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  // Experimental features for better error reporting
  experimental: {
    forceSwcTransforms: false,
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