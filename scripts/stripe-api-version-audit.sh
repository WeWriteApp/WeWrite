#!/bin/bash

# Stripe API Version Audit Script
# This script finds all Stripe API version declarations in the codebase
# and categorizes them by version number

echo "========================================="
echo "Stripe API Version Audit"
echo "========================================="
echo ""
echo "Recommended Standard: 2024-12-18.acacia"
echo ""

echo "Files using 2024-12-18.acacia (RECOMMENDED):"
echo "---------------------------------------------"
grep -r "apiVersion.*2024-12-18.acacia" app/ scripts/ --include="*.ts" --include="*.tsx" --include="*.js" | cut -d: -f1 | sort | uniq
echo ""

echo "Files using 2024-06-20 (OLD - SHOULD UPDATE):"
echo "---------------------------------------------"
grep -r "apiVersion.*2024-06-20" app/ scripts/ --include="*.ts" --include="*.tsx" --include="*.js" | cut -d: -f1 | sort | uniq
echo ""

echo "Files using 2023-10-16 (VERY OLD - SHOULD UPDATE):"
echo "---------------------------------------------"
grep -r "apiVersion.*2023-10-16" app/ scripts/ --include="*.ts" --include="*.tsx" --include="*.js" | cut -d: -f1 | sort | uniq
echo ""

echo "Files using future/beta versions (2025-XX-XX):"
echo "---------------------------------------------"
grep -r "apiVersion.*2025-" app/ scripts/ --include="*.ts" --include="*.tsx" --include="*.js" | cut -d: -f1 | sort | uniq
echo ""

echo "Files with 'new Stripe(' but NO explicit apiVersion:"
echo "---------------------------------------------"
grep -r "new Stripe(" app/ scripts/ --include="*.ts" --include="*.tsx" --include="*.js" | grep -v "apiVersion" | cut -d: -f1 | sort | uniq
echo ""

echo "========================================="
echo "Summary"
echo "========================================="
echo "Total files with apiVersion:"
grep -r "apiVersion" app/ scripts/ --include="*.ts" --include="*.tsx" --include="*.js" | cut -d: -f1 | sort | uniq | wc -l
echo ""
echo "Files needing update to 2024-12-18.acacia:"
grep -r "apiVersion" app/ scripts/ --include="*.ts" --include="*.tsx" --include="*.js" | grep -v "2024-12-18.acacia" | cut -d: -f1 | sort | uniq | wc -l
echo ""
