# WeWrite Diff Calculation System

## Overview

WeWrite uses a centralized diff calculation system to provide consistent, reliable text comparison across all features. This system powers version comparisons, activity feeds, and content change tracking.

## Architecture

### Core Components

1. **Diff API** (`/api/diff/route.ts`) - Server-side diff calculation service
2. **Diff Service** (`/utils/diffService.ts`) - Client-side interface and caching
3. **DiffPreview Component** (`/components/activity/DiffPreview.tsx`) - UI display component
4. **Text Extraction** (`/utils/text-extraction.ts`) - Content normalization

### Data Flow

```
Content Changes → Diff API → Diff Service → DiffPreview Component → User Interface
```

## API Reference

### Diff Service Functions

#### `calculateDiff(currentContent, previousContent, titleChange?): Promise<DiffResult>`
Main diff calculation function with caching and server/client compatibility. Supports title changes with special handling.

**Returns:**
```typescript
interface DiffResult {
  added: number;           // Characters added
  removed: number;         // Characters removed
  operations: DiffOperation[]; // Detailed change operations
  preview: DiffPreview | null; // UI preview data
  hasChanges: boolean;     // Whether meaningful changes exist
}
```

#### `diff(currentContent, previousContent): Promise<{added: number, removed: number}>`
Simplified function for getting just the character counts.

#### `getDiffPreview(currentContent, previousContent): Promise<DiffPreview | null>`
Get preview data for UI display.

### DiffPreview Interface

```typescript
interface DiffPreview {
  beforeContext: string;   // Text before changes
  addedText: string;       // Text that was added
  removedText: string;     // Text that was removed
  afterContext: string;    // Text after changes
  hasAdditions: boolean;   // Whether additions exist
  hasRemovals: boolean;    // Whether removals exist
}
```

## UI Components

### DiffPreview Component

Displays diff previews with consistent styling across the application.

**Props:**
- `currentContent` - Current version content
- `previousContent` - Previous version content
- `textDiff` - Pre-calculated diff data (optional)
- `isNewPage` - Whether this is a new page creation
- `expandedContext` - Show more context lines (default: false)
- `className` - Additional CSS classes

**Styling Standards:**
- **Additions**: Green background (`bg-green-50 dark:bg-green-900/40`)
- **Removals**: Red background with strikethrough (`bg-red-50 dark:bg-red-900/40`)
- **Context**: Muted text color for surrounding content
- **Line Clamp**: 3 lines default, 6 lines with `expandedContext={true}`

### DiffStats Component

Shows numerical diff statistics with tooltips.

**Props:**
- `added` - Number of characters added
- `removed` - Number of characters removed
- `isNewPage` - Whether this is a new page creation
- `showTooltips` - Enable hover tooltips (default: true)

## Special Content Types

### Title Changes

Title changes receive special handling to provide clear, meaningful diff displays:

**API Support:**
```typescript
// Title change diff calculation
const titleDiff = await calculateDiff(null, null, {
  oldTitle: "Old Page Title",
  newTitle: "New Page Title"
});
```

**Display Format:**
- **Prefix**: "Title: " appears before the diff content
- **Styling**: Title prefix uses `text-foreground font-medium` for emphasis
- **Context**: No ellipsis before "Title: " prefix for clean display

**Integration Points:**
- **Page Save API**: Automatically creates title change versions
- **Recent Edits**: Title changes appear in activity feeds
- **Versions Page**: Title changes show in version history
- **Diff Preview**: Special formatting for title-specific changes

**Example Output:**
```
Title: New Page Title (old: Old Page Title)
```

## Algorithm Details

### Word-Level Diffing

The system uses word-level diffing for more intelligent change detection:

1. **Text Extraction**: Converts rich content to plain text
2. **Word Tokenization**: Splits text into words and whitespace
3. **LCS Algorithm**: Finds longest common subsequence
4. **Operation Generation**: Creates add/remove/equal operations
5. **Context Generation**: Extracts surrounding text for previews

### Context Generation

For UI previews, the system:
1. Finds the most significant change (largest addition/removal)
2. Extracts 50 characters of context before and after
3. Collects all changes in the context window
4. Trims and formats for display

## Performance Features

### Caching
- **Client-side cache**: 5-minute TTL for repeated calculations
- **Cache key**: Hash of content for efficient lookup
- **Memory management**: Automatic cleanup of expired entries

### Server/Client Compatibility
- **Server-side**: Direct API import for SSR
- **Client-side**: HTTP fetch with caching
- **Fallback**: Simple comparison if API fails

## Usage Examples

### Basic Diff Calculation
```typescript
import { calculateDiff } from '../utils/diffService';

const result = await calculateDiff(currentContent, previousContent);
console.log(`Added: ${result.added}, Removed: ${result.removed}`);
```

### UI Display
```tsx
import DiffPreview from '../components/activity/DiffPreview';

<DiffPreview
  currentContent={current}
  previousContent={previous}
  expandedContext={true}
  className="my-custom-styles"
/>
```

### Simple Stats
```typescript
import { diff } from '../utils/diffService';

const { added, removed } = await diff(current, previous);
```

### Title Change Diff
```typescript
import { calculateDiff } from '../utils/diffService';

// Calculate diff for title change
const titleDiff = await calculateDiff(null, null, {
  oldTitle: "Original Title",
  newTitle: "Updated Title"
});

// Result includes special title formatting
console.log(titleDiff.preview.beforeContext); // "Title: "
console.log(titleDiff.preview.addedText);     // "Updated Title"
console.log(titleDiff.preview.removedText);   // "Original Title"
```

## Integration Points

### Version System
- Page versions use diff calculation for change summaries
- Version comparisons show detailed diff previews
- Activity cards display diff statistics

### Activity Feeds
- Home page recent edits show diff previews
- User activity shows change summaries
- Group activity includes diff statistics

### Analytics
- Content change tracking uses diff results
- Character count analytics from diff calculations
- Change pattern analysis for insights

## Configuration

### Context Length
- Default: 50 characters before/after changes
- Configurable in `/api/diff/route.ts`
- UI line limits: 3 lines default, 6 lines expanded

### Cache Settings
- TTL: 5 minutes (300,000ms)
- Storage: In-memory Map
- Cleanup: Automatic on access

## Troubleshooting

### Common Issues

1. **Empty Diff Results**: Check content extraction and normalization
2. **Performance Issues**: Verify caching is working correctly
3. **UI Display Problems**: Check DiffPreview props and styling
4. **Server Errors**: Review API logs for calculation failures

### Debug Tools

```typescript
import { getDiffCacheStats, clearDiffCache } from '../utils/diffService';

// Check cache status
console.log(getDiffCacheStats());

// Clear cache for testing
clearDiffCache();
```

## Future Enhancements

- **Semantic Diffing**: Understanding of content structure
- **Visual Diffing**: Side-by-side comparison views
- **Diff Annotations**: Inline comments and explanations
- **Performance Optimization**: WebAssembly for large diffs

## Related Documentation

- [Recent Edits System](./RECENT_EDITS_SYSTEM.md) - Recent activity and diffing
- [Editor Requirements](./EDITOR_REQUIREMENTS.md) - Editor functional requirements
- [Line Based Editor](./LINE_BASED_EDITOR.md) - Line-based implementation
- [Page Data and Versions](./PAGE_DATA_AND_VERSIONS.md) - Version storage
