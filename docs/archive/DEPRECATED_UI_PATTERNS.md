# Deprecated UI Patterns - Cleanup Guide

## 🚨 CRITICAL: Patterns That Must Be Removed

This document identifies outdated UI patterns that must be systematically removed during cleanup runs. These patterns cause inconsistency, maintenance burden, and user experience issues.

## 🆕 **Content Display Patterns (NEW 2025 - CRITICAL)**

### ❌ Old Editor Component (DELETE THESE)

#### Redundant Editor Wrapper
```typescript
// ❌ DELETE: Redundant Editor.tsx wrapper component
import Editor from "../components/editor/Editor";
import { Editor } from "../components/editor/Editor";

// Complex conditional rendering
{shouldUseEditor ? (
  <Editor
    readOnly={!canEdit}
    initialContent={content}
    onChange={handleChange}
  />
) : (
  <ContentViewer content={content} />
)}
```

#### ✅ REPLACE WITH: Unified ContentDisplay
```typescript
// ✅ USE: Single unified component
import ContentDisplay from "../components/content/ContentDisplay";

<ContentDisplay
  content={content}
  isEditable={canEdit}
  onChange={handleChange}
/>
```

### ❌ Old CSS Classes (DELETE THESE)

```css
/* ❌ DELETE: Old scattered CSS classes */
.editor-container
.content-viewer-container
.content-viewer              /* without wewrite- prefix */
.page-editor-stable
```

#### ✅ REPLACE WITH: Unified CSS System
```css
/* ✅ USE: New wewrite-* naming convention */
.wewrite-editor-container
.wewrite-viewer-container
.wewrite-viewer-content
.wewrite-content-display
```

## 🎨 **Border & Styling Patterns**

### ❌ Inconsistent Padding (DELETE THESE)

#### Old Title/Input Padding
```css
/* ❌ DELETE: Old inconsistent padding patterns */
px-1 py-0.5    /* Old title input padding */
px-2 py-1      /* Old title display padding */
px-3           /* Non-standard horizontal padding */
py-0.5         /* Too small vertical padding */
py-1           /* Inconsistent vertical padding */
```

#### ✅ REPLACE WITH: Standardized Padding
```css
/* ✅ USE: Standardized padding system */
px-4           /* Standard horizontal padding (16px) */
py-2           /* Standard title vertical padding (8px) */
py-4           /* Standard body vertical padding (16px) */
```

### ❌ Hardcoded Border Colors (DELETE THESE)

```css
/* ❌ DELETE: Hardcoded border colors */
border-gray-300
border-gray-200
border-neutral-200
border-neutral-300
border-slate-200
dark:border-gray-600
dark:border-gray-700
dark:border-neutral-700
```

#### ✅ REPLACE WITH: Theme-Aware Borders
```css
/* ✅ USE: Theme-aware border system */
border-muted-foreground/30              /* Default state */
border-primary/50 ring-2 ring-primary/20   /* Focus state */
border-destructive                      /* Error state */
```

### ❌ Inconsistent Focus States (DELETE THESE)

```css
/* ❌ DELETE: Old focus patterns */
focus:border-blue-500
focus:border-blue-400
focus:ring-1
focus:ring-blue-200
focus:ring-blue-300
focus:outline-blue-500
```

## 🔧 **Component Architecture Patterns**

### ❌ Complex Layout Systems (SIMPLIFY THESE)

#### Old Complex Nested Layouts
```jsx
/* ❌ DELETE: Complex nested layout patterns */
<div className="flex flex-col">
  <div className="flex-1">
    <div className="relative">
      <div className="absolute inset-0">
        <div className="h-full w-full">
          {/* Overly nested content */}
        </div>
      </div>
    </div>
  </div>
</div>
```

#### ✅ REPLACE WITH: Simple Stacked Layouts
```jsx
/* ✅ USE: Simple stacked page layouts */
<div className="px-4 space-y-6">
  {/* Direct content stacking */}
</div>
```

### ❌ Multiple Modal Components (CONSOLIDATE THESE)

```jsx
/* ❌ DELETE: Separate modal components */
<DeleteModal />
<EditModal />
<ConfirmModal />
<CustomModal />
```

#### ✅ REPLACE WITH: Single Global Modal
```jsx
/* ✅ USE: Single global modal with variants */
<GlobalModal variant="delete" />
<GlobalModal variant="edit" />
<GlobalModal variant="confirm" />
```

## 🔍 **Search Patterns for Cleanup Runs**

### Automated Search Commands

#### Find Inconsistent Padding
```bash
# Find old padding patterns
grep -r "px-[123][^0-9]" app/components/ --include="*.tsx"
grep -r "py-0\.5\|py-1[^0-9]" app/components/ --include="*.tsx"
grep -r "p-[123][^0-9]" app/components/ --include="*.tsx"
```

