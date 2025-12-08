# Link Suggestions Feature - Implementation Plan

## Overview

Based on the user request: "Under the insert link button in the edit view, add a 'Show Link Suggestions' toggle which will show dotted underlines for all words that might should be linked. Clicking on one allows the user to approve, reject, or correct (search for different page) the suggestion."

## Current System Audit

### ✅ Already Implemented

1. **Backend API** - `/api/link-suggestions`
   - Confidence scoring (exact: 1.0, contains: 0.8, phrase: 0.6, word: 0.4)
   - Queries all public pages
   - Returns suggestions with match types

2. **Client Service** - `app/services/linkSuggestionService.ts`
   - `findLinkSuggestions()` function
   - Returns `LinkSuggestion[]` interface

3. **React Hook** - `app/hooks/useLinkSuggestions.ts`
   - State management for suggestions
   - `analyzeText()`, `showSuggestionModal()`, `dismissSuggestion()`, `selectSuggestion()`
   - `setEnabled()` for toggle functionality

4. **Existing Modal** - `app/components/modals/LinkSuggestionModal.tsx`
   - Shows suggestions grouped by title
   - Approve (Link button) and Dismiss functionality
   - Missing: "Correct" option

5. **Editor Modal** - `app/components/editor/LinkSuggestionEditorModal.tsx`
   - Alternative modal for editor context
   - Has search functionality built-in

6. **CSS for Dotted Underlines** - Already documented
   ```css
   .link-suggestion {
     text-decoration: underline dotted;
     cursor: pointer;
   }
   ```

### ❌ Missing Components

1. **Toggle Button** - Not present under "Insert Link" button
2. **Visual Indicators** - Dotted underlines not integrated into editor
3. **"Correct" Option** - Missing from modal
4. **Click Handlers** - Not wired up to editor content

## Implementation Plan

### Phase 1: Add Toggle Button (Estimated: 30 mins)

**File**: `app/new/page.tsx` (lines 1212-1229)

```tsx
{/* Insert Link Button */}
{isEditing && (
  <div className="mt-6 flex flex-col items-center gap-3">
    {/* Insert Link Button */}
    <Button
      variant="default"
      size="lg"
      className="gap-2 w-full md:w-auto rounded-2xl font-medium"
      onClick={() => {
        if (linkInsertionTrigger) {
          linkInsertionTrigger();
        }
      }}
    >
      <Link className="h-5 w-5" />
      <span>Insert Link</span>
    </Button>

    {/* Show Link Suggestions Toggle */}
    <div className="flex items-center gap-2">
      <Switch
        id="link-suggestions-toggle"
        checked={showLinkSuggestions}
        onCheckedChange={setShowLinkSuggestions}
      />
      <Label
        htmlFor="link-suggestions-toggle"
        className="text-sm font-medium cursor-pointer"
      >
        Show Link Suggestions
      </Label>
    </div>
  </div>
)}
```

**State to Add**:
```tsx
const [showLinkSuggestions, setShowLinkSuggestions] = useState(false);
```

### Phase 2: Integrate Link Suggestions Hook (Estimated: 1 hour)

**File**: `app/new/page.tsx`

```tsx
import { useLinkSuggestions } from '../hooks/useLinkSuggestions';

// In component
const {
  allSuggestions,
  isLoading: suggestionsLoading,
  analyzeText,
  showSuggestionModal,
  dismissSuggestion,
  selectSuggestion,
  setEnabled
} = useLinkSuggestions();

// Sync toggle state with hook
useEffect(() => {
  setEnabled(showLinkSuggestions);
}, [showLinkSuggestions, setEnabled]);

// Analyze text when toggle is enabled and content changes
useEffect(() => {
  if (showLinkSuggestions && editorContent) {
    // Extract plain text from Slate content
    const plainText = editorContent
      .map(node => Node.string(node))
      .join('\n');

    analyzeText(plainText, user?.uid);
  }
}, [showLinkSuggestions, editorContent, user?.uid, analyzeText]);
```

