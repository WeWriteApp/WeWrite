#!/bin/bash

# Enable Production Monitoring Mode
# This script enables monitoring of production collections even in development environment

echo "🔍 Enabling Production Monitoring Mode..."

# Set environment variable for current session
export ENABLE_PRODUCTION_MONITORING=true

echo "✅ Production monitoring enabled!"
echo ""
echo "📊 This will now track production collection costs even in development:"
echo "   - DEV_pages → pages"
echo "   - DEV_users → users" 
echo "   - DEV_subscriptions → subscriptions"
echo ""
echo "🚀 Start your dev server with: npm run dev"
echo "📈 Check monitoring at: http://localhost:3000/api/monitoring/database-reads"
echo ""
echo "To disable, run: unset ENABLE_PRODUCTION_MONITORING"
