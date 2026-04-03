#!/bin/bash

# WeWrite Color System Audit Script
# Systematically finds and reports all hardcoded color instances that need migration

echo "🎨 WeWrite Color System Audit"
echo "============================="
echo ""

# Colors to search for - more comprehensive patterns
GRAY_PATTERNS="text-gray-[0-9]|bg-gray-[0-9]|border-gray-[0-9]"
SLATE_PATTERNS="text-slate-[0-9]|bg-slate-[0-9]|border-slate-[0-9]"
ZINC_PATTERNS="text-zinc-[0-9]|bg-zinc-[0-9]|border-zinc-[0-9]"
NEUTRAL_PATTERNS="text-neutral-[0-9]|bg-neutral-[0-9]|border-neutral-[0-9]"
STONE_PATTERNS="text-stone-[0-9]|bg-stone-[0-9]|border-stone-[0-9]"
WHITE_BLACK_PATTERNS="bg-white[^-]|bg-black[^-]|text-white[^-]|text-black[^-]"

# Additional comprehensive patterns
HARDCODED_HEX_PATTERNS="#[0-9a-fA-F]{3,6}"
HARDCODED_RGB_PATTERNS="rgb\(|rgba\("
HARDCODED_HSL_PATTERNS="hsl\(|hsla\("
DARK_MODE_PATTERNS="dark:bg-gray|dark:text-gray|dark:border-gray"

# Function to count and display results
audit_pattern() {
    local pattern="$1"
    local description="$2"
    local count=$(find app -name "*.tsx" -o -name "*.ts" | xargs grep -n "$pattern" | grep -v node_modules | wc -l)
    
    echo "📊 $description: $count instances"
    
    if [ $count -gt 0 ]; then
        echo "   Files with issues:"
        find app -name "*.tsx" -o -name "*.ts" | xargs grep -l "$pattern" | grep -v node_modules | head -10 | sed 's/^/   - /'
        if [ $count -gt 10 ]; then
            echo "   ... and $((count - 10)) more"
        fi
        echo ""
    fi
}

# Run audits
echo "🔍 Scanning for hardcoded colors..."
echo ""

audit_pattern "$GRAY_PATTERNS" "Gray colors (text-gray-*, bg-gray-*, border-gray-*)"
audit_pattern "$SLATE_PATTERNS" "Slate colors (text-slate-*, bg-slate-*, border-slate-*)"
audit_pattern "$ZINC_PATTERNS" "Zinc colors (text-zinc-*, bg-zinc-*, border-zinc-*)"
audit_pattern "$NEUTRAL_PATTERNS" "Neutral colors (text-neutral-*, bg-neutral-*, border-neutral-*)"
audit_pattern "$STONE_PATTERNS" "Stone colors (text-stone-*, bg-stone-*, border-stone-*)"

echo "🔍 Scanning for hardcoded white/black..."
echo ""
audit_pattern "$WHITE_BLACK_PATTERNS" "White/Black colors (bg-white, bg-black, text-white, text-black)"

echo "🔍 Scanning for other hardcoded colors..."
echo ""
audit_pattern "$HARDCODED_HEX_PATTERNS" "Hardcoded hex colors (#fff, #000, etc.)"
audit_pattern "$HARDCODED_RGB_PATTERNS" "Hardcoded RGB colors (rgb(), rgba())"
audit_pattern "$HARDCODED_HSL_PATTERNS" "Hardcoded HSL colors (hsl(), hsla())"
audit_pattern "$DARK_MODE_PATTERNS" "Dark mode gray patterns (dark:bg-gray-*, etc.)"

# Total count
total_gray=$(find app -name "*.tsx" -o -name "*.ts" | xargs grep -n "$GRAY_PATTERNS" | grep -v node_modules | wc -l)
total_slate=$(find app -name "*.tsx" -o -name "*.ts" | xargs grep -n "$SLATE_PATTERNS" | grep -v node_modules | wc -l)
total_zinc=$(find app -name "*.tsx" -o -name "*.ts" | xargs grep -n "$ZINC_PATTERNS" | grep -v node_modules | wc -l)
total_neutral=$(find app -name "*.tsx" -o -name "*.ts" | xargs grep -n "$NEUTRAL_PATTERNS" | grep -v node_modules | wc -l)
total_stone=$(find app -name "*.tsx" -o -name "*.ts" | xargs grep -n "$STONE_PATTERNS" | grep -v node_modules | wc -l)
total_wb=$(find app -name "*.tsx" -o -name "*.ts" | xargs grep -n "$WHITE_BLACK_PATTERNS" | grep -v node_modules | wc -l)

total=$((total_gray + total_slate + total_zinc + total_neutral + total_stone + total_wb))

echo "📈 SUMMARY"
echo "=========="
echo "Total hardcoded color instances: $total"
echo ""

# Priority recommendations
echo "🎯 PRIORITY FIXES NEEDED"
echo "========================"
echo ""

if [ $total_gray -gt 0 ]; then
    echo "🔴 HIGH PRIORITY: $total_gray gray color instances"
    echo "   Replace with: text-muted-foreground, bg-muted, border-border"
    echo ""
fi

if [ $total_wb -gt 0 ]; then
    echo "🟡 MEDIUM PRIORITY: $total_wb white/black instances"
    echo "   Review each - some may be appropriate (button text, overlays)"
    echo "   Replace inappropriate ones with: bg-background, text-foreground"
    echo ""
fi

if [ $((total_slate + total_zinc + total_neutral + total_stone)) -gt 0 ]; then
    echo "🟢 LOW PRIORITY: $((total_slate + total_zinc + total_neutral + total_stone)) other neutral color instances"
    echo "   Replace with unified neutral system when convenient"
    echo ""
fi

# Generate fix commands
echo "🛠️  AUTOMATED FIX SUGGESTIONS"
echo "============================="
echo ""
echo "# Most common replacements:"
echo "find app -name '*.tsx' -o -name '*.ts' | xargs sed -i '' 's/text-gray-500/text-muted-foreground/g'"
echo "find app -name '*.tsx' -o -name '*.ts' | xargs sed -i '' 's/text-gray-600/text-muted-foreground/g'"
echo "find app -name '*.tsx' -o -name '*.ts' | xargs sed -i '' 's/bg-gray-100/bg-muted/g'"
echo "find app -name '*.tsx' -o -name '*.ts' | xargs sed -i '' 's/bg-gray-200/bg-muted/g'"
echo "find app -name '*.tsx' -o -name '*.ts' | xargs sed -i '' 's/border-gray-200/border-border/g'"
echo "find app -name '*.tsx' -o -name '*.ts' | xargs sed -i '' 's/border-gray-300/border-border/g'"
echo ""
echo "⚠️  CAUTION: Review each change manually - some hardcoded colors may be intentional!"

echo ""
echo "✅ Audit complete!"
