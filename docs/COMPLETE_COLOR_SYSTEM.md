# WeWrite Complete Color System Architecture

## 🎨 **Overview**

WeWrite uses a comprehensive 5-color OKLCH-based system with systematic naming (`accent-n`, `neutral-n`, `success-n`, `warn-n`, `error-n`) that provides complete design flexibility while maintaining semantic meaning and accessibility.

## 🏗️ **System Architecture**

### **Core Color Types**

#### 1. **`accent-n`** - User's Custom Accent Color
```css
/* Full chroma, user-customizable hue */
--accent-base: 55.93% 0.6617 284.9; /* User's chosen accent */

/* Usage Examples */
bg-accent      /* Full opacity accent */
bg-accent-10   /* 10% opacity accent */
bg-accent-40   /* 40% opacity accent */
text-accent    /* Accent text color */
```

**Purpose**: Interactive elements, primary buttons, links, highlights, current allocation bars

#### 2. **`neutral-n`** - Chroma-Varied Accent
```css
/* Same hue as accent, controlled chroma (30% of accent chroma, max 0.05) */
--neutral-base: 55.93% 0.0500 284.9; /* Inherits accent hue */

/* Usage Examples */
bg-neutral-20  /* 20% opacity neutral - PERFECT for OTHER allocation sections */
bg-neutral-40  /* 40% opacity neutral */
border-neutral-20 /* 20% opacity borders */
border-neutral-15 /* 15% opacity borders */
```

**Purpose**: Text, borders, subtle UI elements, **OTHER allocation sections**, button borders

#### 3. **`success-n`** - Green Semantic Color
```css
--success-base: 0.55 0.15 142; /* Green in OKLCH */

/* Usage Examples */
bg-success-10  /* 10% opacity success background */
text-success   /* Success text */
border-success-30 /* Success borders */
```

**Purpose**: Success states, positive feedback, earnings display

#### 4. **`warn-n`** - Orange Semantic Color
```css
--warn-base: 0.72 0.15 72; /* Orange in OKLCH */

/* Usage Examples */
bg-warn        /* Full warning background */
bg-warn-20     /* 20% opacity warning */
text-warn      /* Warning text */
```

**Purpose**: Warning states, **overspent allocation sections**, caution indicators

#### 5. **`error-n`** - Red Semantic Color
```css
--error-base: 0.55 0.15 28; /* Red in OKLCH */

/* Usage Examples */
bg-error-10    /* 10% opacity error background */
text-error     /* Error text */
border-error-30 /* Error borders */
```

**Purpose**: Error states, destructive actions, critical alerts

## 🎯 **Opacity Scale**

All color types support the same opacity scale:

```css
/* Available opacity levels */
-10  /* 10% opacity */
-20  /* 20% opacity */
-30  /* 30% opacity */
-40  /* 40% opacity */
-50  /* 50% opacity */
-60  /* 60% opacity */
-70  /* 70% opacity */
-80  /* 80% opacity */
-90  /* 90% opacity */
```

## 🔧 **Implementation Details**

### **CSS Variables Structure**
```css
:root {
  /* Systematic Color System - Base Colors (OKLCH) */
  --accent-base: var(--primary); /* User's custom accent color */
  --neutral-base: var(--primary); /* Same hue as accent, low chroma */
  --success-base: 0.55 0.15 142; /* Green */
  --warn-base: 0.72 0.15 72; /* Orange */
  --error-base: 0.55 0.15 28; /* Red */

  /* Full opacity colors (aliases for compatibility) */
  --accent: var(--accent-base);
  --neutral: var(--neutral-base);
  --success: var(--success-base);
  --warning: var(--warn-base); /* Legacy alias */
  --error: var(--error-base);
}
```

### **Tailwind Configuration**
```typescript
// tailwind.config.ts
colors: {
  accent: {
    DEFAULT: "oklch(var(--accent-base))",
    10: "oklch(var(--accent-base) / 0.10)",
    20: "oklch(var(--accent-base) / 0.20)",
    // ... up to 90
  },
  neutral: {
    DEFAULT: "oklch(var(--neutral-base))",
    10: "oklch(var(--neutral-base) / 0.10)",
    40: "oklch(var(--neutral-base) / 0.40)", // Perfect for OTHER sections
    // ... up to 90
  },
  // Similar structure for success, warning, error
}
```

