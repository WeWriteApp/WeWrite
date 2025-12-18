## Text Selection & Attribution

### Overview
- All content pages use a single text selection system (`TextSelectionProvider` + `UnifiedTextSelectionMenu`) to avoid competing toolbars.
- Selecting text on someone else’s page is allowed; UI chrome is still excluded from selection.
- Copying selected text wraps it in quotes, adds `— by @username`, and writes WeWrite attribution metadata to the clipboard.
- Metadata is preserved in `text/html` via `data-wewrite-attribution` and a custom `application/wewrite-attribution` payload so future paste/render flows can attribute even if visible text is edited away.

### Where this runs
- `ContentPageView` wraps the page body in `TextSelectionProvider`, passing author id/username/page id/title for attribution.
- `useTextSelection` handles selection detection and clipboard formatting.
- `UnifiedTextSelectionMenu` is the single menu surface.
- `pasteHandler` preserves `data-wewrite-attribution` during sanitization.

### Expected behavior
- Users can select and copy body text on any content page.
- Copy creates:
  - Plain text: `“<selection>” — by username` (no @ prefix, no line numbers).
  - HTML: blockquote + pill-link to `/@username` with `data-wewrite-attribution` JSON (username, userId, pageId, pageTitle, copiedAt).
- Paste sanitization retains `data-wewrite-attribution` so downstream features can read attribution even if visible attribution text is removed.

### Design constraints
- Only one text selection menu should exist at a time (the unified implementation).
- Selection is allowed in content containers but blocked in headers/nav/buttons.
- Paragraph/line numbers are marked `user-select: none` so they don't get copied; multi-line selections preserve newlines in the body text.
- Attribution defaults to `"unknown"` if author info is missing, but still writes metadata for later reconciliation.
