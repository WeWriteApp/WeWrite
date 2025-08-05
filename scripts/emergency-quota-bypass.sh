#!/bin/bash

# 🚨 EMERGENCY QUOTA BYPASS SCRIPT
# Use this to immediately stop database read spike

echo "🚨 EMERGENCY: Activating Firebase quota bypass..."

# Set environment variable for immediate bypass
export NEXT_PUBLIC_BYPASS_FIREBASE_QUOTA=true

# Add to .env.local for persistence
if [ -f .env.local ]; then
    # Remove existing line if present
    sed -i '' '/NEXT_PUBLIC_BYPASS_FIREBASE_QUOTA/d' .env.local
fi

echo "NEXT_PUBLIC_BYPASS_FIREBASE_QUOTA=true" >> .env.local

echo "✅ Quota bypass activated!"
echo "📊 This will:"
echo "   - Return mock data for high-volume endpoints"
echo "   - Prevent further database reads"
echo "   - Stop cost overrun immediately"
echo ""
echo "🔄 To disable bypass later, run:"
echo "   scripts/disable-quota-bypass.sh"
echo ""
echo "⚠️  Remember to restart your development server!"
