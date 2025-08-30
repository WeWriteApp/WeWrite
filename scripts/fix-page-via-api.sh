#!/bin/bash

# Fix specific page via API endpoint
# Usage: ./scripts/fix-page-via-api.sh

echo "🔧 Fixing malformed page content via API..."

# First, let's do a dry run to see what issues exist
echo "📋 Running dry run to identify issues..."
curl -X POST "https://www.getwewrite.app/api/admin/fix-page-data" \
  -H "Content-Type: application/json" \
  -H "X-Force-Production-Data: true" \
  -d '{"dryRun": true, "limit": 100}' \
  --cookie-jar cookies.txt \
  --cookie cookies.txt \
  -s | jq '.'

echo ""
echo "🔧 Now running the actual fix..."

# Now run the actual fix
curl -X POST "https://www.getwewrite.app/api/admin/fix-page-data" \
  -H "Content-Type: application/json" \
  -H "X-Force-Production-Data: true" \
  -d '{"dryRun": false, "limit": 100}' \
  --cookie-jar cookies.txt \
  --cookie cookies.txt \
  -s | jq '.'

echo ""
echo "✅ Fix completed!"
