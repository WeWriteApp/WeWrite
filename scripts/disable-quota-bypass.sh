#!/bin/bash

# Script to disable emergency quota bypass

echo "🔄 Disabling Firebase quota bypass..."

# Remove from .env.local
if [ -f .env.local ]; then
    sed -i '' '/NEXT_PUBLIC_BYPASS_FIREBASE_QUOTA/d' .env.local
fi

# Unset environment variable
unset NEXT_PUBLIC_BYPASS_FIREBASE_QUOTA

echo "✅ Quota bypass disabled!"
echo "📊 Normal database operations will resume"
echo ""
echo "⚠️  Remember to restart your development server!"
