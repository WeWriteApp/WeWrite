# Checkout Layout - Quick Reference Card

## 🚨 Critical Layout Rules for Checkout Pages

### Fixed Bottom Elements
```tsx
// ❌ WRONG - Content will be clipped
<div className="px-4">
  <PaymentElement />
</div>
<div className="fixed bottom-0">
  <Button>Subscribe</Button>
</div>

// ✅ CORRECT - Add bottom padding
<div className="px-4 pb-24"> {/* pb-24 = 96px for fixed button space */}
  <PaymentElement />
</div>
<div className="fixed bottom-0">
  <Button>Subscribe</Button>
</div>
```

### Router Navigation
```tsx
// ❌ WRONG - Will cause "router is not defined" error
function CheckoutForm() {
  return (
    <button onClick={() => router.push('/')}>
      <Logo />
    </button>
  );
}

// ✅ CORRECT - Import and use useRouter hook
function CheckoutForm() {
  const router = useRouter();
  return (
    <button onClick={() => router.push('/')}>
      <Logo />
    </button>
  );
}
```

### Mobile Spacing
```tsx
// ✅ Standard mobile checkout spacing
<div className="px-4 py-6 pb-24">
  {/*     ^     ^     ^
          |     |     └── Bottom padding for fixed button
          |     └────────── Vertical spacing (24px)
          └──────────────── Horizontal padding (16px)
  */}
</div>
```

## 🔍 Testing Checklist

Before deploying checkout changes:

- [ ] All form fields visible on mobile
- [ ] No JavaScript console errors
- [ ] Back button works
- [ ] Logo navigation works
- [ ] Subscribe button not overlapping content
- [ ] Test on multiple screen sizes

## 📱 Mobile Design Notes

- Mobile bottom nav is **intentionally hidden** on checkout pages
- Fixed subscribe button optimized for conversion
- Minimal header (back + logo only)
- Form fields must be fully accessible

## 🔒 HTTPS Development

**Problem:** Stripe requires HTTPS, localhost uses HTTP
```bash
# Setup HTTPS (one-time)
bun run dev:https:setup

# Start HTTPS server
bun run dev:https

# Visit: https://localhost:3000
```

**Benefits:**
- ✅ Stripe payments work properly
- ✅ No security warnings
- ✅ Resolves ChunkLoadError issues

## 🛠️ Common Fixes

| Issue | Solution | Code |
|-------|----------|------|
| Content clipped | Add bottom padding | `pb-24` |
| Router undefined | Add useRouter hook | `const router = useRouter()` |
| Poor mobile spacing | Add vertical padding | `py-6` |
| Button overlap | Increase bottom padding | `pb-32` if needed |

---
**File:** `app/settings/fund-account/checkout/page.tsx`  
**Last Updated:** August 2, 2025
