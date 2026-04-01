# ContentPageView System — Architectural Audit & Refactoring Plan

**Date:** June 2025 (Audit) / March 2026 (Phase 0-2 Implemented)  
**Scope:** `app/[id]/page.tsx` → `ContentPageClient.tsx` → `ContentPageView.tsx` → `Editor.tsx` + supporting files  
**Original lines across 7 core files:** ~6,014  
**ContentPageView.tsx:** Reduced from 2,448 → 1,999 lines (449 lines extracted into 4 hooks)

---

## Executive Summary

ContentPageView.tsx is a **2,448-line god component** with **32 `useState`, 26 `useEffect`, 19 `useRef`, 13 `useCallback`, and 5 `useMemo`** hooks. It handles page loading, new page creation, editing, auto-save, version comparison, diff viewing, command palette registration, unsaved changes protection, location updates, keyboard shortcuts, and the entire page lifecycle — all in one file.

The core problems are:
1. **Too many responsibilities** — violates Single Responsibility Principle
2. **Ref-mirroring antipattern** — every piece of state has a shadow ref to avoid stale closures, a symptom of overgrown effects
3. **Fragile state synchronization** — editor content flows through 3 layers (ContentPageView state → Editor prop → Slate internal state) with manual reconciliation
4. **URL-derived state coupling** — `isNewPageMode` derived from `useSearchParams()` makes the component sensitive to Next.js router internals
5. **Bug-prone save path** — `window.history.replaceState(null, ...)` triggers Next.js `ACTION_RESTORE`, causing state reset on first save of new pages

The system works — but every bug fix adds more guards, refs, and comments like `// CRITICAL FIX`. The complexity is self-reinforcing.

---

## Part 1: Current Architecture Map

### Component Hierarchy

```
app/[id]/page.tsx (Server Component — 289 lines)
  ├─ Branches on isNewPage/deleted/error/success
  ├─ Fetches page data server-side with ISR (60s revalidation)
  └─ Renders ContentPageClient with initialStatus + initialPageData

ContentPageClient.tsx (Client wrapper — 217 lines)
  ├─ Error boundary
  ├─ Dynamic import of ContentPageView
  └─ Passes through all props

ContentPageView.tsx (God component — 2,448 lines)
  ├─ 50+ imports, 8 lazy-loaded components
  ├─ ALL state management (32 useState)
  ├─ ALL effects (26 useEffect)
  ├─ ALL business logic (save, auto-save, delete, version loading)
  └─ Renders: Header, Editor, Footer, Replies, Graph, Related Pages, etc.

Editor.tsx (Slate wrapper — 1,593 lines)
  ├─ Content normalization (normalizeContent — 150 lines)
  ├─ External content sync (compares JSON.stringify of prop vs internal)
  ├─ Toolbar, formatting, link editing, image upload
  └─ Plugin system (mentions, links, etc.)

ContentPageHeader.tsx (1,112 lines)
  ├─ Title editing, metadata display
  ├─ Visibility toggle, daily note navigation
  └─ Another complex component that could be audited separately
```

### State Inventory (ContentPageView.tsx)

#### Core Page State (should be a single reducer)
| State | Purpose | Has Shadow Ref? |
|-------|---------|----------------|
| `page` | Full page object | No |
| `pageId` | Current page ID | No |
| `title` | Current title | Yes (`currentTitleRef`) |
| `editorState` | Current editor content | Yes (`currentEditorStateRef`) |
| `location` | Geo location | Yes (`currentLocationRef`) |
| `customDate` | Custom date override | No |

#### Save/Edit State
| State | Purpose | Has Shadow Ref? |
|-------|---------|----------------|
| `isEditing` | Edit mode flag | No |
| `isSaving` | Save in progress | No |
| `justSaved` | Recently saved guard | Yes (`justSavedRef`) |
| `saveSuccess` | Save animation trigger | No |
| `error` | Error message | No |

