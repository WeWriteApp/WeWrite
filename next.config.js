/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only enable StrictMode in development to prevent double rendering in production
  reactStrictMode: process.env.NODE_ENV === 'development',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['react-icons'],
  },
  serverExternalPackages: [
    'firebase-admin',
    '@fastify/busboy',
    '@grpc/grpc-js',
  ],
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
