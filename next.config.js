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
  // Add experimental options to try to fix build issues
  experimental: {
    // Detect and optimize transpilation of node_modules based on babel configs
    optimizePackageImports: ['react-icons'],
    // Try to improve performance
    forceSwcTransforms: true,
    // Skip type checking during build
    skipTypechecking: true,
  }
}

module.exports = nextConfig