#### Auto-Save State
| State | Purpose |
|-------|---------|
| `autoSaveStatus` | 'idle' / 'pending' / 'saving' / 'saved' / 'error' |
| `autoSaveError` | Auto-save error message |
| `lastSavedAt` | Timestamp for UI display |

#### New Page State
| State | Purpose | Has Shadow Ref? |
|-------|---------|----------------|
| `newPageCreated` | Setup complete flag | No |
| `isClosingNewPage` | Exit animation flag | No |
| `isScrollReady` | Scroll-to-top guard | No |
| — | New page mode tracking | Yes (`isNewPageRef`) |

#### UI State (miscellaneous)
| State | Purpose |
|-------|---------|
| `isLoading` | Loading indicator |
| `showGraphView` | Graph panel toggle |
| `graphSize` | Graph panel size |
| `isDenseMode` | Dense reading mode |
| `emptyLinesCount` | Empty lines alert |
| `showLinkSuggestions` | Link suggestions toggle |
| `linkSuggestionCount` | Link suggestion count |
| `linkInsertionTrigger` | Callback from Editor |
| `linkModalOpen` | Link editor modal |
| `linkModalEditingLink` | Link being edited |
| `linkModalSelectedText` | Selected text for link |
| `versionData` | Version comparison data |
| `contentPaddingTop` | Dynamic padding |

#### Refs (19 total)
- **Shadow refs** (avoid stale closures): `currentTitleRef`, `currentLocationRef`, `currentEditorStateRef`, `justSavedRef`, `isNewPageRef`
- **Saved baseline refs**: `lastSavedContentRef`, `lastSavedTitleRef`, `lastSavedLocationRef`, `lastSavedCustomDateRef`
- **Auto-save refs**: `autoSaveSessionIdRef`, `autoSaveBaselineInitialized`, `autoSaveBaselineJustInitialized`, `autoSaveTimeoutRef`
- **DOM/instance refs**: `editorRef`, `contentRef`, `viewRecorded`, `unsubscribeRef`, `graphRefreshRef`, `locationUpdateProcessedRef`, `updateSavedLocationRef`

### Effect Inventory (26 useEffects)

| # | Purpose | Dependencies | Lines |
|---|---------|-------------|-------|
| 1 | Scroll to top on new page | `isNewPageMode, isScrollReady` | ~5 |
| 2 | Location update from URL params | `searchParams` | ~25 |
| 3 | Hydrate from server initialPageData | `initialPageData` | ~30 |
| 4 | Record page view | `page, user, pageId` | ~15 |
| 5 | Set page title in document | `title, page` | ~5 |
| 6 | New page mode setup | `isNewPageMode, pageId, user, newPageCreated, searchParams` | ~120 |
| 7 | Page loading (main fetch) | `pageId, user?.uid, showVersion, versionId, showDiff, compareVersionId` | ~200 |
| 8 | Version loading | `showVersion, versionId` | ~30 |
| 9 | Diff comparison loading | `showDiff, compareVersionId` | ~40 |
| 10 | Keep `currentTitleRef` in sync | `title` | ~3 |
| 11 | Keep `currentLocationRef` in sync | `location` | ~3 |
| 12 | Keep `currentEditorStateRef` in sync | `editorState` | ~3 |
| 13 | Initialize auto-save baseline | `editorState, title, location` | ~10 |
| 14 | Reset auto-save baseline on page change | `pageId` | ~3 |
| 15 | Generate auto-save session ID | `canEdit, pageId` | ~5 |
| 16 | Auto-save trigger (debounced) | `editorState, title, location, canEdit, isSaving, handleSave, page?.isNewPage, autoSaveStatus` | ~100 |
| 17 | Keyboard shortcuts | `handleSave, handleCancel, isEditing, hasChanges, canEdit` | ~20 |
| 18 | Command palette registration | `pageId, page, title, isEditing, canEdit, ...` | ~15 |
| 19 | Editor content sync from `page.content` | `page?.content, hasChanges, justSaved, isNewPageMode` | ~15 |
| 20 | Dense mode from localStorage | — | ~5 |
| 21 | Optimistic page handling | `pageId, hasOptimisticPage` | ~10 |
| 22 | Add to recent pages | `page, pageId` | ~5 |
| 23 | Cleanup on unmount | — | ~5 |
| 24 | Content padding from header height | `page` | ~5 |
| 25 | URL param for replyType handling | `searchParams` | ~10 |
| 26 | Tag migration check | `page` | ~10 |

