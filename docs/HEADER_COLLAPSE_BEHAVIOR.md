# Header Collapse Behavior

## Overview
- Content page header collapses on scroll in view mode to show a compact bar with scroll progress.
- Collapse applies only when viewing pages you **do not** own; your own pages stay expanded in view mode, and edit mode always stays expanded.

## Rules
- Threshold: collapses after ~50px scroll (`isScrolled=true`).
- In edit mode: collapse disabled; header stays expanded.
- Owner pages (canEdit=true): remain expanded even on scroll.
- Other users’ pages: collapse on scroll, show progress bar beneath.

## Implementation Notes
- `ContentPageHeader` sets `isScrolled` based on scroll; guards check `canEdit` to avoid collapsing owner pages.
- Scroll progress is calculated and shown in the collapsed state under the header.
- If regressions occur, ensure scroll listener is active in view mode and that `canEdit` gating only disables collapse for owner pages.