### Phase 3: Add Visual Indicators (Estimated: 2 hours)

**Challenge**: Slate.js doesn't support text decorations without node structure changes.

**Option A: Leaf Decorations** (Recommended)
Add decorations to the editor that highlight suggested words:

**File**: `app/components/editor/Editor.tsx`

```tsx
// Add decorate function
const decorate = useCallback(([node, path]) => {
  const ranges = [];

  if (!showLinkSuggestions || !suggestions.length) {
    return ranges;
  }

  if (Text.isText(node)) {
    const { text } = node;

    // Find matching suggestions in this text node
    suggestions.forEach(suggestion => {
      const start = text.indexOf(suggestion.matchedText);
      if (start !== -1) {
        ranges.push({
          anchor: { path, offset: start },
          focus: { path, offset: start + suggestion.matchedText.length },
          suggestion: suggestion,
          isSuggestion: true
        });
      }
    });
  }

  return ranges;
}, [showLinkSuggestions, suggestions]);

// Pass to Slate component
<Slate
  editor={editor}
  initialValue={normalizedInitialContent}
  onChange={handleChange}
>
  <Editable
    decorate={decorate}
    renderLeaf={renderLeaf}
    // ...
  />
</Slate>
```

Update `renderLeaf`:
```tsx
const renderLeaf = useCallback((props: any) => {
  let { children } = props;

  if (props.leaf.isSuggestion) {
    children = (
      <span
        className="link-suggestion cursor-pointer"
        style={{
          textDecoration: 'underline dotted',
          textDecorationColor: 'oklch(var(--primary))',
        }}
        onClick={(e) => {
          e.preventDefault();
          handleSuggestionClick(props.leaf.suggestion);
        }}
      >
        {children}
      </span>
    );
  }

  // ... existing bold, italic, code rendering

  return <span {...props.attributes}>{children}</span>;
}, [handleSuggestionClick]);
```

### Phase 4: Enhanced Modal with "Correct" Option (Estimated: 1 hour)

**File**: `app/components/modals/LinkSuggestionModal.tsx`

Add a third button option:

```tsx
// Current structure:
<Button onClick={handleDismiss}>Dismiss Suggestion</Button>
<Button onClick={() => onSelectPage(suggestion)}>Link</Button>

// Enhanced structure:
<div className="flex gap-2">
  <Button
    variant="secondary"
    onClick={handleDismiss}
  >
    Reject
  </Button>
  <Button
    variant="outline"
    onClick={() => setShowSearch(true)}
  >
    Correct
  </Button>
  <Button
    onClick={() => onSelectPage(suggestion)}
  >
    Approve
  </Button>
</div>

// Add search mode
{showSearch && (
  <div className="mt-4">
    <FilteredSearchResults
      onSelect={(page) => {
        onSelectPage({
          ...suggestion,
          id: page.id,
          title: page.title,
          username: page.username
        });
      }}
      userId={user?.uid}
      placeholder="Search for a different page..."
      autoFocus={true}
    />
  </div>
)}
```

### Phase 5: Wire Up Click Handlers (Estimated: 1 hour)

**File**: `app/new/page.tsx`

