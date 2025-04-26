/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Configure output for better Vercel deployment
  output: 'standalone',
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Add experimental options to try to fix build issues
  experimental: {
    // Detect and optimize transpilation of node_modules based on babel configs
    optimizePackageImports: ['react-icons'],
    // Try to improve performance
    forceSwcTransforms: true,
    // Improve server components handling
    serverComponentsExternalPackages: ['firebase-admin'],
  },
  // Middleware configuration
  skipMiddlewareUrlNormalize: true,
  skipTrailingSlashRedirect: true,
  // Configure environment variables
  env: {
    NEXT_PUBLIC_FIREBASE_PID: process.env.NEXT_PUBLIC_FIREBASE_PID || 'wewrite-ccd82',
    SKIP_TYPE_CHECK: '1',
  },
  // Add security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
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
        ],
      },
    ];
  },
  // Configure webpack
  webpack: (config, { isServer }) => {
    // Fix for Firebase Admin in client-side code
    if (!isServer) {
      // Replace server-only modules with empty objects
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }

    return config;
  }
}

module.exports = nextConfig