## 📋 **Usage Guidelines**

### **Allocation Bar System**
```tsx
// ALWAYS use shared constants to prevent inconsistencies
import { ALLOCATION_BAR_STYLES } from '../constants/allocation-styles';

{/* OTHER section - neutral-20 for subtle visibility */}
<div className={ALLOCATION_BAR_STYLES.sections.other} />
// Renders as: bg-neutral-20 rounded-md transition-all duration-300 ease-out

{/* CURRENT section - accent color */}
<div className={ALLOCATION_BAR_STYLES.sections.current} />

{/* OVERSPENT section - warn color */}
<div className={ALLOCATION_BAR_STYLES.sections.overspent} />

{/* Button borders - neutral-20 */}
<Button className={ALLOCATION_BAR_STYLES.buttons.minus}>
  <Minus className="h-4 w-4" />
</Button>

{/* Separator lines */}
<div className={ALLOCATION_BAR_STYLES.separators.withPadding}>
  Content here
</div>
```

### **Pill Link System**
```tsx
// Pill links use systematic accent color naming for consistency

{/* Filled pill links - accent-100 background, dynamic text color */}
<PillLink style="filled">
  // Background: bg-accent-100
  // Text: text-white (if accent lightness < 80%) or text-black (if ≥ 80%)
</PillLink>

{/* Outlined pill links - accent-100 text, accent-70 border */}
<PillLink style="outline">
  // Text: text-accent-100
  // Border: border-accent-70
</PillLink>

{/* Text-only pill links - accent-100 text */}
<PillLink style="text-only">
  // Text: text-accent-100
</PillLink>

{/* Underlined pill links - accent-100 text */}
<PillLink style="underlined">
  // Text: text-accent-100
</PillLink>
```

### **Semantic Usage**
```tsx
{/* Success states */}
<div className="bg-success-10 text-success border-success-30">
  Earnings: $12.34
</div>

{/* Warning states */}
<div className="bg-warn-10 text-warn">
  Account needs funding
</div>

{/* Error states */}
<div className="bg-error-10 text-error">
  Payment failed
</div>
```

## ✅ **Key Benefits**

1. **Works over any background** - Opacity-based colors adapt to any site background
2. **Semantic clarity** - Clear meaning for each color type
3. **Theme consistency** - Neutral colors inherit accent hue for cohesive design
4. **Accessibility** - Proper contrast ratios maintained automatically
5. **Scalability** - Easy to add more opacity levels or color types
6. **Performance** - Single base color with CSS opacity, no complex calculations

## 🔄 **Migration from Legacy System**

### **Old → New Mappings**
```css
/* Old hardcoded colors */
bg-slate-400     → bg-neutral-40
bg-neutral-40    → bg-neutral-20 (for OTHER allocation sections)
text-orange-500  → text-warn
bg-red-100       → bg-error-10
border-gray-200  → border-neutral-20

/* Old semantic colors */
bg-destructive   → bg-error (alias maintained for compatibility)
text-destructive → text-error
bg-warning       → bg-warn (systematic naming)
text-warning     → text-warn (systematic naming)
```

## 🎨 **Color Relationships**

```
ACCENT (User Custom)
├── Full chroma, user-chosen hue
├── Used for: buttons, links, highlights
└── Example: bg-accent, bg-accent-20

NEUTRAL (Chroma-Varied Accent)  
├── Same hue as accent, low chroma (0-0.15)
├── Used for: text, borders, subtle elements
└── Example: bg-neutral-40, border-neutral-20

SUCCESS (Green Semantic)
├── Fixed green hue, high chroma
├── Used for: success states, earnings
└── Example: text-success, bg-success-10

WARNING (Orange Semantic)
├── Fixed orange hue, high chroma  
├── Used for: warnings, overspent funds
└── Example: bg-warning, text-warning

ERROR (Red Semantic)
├── Fixed red hue, high chroma
├── Used for: errors, destructive actions
└── Example: text-error, bg-error-10
```

This system provides complete design flexibility while maintaining semantic meaning and ensuring all colors work harmoniously together over any background.