---

## Part 2: Identified Problems

### P1: The `replaceState(null)` Bug (Active Bug — Causes State Reset)

**Location:** `ContentPageView.tsx` line ~1585  
**Code:** `window.history.replaceState(null, '', newUrl)`

After the first save of a new page, this call removes the `?new=true` query param. But passing `null` as the state data causes Next.js to dispatch `ACTION_RESTORE` to its router, which updates `useSearchParams()`. This flips `isNewPageMode` from `true` → `false`, potentially causing:
- The server component at `app/[id]/page.tsx` to reconsider its branch (though client components shouldn't remount)
- Effect #19 (editor content sync) to re-run since `isNewPageMode` is in its dependency array
- Loss of focus, modal closures, and the "state reset" feeling

**Fix:** Replace `null` with `window.history.state` to preserve Next.js's internal `__NA` flag:
```ts
window.history.replaceState(window.history.state, '', newUrl);
```

### P2: God Component (Structural — Root Cause of Complexity)

ContentPageView.tsx does everything: page loading, new page setup, editing, saving, auto-saving, version comparison, diff display, command palette integration, unsaved changes protection, keyboard shortcuts, page deletion, location handling, and rendering 10+ child components.

**Impact:** Every new feature or bug fix increases coupling. The 26 effects interact through shared state, making it impossible to reason about execution order.

### P3: Ref-Mirroring Antipattern (Code Smell)

Pattern found 5 times:
```ts
const [title, setTitle] = useState('');
const currentTitleRef = useRef(title);
useEffect(() => { currentTitleRef.current = title; }, [title]);
```

This exists because callbacks inside `setTimeout` (auto-save) and `useCallback` (handleSave) would otherwise capture stale values. The proper fix is `useReducer` + dispatch (actions are stable references) or extracting the auto-save logic into a custom hook with proper closure management.

### P4: Triple Content Sync (Fragile Data Flow)

Content flows through 3 representations:
1. `ContentPageView.editorState` (React state — array of Slate nodes)
2. `Editor.initialContent` prop → `normalizedInitialContent` memo → compared via `JSON.stringify`
3. `Slate.editor.children` (internal mutable state)

Sync mechanisms:
- **ContentPageView → Editor:** Effect #19 sets `editorState` from `page.content`, but only if `!hasChanges && !justSaved && !isNewPageMode`
- **Editor internal sync:** Compares `JSON.stringify(normalizedInitialContent)` against `prevContentRef.current`, resets `editor.children` if different
- **Editor → ContentPageView:** `handleChange` in Editor calls `onChange` prop, which eventually hits `setEditorState`

Each layer has guards (`isInternalChangeRef`, `prevContentRef`, `justSavedRef`) to prevent infinite update loops. This is fragile — any new code path that updates content must know about all three guard systems.

### P5: URL-Derived State for Critical Branching

`isNewPageMode = searchParams?.get('new') === 'true'` is used in:
- 4 `useEffect` dependency arrays
- 3 early return guards
- 2 conditional render branches
- `handleSave` logic (first save detection)

This creates a coupling to Next.js's URL reactivity system. The `isNewPageRef` ref was added as a workaround, creating a dual-tracking system where some code checks the ref and other code checks the derived state.

### P6: Over-Sized Effect Dependencies

The auto-save effect (Effect #16) depends on 8 values including `editorState`. Since `editorState` changes on every keystroke, this effect runs on every keystroke. Inside it, the effect reads from refs to get "current" values — defeating the purpose of the dependency array. The debounce timer is re-created on every keystroke.

### P7: JSON.stringify for Deep Comparison

`hasChanges` memo and auto-save both use `JSON.stringify()` to compare editor content. For large documents, this is O(n) on every render. Slate nodes can contain complex nested structures.

---

## Part 3: Refactoring Plan

### Phase 0: Fix the Active Bug (1 line change)

Fix the `replaceState(null)` bug immediately — it's a single line change that resolves the state reset on first save of new pages.

```diff
- window.history.replaceState(null, '', newUrl);
+ window.history.replaceState(window.history.state, '', newUrl);
```

**Risk:** None. `window.history.state` contains Next.js's internal state (`__NA` flag) which tells Next.js not to dispatch `ACTION_RESTORE`.

---

### Phase 1: Extract Custom Hooks (Reduce ContentPageView by ~60%)

Break the god component into focused hooks. Each hook owns its state, refs, and effects.

#### Hook 1: `usePageLoader(pageId, options)`
**Extracts:** Effects #3 (hydration), #7 (main fetch), #4 (view recording), #21 (optimistic page), #22 (recent pages)  
**State moved:** `page`, `pageId`, `isLoading`, `error`, `hasOptimisticPage`  
**Lines saved:** ~300

```ts
function usePageLoader(rawPageId: string, options: {
  initialPageData?: any;
  showVersion?: boolean;
  versionId?: string;
  userId?: string;
}) {
  // All page fetching, hydration, and error handling
  return { page, setPage, pageId, isLoading, error, setError };
}
```

#### Hook 2: `useNewPageMode(pageId, user, searchParams)`
**Extracts:** Effect #6 (new page setup), scroll-to-top layout effect, new page state  
**State moved:** `newPageCreated`, `isClosingNewPage`, `isScrollReady`, `isNewPageRef`  
**Lines saved:** ~150

```ts
function useNewPageMode(pageId: string, user: User | null, searchParams: URLSearchParams) {
  // Parse URL params, build initial page data, manage new page lifecycle
  return { 
    isNewPageMode, isNewPageReady, isClosingNewPage,
    initialPageData, handleCloseNewPage 
  };
}
```

#### Hook 3: `useAutoSave(content, title, location, options)`
**Extracts:** Effects #10-16 (all ref-sync effects, baseline init, session ID, auto-save trigger)  
**State moved:** `autoSaveStatus`, `autoSaveError`, `lastSavedAt`  
**Refs moved:** `currentTitleRef`, `currentLocationRef`, `currentEditorStateRef`, `autoSaveSessionIdRef`, `autoSaveBaselineInitialized`, `autoSaveBaselineJustInitialized`, `autoSaveTimeoutRef`  
**Lines saved:** ~200

```ts
function useAutoSave(options: {
  content: SlateNode[];
  title: string;
  location: Location | null;
  canEdit: boolean;
  isSaving: boolean;
  isNewPage: boolean;
  onSave: () => Promise<void>;
}) {
  // All auto-save logic, debouncing, baseline tracking
  return { autoSaveStatus, autoSaveError, lastSavedAt, sessionId };
}
```

This hook encapsulates all the ref-mirroring inside itself, where the refs are an implementation detail rather than a confusing pattern.

#### Hook 4: `usePageSave(page, editorState, title, location)`
**Extracts:** `handleSave` callback, `hasChanges` memo, saved baseline refs  
**State moved:** `isSaving`, `justSaved`, `saveSuccess`  
**Refs moved:** `lastSavedContentRef`, `lastSavedTitleRef`, `lastSavedLocationRef`, `lastSavedCustomDateRef`, `justSavedRef`  
**Lines saved:** ~400

```ts
function usePageSave(options: {
  page: Page;
  pageId: string;
  editorState: SlateNode[];
  title: string;
  location: Location | null;
  customDate: string | null;
  autoSaveSessionId: string | null;
}) {
  // Save logic, change detection, saved baselines
  return { 
    handleSave, hasChanges, isSaving, justSaved, saveSuccess,
    lastSavedContentRef, lastSavedTitleRef 
  };
}
```

#### Hook 5: `useVersionComparison(pageId, options)`
**Extracts:** Effects #8 (version loading), #9 (diff comparison)  
**State moved:** `versionData`  
**Lines saved:** ~80

#### Hook 6: `usePageKeyboardShortcuts(handlers)`
**Extracts:** Effect #17  
**Lines saved:** ~25 (small but isolates responsibility)

**Net result:** ContentPageView.tsx drops from ~2,448 lines to ~1,000 lines (the render JSX, state coordination, and child component props).

---

### Phase 2: Replace URL-Derived State with Stable State

Instead of deriving `isNewPageMode` from `searchParams?.get('new')`:

```ts
// Before: reactive to URL changes, coupled to Next.js router
const isNewPageMode = searchParams?.get('new') === 'true';

// After: set once, stable throughout lifecycle
const [pageMode, setPageMode] = useState<'new' | 'existing' | 'version' | 'diff'>(() => {
  if (initialStatus === 'new-page') return 'new';
  if (showVersion) return 'version';
  if (showDiff) return 'diff';
  return 'existing';
});
```

This eliminates:
- The `isNewPageRef` workaround
- Sensitivity to `searchParams` changes
- The dual-tracking (ref vs derived state) pattern
- 4 effect dependency array entries

---

### Phase 3: Simplify Content Sync (Editor.tsx)

The current 3-layer sync is the most fragile part. Simplify to:

1. **ContentPageView** owns `editorState` (source of truth for React)
2. **Editor** receives `value` and `onChange` — standard controlled component pattern
3. Remove the internal `prevContentRef` / `isInternalChangeRef` dance in Editor.tsx

```ts
// Editor.tsx — simplified
function Editor({ value, onChange, ...rest }) {
  const normalizedValue = useMemo(() => normalizeContent(value), [value]);
  
  return (
    <Slate editor={editor} initialValue={normalizedValue} onChange={onChange}>
      {/* ... */}
    </Slate>
  );
}
```

**Caveat:** Slate's `initialValue` is only read on mount. For external updates (e.g., real-time collaboration), we'd still need `editor.children = ...`. But for single-user editing, the parent already holds the state and the editor doesn't need to reconcile external changes during active editing. The sync effect (#19) would become unnecessary if we stop pushing `page.content` back into the editor after loads — instead, only set `editorState` once when the page first loads.

---

### Phase 4: Consider `useReducer` for Page State

The 6 core state variables + 5 shadow refs + flags like `justSaved` form an implicit state machine. Making it explicit:

```ts
type PageState = {
  page: Page | null;
  title: string;
  content: SlateNode[];
  location: Location | null;
  customDate: string | null;
  status: 'loading' | 'ready' | 'saving' | 'saved' | 'error';
  error: string | null;
  mode: 'new' | 'existing' | 'version' | 'diff';
};

type PageAction =
  | { type: 'PAGE_LOADED'; payload: Page }
  | { type: 'CONTENT_CHANGED'; payload: SlateNode[] }
  | { type: 'TITLE_CHANGED'; payload: string }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_COMPLETED'; payload: { content: SlateNode[]; title: string } }
  | { type: 'SAVE_FAILED'; payload: string }
  | { type: 'NEW_PAGE_SETUP'; payload: Page }
  // ...
```

**Benefits:**
- `dispatch` is a stable reference — no stale closures, no ref-mirroring needed
- State transitions are explicit and testable
- The reducer can enforce invariants (e.g., can't save while loading)

**This is optional** — the custom hooks in Phase 1 solve 80% of the problem. The reducer is the "clean architecture" move if you want long-term maintainability.

---

### Phase 5: Split the Render (Optional)

The JSX section of ContentPageView has several conditional branches. These could become separate components:

```
ContentPageView
  ├─ NewPageView (loading skeleton + slide animation)
  ├─ VersionComparisonView (version/diff rendering)
  └─ PageEditorView (the main editing experience)
       ├─ ContentPageHeader
       ├─ EditorSection (Editor + EmptyLinesAlert + LinkSuggestions)
       ├─ ContentPageFooter
       └─ BelowFoldSection (Replies, Graph, Related, WhatLinksHere)
```

---

## Part 4: Prioritized Roadmap

| Priority | Change | Risk | Impact | Effort | Status |
|----------|--------|------|--------|--------|--------|
| **P0** | Fix `replaceState(null)` bug | None | Fixes active user-facing bug | 5 min | ✅ Done |
| **P1** | Extract `useAutoSave` hook | Low | Removes 7 refs + 6 effects from main file | 2-3 hrs | ✅ Done |
| **P2** | Extract `usePageSave` hook | Low | Isolates save logic + change detection | 2-3 hrs | ✅ Done (as `useChangeDetection`) |
| **P3** | Extract `usePageLoader` hook | Low | Isolates fetch/hydration logic | 1-2 hrs | Deferred |
| **P4** | Extract `useNewPageMode` hook | Medium | Isolates new page lifecycle, enables Phase 2 | 1-2 hrs | ✅ Done (as `useNewPageSetup`) |
| **P5** | Replace URL-derived state (Phase 2) | Medium | Eliminates `isNewPageRef` dual-tracking | 1 hr | ✅ Done (stable useState in useNewPageSetup) |
| **P6** | Simplify Editor content sync (Phase 3) | Medium | Removes fragile 3-layer reconciliation | 2-3 hrs | Not started |
| **P7** | Extract `useVersionComparison` hook | Low | Small cleanup | 30 min | Not started |
| **P8** | `useReducer` for page state (Phase 4) | Higher | Eliminates all ref-mirroring | 3-4 hrs | Not started |
| **P9** | Split render into sub-components (Phase 5) | Low | Readability improvement | 1-2 hrs | Not started |

### Recommended Implementation Order

1. **P0** — Fix the bug now (1 line)
2. **P1 + P2** — Extract auto-save and save hooks together (they share refs)
3. **P3 + P4** — Extract page loader and new page mode hooks
4. **P5** — Replace URL-derived state (enabled by P4)
5. **P6** — Simplify Editor content sync (enabled by P2's cleaner save flow)
6. **P7-P9** — Polish passes

Each phase is independently deployable and testable. No phase requires changes to the database, API, or other components outside the content page system.

---

## Part 5: What NOT to Change

- **The Slate.js editor itself** — Editor.tsx's toolbar, formatting, plugins, and rendering are working. Only the content sync mechanism needs simplification.
- **The server component** (`app/[id]/page.tsx`) — The ISR caching, metadata generation, and branching logic is sound.
- **ContentPageClient.tsx** — The error boundary and dynamic import wrapper is appropriate.
- **The auto-save UX** — The 1-second debounce, session-based version batching, and pending/saving/saved indicators are good. Only the implementation needs to be extracted.
- **ContentPageHeader.tsx** — It's large (1,112 lines) but that's a separate audit.
- **Lazy-loaded components** — The dynamic imports for below-fold components are correct for performance.

---

## Appendix: Key File Locations

| File | Lines | Role |
|------|-------|------|
| `app/[id]/page.tsx` | 289 | Server component, ISR, metadata |
| `app/[id]/ContentPageClient.tsx` | 217 | Error boundary, dynamic import |
| `app/components/pages/ContentPageView.tsx` | 2,448 | God component (target of refactor) |
| `app/components/editor/Editor.tsx` | 1,593 | Slate editor wrapper |
| `app/components/pages/ContentPageHeader.tsx` | 1,112 | Header/title/metadata |
| `app/components/pages/ContentPageFooter.tsx` | ~200 | Footer actions |
| `app/hooks/useUnsavedChanges.ts` | ~100 | Navigation guard |
