#!/bin/bash

# API Key Rotation Script
# Run this script after rotating keys in Google Cloud and Stripe dashboards

echo "🔐 API Key Rotation Helper"
echo "=========================="
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found!"
    echo "Please create .env.local from .env.example first"
    exit 1
fi

echo "📋 MANUAL STEPS REQUIRED:"
echo ""
echo "1. 🔑 GOOGLE CLOUD CONSOLE:"
echo "   → Go to: https://console.cloud.google.com/apis/credentials"
echo "   → Delete old API keys"
echo "   → Create new API keys"
echo "   → Copy the new API key"
echo ""

echo "2. 💳 STRIPE DASHBOARD:"
echo "   → Go to: https://dashboard.stripe.com/apikeys"
echo "   → Roll/regenerate test keys"
echo "   → Copy new secret key"
echo "   → Copy new publishable key"
echo ""

echo "3. 🔄 UPDATE ENVIRONMENT VARIABLES:"
echo ""

# Function to update env var
update_env_var() {
    local var_name=$1
    local var_description=$2
    
    echo "Enter new $var_description:"
    read -r new_value
    
    if [ -n "$new_value" ]; then
        # Use sed to update the variable in .env.local
        if grep -q "^$var_name=" .env.local; then
            # Variable exists, update it
            sed -i.bak "s|^$var_name=.*|$var_name=$new_value|" .env.local
            echo "✅ Updated $var_name"
        else
            # Variable doesn't exist, add it
            echo "$var_name=$new_value" >> .env.local
            echo "✅ Added $var_name"
        fi
    else
        echo "⚠️  Skipped $var_name (empty value)"
    fi
    echo ""
}

# Backup current .env.local
cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)
echo "📁 Backed up current .env.local"
echo ""

# Update Google API Key
echo "🔑 GOOGLE API KEY:"
update_env_var "NEXT_PUBLIC_FIREBASE_API_KEY" "Google Firebase API Key"

# Update Stripe Keys
echo "💳 STRIPE PUBLISHABLE KEY:"
update_env_var "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "Stripe Publishable Key (pk_test_...)"

echo "💳 STRIPE SECRET KEY:"
update_env_var "STRIPE_SECRET_KEY" "Stripe Secret Key (sk_test_...)"

echo "🔗 STRIPE WEBHOOK SECRET (if changed):"
update_env_var "STRIPE_WEBHOOK_SECRET" "Stripe Webhook Secret (whsec_...)"

echo ""
echo "🧪 TESTING CONFIGURATION:"
echo "========================="
echo ""

# Test if the app can start
echo "Testing if the application can start..."
if command -v pnpm &> /dev/null; then
    echo "Running: pnpm run build"
    if pnpm run build > /dev/null 2>&1; then
        echo "✅ Build successful - configuration looks good!"
    else
        echo "❌ Build failed - please check your configuration"
        echo "Run 'pnpm run build' to see detailed errors"
    fi
else
    echo "⚠️  pnpm not found, skipping build test"
fi

echo ""
echo "🚀 NEXT STEPS:"
echo "=============="
echo ""
echo "1. 🧪 Test your application locally:"
echo "   pnpm run dev"
echo ""
echo "2. 🌐 Update Vercel environment variables:"
echo "   → Go to: https://vercel.com/your-project/settings/environment-variables"
echo "   → Update the same variables you just changed"
echo ""
echo "3. 📊 Monitor for 24-48 hours:"
echo "   → Google Cloud Console billing/usage"
echo "   → Stripe Dashboard for unusual activity"
echo ""
echo "4. 🗑️  Clean up old backups when confident:"
echo "   rm .env.local.backup.*"
echo ""

echo "✅ Key rotation helper completed!"
echo ""
echo "📋 SECURITY CHECKLIST:"
echo "- [ ] Keys rotated in Google Cloud Console"
echo "- [ ] Keys rotated in Stripe Dashboard"
echo "- [ ] .env.local updated with new keys"
echo "- [ ] Application tested locally"
echo "- [ ] Vercel environment variables updated"
echo "- [ ] Monitoring set up for unusual activity"
echo ""
echo "🔒 Your API keys have been updated. Monitor for any issues!"