```tsx
// State for modal
const [selectedSuggestion, setSelectedSuggestion] = useState<LinkSuggestion | null>(null);
const [showSuggestionModal, setShowSuggestionModal] = useState(false);

// Click handler
const handleSuggestionClick = useCallback((suggestion: LinkSuggestion) => {
  setSelectedSuggestion(suggestion);
  setShowSuggestionModal(true);
}, []);

// Approve handler
const handleApproveSuggestion = useCallback((suggestion: LinkSuggestion) => {
  // Insert link at the suggestion position
  if (linkInsertionTrigger) {
    linkInsertionTrigger(); // This opens the link modal pre-filled
  }
  setShowSuggestionModal(false);
}, [linkInsertionTrigger]);

// Reject handler
const handleRejectSuggestion = useCallback((suggestion: LinkSuggestion) => {
  dismissSuggestion(suggestion.matchedText);
  setShowSuggestionModal(false);
}, [dismissSuggestion]);

// Correct handler
const handleCorrectSuggestion = useCallback((newPage: any) => {
  // Update suggestion with new page and approve
  const correctedSuggestion = {
    ...selectedSuggestion,
    id: newPage.id,
    title: newPage.title,
    username: newPage.username
  };
  handleApproveSuggestion(correctedSuggestion);
}, [selectedSuggestion, handleApproveSuggestion]);

// Render modal
{showSuggestionModal && selectedSuggestion && (
  <LinkSuggestionModal
    isOpen={showSuggestionModal}
    onClose={() => setShowSuggestionModal(false)}
    suggestions={[selectedSuggestion]}
    matchedText={selectedSuggestion.matchedText}
    onSelectPage={handleApproveSuggestion}
    onDismiss={handleRejectSuggestion}
    onCorrect={handleCorrectSuggestion}
  />
)}
```

## CSS Additions

**File**: `app/styles/globals.css` or component-specific

```css
.link-suggestion {
  text-decoration: underline dotted 2px;
  text-decoration-color: oklch(var(--primary) / 0.5);
  text-underline-offset: 3px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.link-suggestion:hover {
  text-decoration-color: oklch(var(--primary));
  background-color: oklch(var(--primary) / 0.1);
  border-radius: 2px;
}
```

## Testing Checklist

- [ ] Toggle appears under "Insert Link" button
- [ ] Toggle enables/disables link suggestions
- [ ] Dotted underlines appear on suggested words when enabled
- [ ] Clicking underlined word opens modal
- [ ] Modal shows "Approve", "Reject", and "Correct" options
- [ ] Approve creates link with suggested page
- [ ] Reject removes the suggestion
- [ ] Correct opens search to choose different page
- [ ] Suggestions update when content changes
- [ ] Performance is acceptable with long documents
- [ ] Works in both light and dark themes
- [ ] Mobile responsive

## Performance Considerations

1. **Debounce text analysis** - Don't analyze on every keystroke
   ```tsx
   const debouncedAnalyze = useMemo(
     () => debounce(analyzeText, 500),
     [analyzeText]
   );
   ```

2. **Limit suggestions** - Cap at 10-20 suggestions max
3. **Cache results** - Don't re-analyze unchanged text
4. **Lazy loading** - Only analyze visible content initially

## Accessibility

- [ ] Keyboard navigation for suggested words (Tab/Arrow keys)
- [ ] Screen reader announcements for suggestions
- [ ] Focus management in modal
- [ ] ARIA labels for toggle and suggestions

## Future Enhancements

1. **Auto-linking** - Automatically create links for high-confidence suggestions
2. **Suggestion ranking** - Prioritize more relevant suggestions
3. **Machine learning** - Learn from user accept/reject patterns
4. **Batch operations** - Approve/reject multiple suggestions at once
5. **Settings** - Confidence threshold slider
6. **Smart positioning** - Show modal near clicked suggestion

## Estimated Total Time

- **Phase 1**: 30 mins
- **Phase 2**: 1 hour
- **Phase 3**: 2 hours (most complex)
- **Phase 4**: 1 hour
- **Phase 5**: 1 hour
- **Testing**: 1 hour
- **Polish**: 30 mins

**Total**: ~7 hours of focused development

## Dependencies

- Slate.js decorations API
- Existing `useLinkSuggestions` hook
- Existing modal components
- API endpoint `/api/link-suggestions`

## Notes

This feature requires deep integration with the Slate editor. The main challenge is adding visual decorations without modifying the document structure. Slate's `decorate` API is the recommended approach.

Consider implementing this feature in stages, starting with the toggle and basic modal, then adding visual indicators as a later enhancement.

---

**Created**: 2025-12-08
**Status**: Planning/Documentation Phase
**Priority**: Medium
**Complexity**: High (Slate.js integration)
