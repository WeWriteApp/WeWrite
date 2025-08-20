#!/bin/bash

# Cleanup Old Files Script
# 
# This script removes old overlapping utility files after migration is complete.
# Run this ONLY after all imports have been migrated to the new consolidated utilities.

echo "🧹 WeWrite Codebase Cleanup Script"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "app" ]; then
    echo "❌ Error: This script must be run from the WeWrite project root directory"
    exit 1
fi

echo "📋 Files to be removed:"
echo ""

# API and Cache utilities (after migration to unifiedApiClient.ts and simpleCache.ts)
OLD_API_CACHE_FILES=(
    "app/utils/apiDeduplication.ts"
    "app/utils/requestDeduplication.ts"
    "app/utils/globalCache.ts"
    "app/utils/cacheUtils.ts"
    "app/utils/unifiedCache.ts"
    "app/utils/intelligentCacheWarming.ts"
    "app/utils/batchQueryOptimizer.ts"
)

# Error boundary files (after migration to UnifiedErrorBoundary.tsx)
OLD_ERROR_BOUNDARY_FILES=(
    "app/components/utils/ErrorBoundary.tsx"
    "app/components/utils/ProductionErrorBoundary.tsx"
    "app/components/editor/TextViewErrorBoundary.js"
    "app/components/admin/DashboardErrorBoundary.tsx"
)

# Modal files (after migration to UnifiedModal.tsx)
OLD_MODAL_FILES=(
    "app/components/utils/AlertModal.tsx"
    "app/components/utils/ConfirmationModal.tsx"
    "app/components/utils/PromptModal.tsx"
)

# Development utilities (after migration to unifiedDevUtils.ts)
OLD_DEV_FILES=(
    "app/utils/developmentErrorOverride.ts"
    "app/utils/error-recovery.ts"
)

# Duplicate utility files (after migration to consolidatedUtils.ts)
OLD_DUPLICATE_FILES=(
    "utils/common.ts"
    "utils/textExtraction.ts"
)

# Form validation files (after migration to UnifiedFormValidation.tsx)
OLD_FORM_FILES=(
    "app/components/forms/TitleValidationInput.tsx"
)

# List all files to be removed
echo "API & Cache utilities:"
for file in "${OLD_API_CACHE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  - $file (not found)"
    fi
done

echo ""
echo "Error boundary files:"
for file in "${OLD_ERROR_BOUNDARY_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  - $file (not found)"
    fi
done

echo ""
echo "Modal files:"
for file in "${OLD_MODAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  - $file (not found)"
    fi
done

echo ""
echo "Development utilities:"
for file in "${OLD_DEV_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  - $file (not found)"
    fi
done

echo ""
echo "Duplicate utilities:"
for file in "${OLD_DUPLICATE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  - $file (not found)"
    fi
done

echo ""
echo "Form validation files:"
for file in "${OLD_FORM_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  - $file (not found)"
    fi
done

echo ""
echo "⚠️  WARNING: This will permanently delete the above files!"
echo "⚠️  Make sure all imports have been migrated to the new consolidated utilities:"
echo "   - unifiedApiClient.ts"
echo "   - UnifiedErrorBoundary.tsx"
echo "   - UnifiedModal.tsx"
echo "   - unifiedDevUtils.ts"
echo "   - consolidatedUtils.ts"
echo "   - UnifiedFormValidation.tsx"
echo ""

# Check for remaining imports
echo "🔍 Checking for remaining imports from old files..."
echo ""

REMAINING_IMPORTS=$(grep -r "from.*apiDeduplication\|from.*requestDeduplication\|from.*globalCache\|from.*cacheUtils\|from.*unifiedCache\|from.*intelligentCacheWarming\|from.*batchQueryOptimizer\|from.*ErrorBoundary\|from.*ProductionErrorBoundary\|from.*AlertModal\|from.*ConfirmationModal\|from.*PromptModal\|from.*TitleValidationInput" app --include="*.tsx" --include="*.ts" --include="*.js" | grep -v "app/utils/" | wc -l)

if [ "$REMAINING_IMPORTS" -gt 0 ]; then
    echo "❌ Found $REMAINING_IMPORTS remaining imports from old files!"
    echo "   Please migrate these imports first before running cleanup."
    echo ""
    echo "   Run this command to see the remaining imports:"
    echo "   grep -r \"from.*apiDeduplication\\|from.*requestDeduplication\\|from.*globalCache\\|from.*cacheUtils\\|from.*unifiedCache\\|from.*intelligentCacheWarming\\|from.*batchQueryOptimizer\\|from.*ErrorBoundary\\|from.*ProductionErrorBoundary\\|from.*AlertModal\\|from.*ConfirmationModal\\|from.*PromptModal\\|from.*TitleValidationInput\" app --include=\"*.tsx\" --include=\"*.ts\" --include=\"*.js\" | grep -v \"app/utils/\""
    echo ""
    exit 1
fi

echo "✅ No remaining imports found from old files"
echo ""

# Confirm before deletion
read -p "Are you sure you want to delete these files? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 0
fi

echo ""
echo "🗑️  Removing old files..."

# Remove files
ALL_FILES=("${OLD_API_CACHE_FILES[@]}" "${OLD_ERROR_BOUNDARY_FILES[@]}" "${OLD_MODAL_FILES[@]}" "${OLD_DEV_FILES[@]}" "${OLD_DUPLICATE_FILES[@]}" "${OLD_FORM_FILES[@]}")

REMOVED_COUNT=0
for file in "${ALL_FILES[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "  ✓ Removed $file"
        ((REMOVED_COUNT++))
    fi
done

echo ""
echo "✅ Cleanup completed!"
echo "   Removed $REMOVED_COUNT files"
echo ""
echo "📋 Next steps:"
echo "   1. Run tests to ensure nothing is broken"
echo "   2. Commit the cleanup changes"
echo "   3. Monitor for any issues in development/production"
echo ""
echo "🎉 Codebase refactoring cleanup complete!"
