/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  // Next.js 14 doesn't support the api config directly in next.config.js anymore
  // We'll handle API routes differently
  // Add experimental options to try to fix build issues
  experimental: {
    // Detect and optimize transpilation of node_modules based on babel configs
    optimizePackageImports: ['react-icons'],
    // Try to improve performance
    forceSwcTransforms: true,
    // Server components - packages that should only be loaded on the server
    serverComponentsExternalPackages: [
      'firebase-admin',
      '@fastify/busboy',
      '@grpc/grpc-js',
    ],
  },
  // Handle Node.js modules in Firebase Admin
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'fs', 'net', etc. on the client to prevent this error
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        http2: false,
        http: false,
        https: false,
        zlib: false,
        child_process: false,
        perf_hooks: false,
        util: require.resolve('util/'),
        stream: require.resolve('stream-browserify'),
        crypto: require.resolve('crypto-browserify'),
        url: false,
        os: require.resolve('os-browserify/browser'),
        path: require.resolve('path-browserify'),
        events: require.resolve('events/'),
        dns: false,
      };
    }

    return config;
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
  }
}

module.exports = nextConfig
