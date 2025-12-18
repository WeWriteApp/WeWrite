# Header Collapse Behavior

Context: `app/components/pages/ContentPageHeader.tsx`

## How it works
- Collapse is driven solely by `isScrolled` in `ContentPageHeader`.
- In **view mode** only (edit mode short-circuits), we attach a single scroll listener to `window` (and the document scrolling element when it differs).
- Collapse triggers when `window.scrollY` (or the scrolling element) exceeds ~48px (+ banner offset). A 12px hysteresis is applied so the header does not flicker or get stuck near the threshold.
- Padding and the scroll progress bar animate off the same scroll handler via `requestAnimationFrame` to avoid layout thrash.

## Implementation notes
- Dependencies: `isEditing`, `bannerOffset`. Edit mode disables the listener and forces expanded state/padding reset.
- Hysteresis means the header will not flip states until it crosses the threshold by a small buffer; this removes “stuck” states caused by noise.
- Progress calculation looks for `[data-page-content]` and falls back to document height.

## What to check when debugging
- Verify the page actually scrolls the document (no wrapper capturing scroll). Inspect `window.scrollY` while scrolling.
- Confirm the scroll handler is attached (look for add/remove in React effect).
- If the header is stuck expanded/collapsed, log `currentScroll` and `collapseThreshold` to confirm the hysteresis gates are crossed.

## Best practices
- Keep collapse logic centralized in this component—avoid competing observers elsewhere.
- Prefer the built-in CSS transitions; avoid extra timers or external DOM class toggles.
