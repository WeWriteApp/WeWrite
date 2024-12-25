/** @type {import('next').NextConfig} */
const {
    API_KEY,
    DOMAIN,
    DB_URL,
    PID,
    BUCKET,
    MSNGR_ID,
    APP_ID,
    GOOGLE_CLOUD_KEY_JSON,
    LOGGING_CLOUD_KEY_JSON,
    PROJECT_ID,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    STRIPE_PRODUCT_ID,
    STRIPE_PRICE_ID,
    SUBSCRIPTION_BASE_AMOUNT
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
        GOOGLE_CLOUD_KEY_JSON,
        LOGGING_CLOUD_KEY_JSON,
        PROJECT_ID,
        STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET,
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        STRIPE_PRODUCT_ID,
        STRIPE_PRICE_ID,
        SUBSCRIPTION_BASE_AMOUNT
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