#### Find Hardcoded Colors
```bash
# Find hardcoded border colors
grep -r "border-gray\|border-neutral\|border-slate" app/ --include="*.tsx"
grep -r "dark:border-" app/ --include="*.tsx"
grep -r "bg-gray\|bg-neutral\|bg-slate" app/ --include="*.tsx"
```

#### Find Complex Layouts
```bash
# Find overly nested layouts
grep -r "absolute inset-0" app/components/ --include="*.tsx"
grep -r "flex.*flex.*flex" app/components/ --include="*.tsx"
grep -r "relative.*absolute.*relative" app/components/ --include="*.tsx"
```

#### Find Multiple Modal Patterns
```bash
# Find separate modal components
grep -r "Modal.*Modal" app/components/ --include="*.tsx"
grep -r "Dialog.*Dialog" app/components/ --include="*.tsx"
find app/components -name "*Modal.tsx" -o -name "*Dialog.tsx"
```

## 🎯 **Priority Cleanup Areas**

### High Priority (Fix Immediately)
1. **Page Elements**: Title, body, footer inconsistencies
2. **Form Inputs**: Inconsistent border and padding patterns
3. **Modal Components**: Multiple separate modal implementations
4. **Button Variants**: Inconsistent styling across variants

### Medium Priority (Fix During Feature Work)
1. **Card Components**: Inconsistent border and spacing
2. **Navigation Elements**: Mixed styling patterns
3. **Loading States**: Inconsistent skeleton patterns
4. **Error States**: Mixed error styling approaches

### Low Priority (Fix During Maintenance)
1. **Icon Sizing**: Inconsistent icon dimensions
2. **Typography**: Mixed font weight and size patterns
3. **Animation Timing**: Inconsistent transition durations
4. **Responsive Breakpoints**: Mixed responsive patterns

## 📋 **Cleanup Checklist Template**

### Before Starting Cleanup
- [ ] Search for deprecated patterns using provided commands
- [ ] Document current usage locations
- [ ] Plan replacement strategy
- [ ] Test replacement patterns in isolation

### During Cleanup
- [ ] Replace patterns systematically (one type at a time)
- [ ] Test each replacement thoroughly
- [ ] Update related documentation
- [ ] Verify no regressions in functionality

### After Cleanup
- [ ] Run full test suite
- [ ] Visual regression testing
- [ ] Update this documentation with new patterns found
- [ ] Document any exceptions or special cases

## 🔄 **Regular Maintenance Schedule**

### Weekly
- [ ] Search for new instances of deprecated patterns
- [ ] Review recent commits for pattern violations
- [ ] Update cleanup documentation

### Monthly
- [ ] Full audit of component consistency
- [ ] Update search patterns based on new findings
- [ ] Review and update priority levels

### Quarterly
- [ ] Major cleanup runs for accumulated technical debt
- [ ] Review and update this documentation
- [ ] Plan architectural improvements

## 📚 **Related Documentation**

### Core Documentation Files
- **`docs/BORDER_STYLING_GUIDELINES.md`** - Updated border and padding standards
- **`docs/LEGACY_CODE_CLEANUP_GUIDE.md`** - Comprehensive cleanup procedures
- **`docs/AUTHENTICATION_ARCHITECTURE.md`** - Auth system standards
- **`docs/DEPENDENCY_MANAGEMENT_STANDARDS.md`** - Import and dependency patterns

### Component Documentation
- **`app/components/pages/PageFooter.js`** - Updated with px-4 padding standards
- **`app/components/pages/PageActions.tsx`** - Updated with styling standards
- **`app/components/pages/PageHeader.tsx`** - Standardized border patterns

### Search Commands Quick Reference
```bash
# Find all deprecated UI patterns at once
grep -r "px-[123][^0-9]\|py-0\.5\|py-1[^0-9]" app/components/ --include="*.tsx"
grep -r "border-gray\|border-neutral\|dark:border-" app/ --include="*.tsx"
grep -r "focus:border-blue\|focus:ring-1[^0-9]" app/components/ --include="*.tsx"
```

## 📞 **Support & Questions**

For questions about deprecated patterns or cleanup procedures:
1. Check existing documentation first
2. Search codebase for similar implementations
3. Consult with team before creating new patterns
4. Update this document with new findings

## 🔄 **Documentation Maintenance**

This documentation was last updated: **2024** with recent border standardization changes.

### When to Update This Document
- After major UI/styling standardizations
- When new deprecated patterns are identified
- After successful cleanup runs
- When new search patterns are discovered

### Keeping Documentation Current
- Update search commands when new patterns emerge
- Add new deprecated patterns as they're identified
- Remove patterns that have been fully cleaned up
- Update priority levels based on current codebase state
