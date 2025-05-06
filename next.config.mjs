/** @type {import('next').NextConfig} */
const {
    API_KEY,
    DOMAIN,
    DB_URL,
    PID,
    BUCKET,
    MSNGR_ID,
    APP_ID,
    MAPBOX_TOKEN
} = process.env;
const nextConfig = {
    env: {
        API_KEY,
        DOMAIN,
        DB_URL,
        PID,
        BUCKET,
        MSNGR_ID,
        APP_ID,
        NEXT_PUBLIC_MAPBOX_TOKEN: MAPBOX_TOKEN
    },
    output: 'standalone',
    poweredByHeader: false,
    reactStrictMode: true,
    swcMinify: true,
    webpack(config) {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false
        }

        return config;
    }
};

export default nextConfig;
