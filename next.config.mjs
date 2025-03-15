/** @type {import('next').NextConfig} */
const {
    API_KEY,
    DOMAIN,
    DB_URL,
    PID,
    BUCKET,
    MSNGR_ID,
    APP_ID
} = process.env;
const nextConfig = {
    productionBrowserSourceMaps: true,  // Enable source maps in production
    env: {
        API_KEY,
        DOMAIN,
        DB_URL,
        PID,
        BUCKET,
        MSNGR_ID,
        APP_ID
    },
    webpack(config) {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false
        }

        return config;
    }
};

export default nextConfig;
