# WeWrite Consolidated Editor Architecture

## Recent Changes

### 2025-07-14: Major Consolidation - SINGLE SOURCE OF TRUTH ✅
- **CONSOLIDATED ARCHITECTURE**: Merged all editor functionality into a single `Editor.tsx` component
- **ELIMINATED DUPLICATION**: Removed `PageEditor.tsx` wrapper and editing logic from `TextView.tsx`
- **ENHANCED FUNCTIONALITY**: Added complete editing features to line-based editor:
  - Title editing with validation
  - Toolbar with save/cancel/delete buttons
  - Public/private toggle
  - Link editor modal integration
  - Error handling and loading states
- **PILL LINK VISUALIZATION**: Implemented hybrid overlay system for pill links:
  - Textarea remains for text input and cursor positioning
  - Pill link overlay displays proper styling when line contains links
  - Transparent textarea text with visible cursor for editing
- **SIMPLIFIED USAGE**: All editing now uses single `Editor` component instead of multiple components
- **PRESERVED FUNCTIONALITY**: All line-based editing features maintained (paragraph numbering, drag/drop, etc.)
- **CLEAN CODEBASE**: Removed redundant `ActionButtons.tsx` and simplified `TextView.tsx` to viewing only

## Previous Changes

### 2025-07-12: Simplified Visual Layout - FINAL SOLUTION ✅
- **FOUND THE ROOT CAUSE**: Visual container was created by PageEditor wrapper div with Tailwind classes:
  - `border border-primary/30` (border)
  - `rounded-lg` (rounded corners)
  - `p-4 md:p-6` (padding)
  - `focus-within:ring-2 focus-within:ring-primary/20` (focus ring)
  - `hover:border-primary/40` (hover border)
- **SOLUTION**: Removed ALL visual styling classes, kept only `w-full max-w-none px-4 py-2` for layout
- **RESULT**: Clean editor layout with subtle padding - no visual container, just breathing room
- **CLEAN CODEBASE**: Removed unnecessary CSS overrides and conflicting rules
- **CONSISTENT**: Works on both new pages (`/new`) and existing pages (`/[pageId]`) in edit mode
- **MAINTAINED FUNCTIONALITY**: All editor features (drag/drop, focus, line numbers) work perfectly
- **IMPROVED UX**: Title placeholder text is now lighter (`text-muted-foreground`) and contextual:
  - New pages: "Give your page a title..."
  - New replies: "Give your reply a title..."

## Overview

The WeWrite Editor is a consolidated, line-based editing solution that combines reliable textarea-based input with beautiful pill link visualization. This architecture eliminates cursor positioning issues while providing a rich editing experience with proper pill link display.

### Key Features

- **Single Source of Truth**: One `Editor.tsx` component handles all editing scenarios
- **Line-Based Architecture**: Each paragraph is a separate textarea with numbered lines
- **Pill Link Visualization**: Hybrid overlay system shows pill links while preserving textarea input
- **Complete Editing Suite**: Built-in title editing, toolbar, and link insertion
- **Preserved Functionality**: All original line-based features (drag/drop, paragraph numbering)
- **Clean Separation**: `TextView.tsx` handles viewing only, `Editor.tsx` handles editing only

## Core Architecture

### Concept
Instead of using a single contentEditable div with paragraph numbers inserted as DOM elements, each paragraph becomes its own separate contentEditable div with paragraph numbers rendered in a completely separate gutter area.

### Benefits
- **Zero cursor interference**: Paragraph numbers are outside editable areas
- **Natural browser behavior**: Each line behaves like a normal contentEditable element  
- **Full data compatibility**: Uses identical Slate.js data structure
- **Easy migration**: Existing content works without modification
- **Better UX**: Clear visual separation between numbers and content
- **Maintainable code**: Much simpler without complex cursor manipulation

## File Structure

```
app/components/editor/
├── Editor.tsx                   # Main unified editor component
├── PageEditor.tsx               # Updated to use Editor
├── ReplyContent.js              # Updated to use Editor
├── TextView.tsx                 # Read-only content display
└── [other editor utilities]     # Supporting components

docs/
└── LINE_BASED_EDITOR.md         # This documentation
```

## Data Compatibility

### Simple Content Structure
The line-based editor uses a simplified content structure that's compatible with our existing editor format:

```typescript
interface TextNode {
  text: string;
}

interface ElementNode {
  type: string;
  children: (TextNode | ElementNode)[];
  // Link-specific properties
  pageId?: string;
  userId?: string;
  url?: string;
  authorUsername?: string;
}

type ContentNode = TextNode | ElementNode;
```

### Migration Path
1. **Existing content**: Works immediately without modification
2. **API compatibility**: Same input/output format as current editor
3. **Feature parity**: All links, formatting, and functionality preserved
4. **Gradual rollout**: Can be deployed alongside existing editor

## Component API

### Editor Props
```typescript
interface EditorProps {
  content: ContentNode[];          // Simple content structure
  onChange: (content: ContentNode[]) => void;  // Content change callback
  readOnly?: boolean;              // Read-only mode toggle
  placeholder?: string;            // Placeholder text for new lines
}
```

### Usage Example
```tsx
import Editor from '@/components/editor/Editor';

function MyPageEditor() {
  const [content, setContent] = useState<ContentNode[]>(initialContent);
  const [title, setTitle] = useState<string>("");
  const [isPublic, setIsPublic] = useState<boolean>(true);

  const handleSave = () => {
    // Save logic here
    console.log('Saving:', { title, content, isPublic });
  };

  return (
    <Editor
      // Content editing
      initialContent={content}
      onChange={setContent}
      placeholder="Start typing..."

      // Complete editing features
      title={title}
      setTitle={setTitle}
      isPublic={isPublic}
      setIsPublic={setIsPublic}
      onSave={handleSave}
      onCancel={() => console.log('Cancelled')}
      showToolbar={true}

      // Optional features
      location={null}
      setLocation={null}
      onDelete={null}
      isSaving={false}
      error=""
    />
  );
}
```

## Key Features

### 1. Paragraph Numbering
- **Gutter-based**: Numbers rendered in separate column outside editable area
- **Auto-updating**: Numbers automatically update as lines are added/removed
- **Non-interactive**: Numbers cannot be selected, edited, or interfere with cursor
- **Responsive**: Numbers adjust to content changes in real-time

### 2. Line Management
- **Individual editing**: Each paragraph is its own textarea element
- **Auto-resize**: Lines expand vertically based on content length
- **Enter key**: Creates new line immediately after current line
- **Drag and drop**: Click and drag lines to reorder with auto-renumbering
- **Dense mode**: Bible verse style with inline paragraph numbers
- **Normal mode**: Separate paragraph numbers with drag handles

### 3. Link Support
- **Full compatibility**: All existing link types (page, user, external) supported
- **Visual styling**: Links maintain their pill-style appearance
- **Editing**: Links can be edited within their respective lines
- **Data preservation**: Link metadata fully preserved in Slate.js structure

### 4. Read-Only Mode
- **Clean display**: Read-only mode shows content without editing affordances
- **Paragraph numbers**: Still visible in read-only mode
- **Performance**: Optimized rendering for display-only content

## Technical Implementation

### DOM Structure
```html
<!-- Minimal container for CSS classes only -->
<div class="page-editor-stable box-border">
  <div class="editor-line-object">
    <div class="line-content" contenteditable="true">
      ⋮⋮ 1 Line content here...
    </div>
  </div>
  <!-- Repeat for each line -->
</div>
```

### Event Handling
- **Input events**: Capture content changes per line
- **Keyboard navigation**: Handle Enter, Backspace, Arrow keys
- **Focus management**: Automatic focus transitions between lines
- **Content sync**: Real-time synchronization with editor data structure

### CSS Architecture
- **Inline layout**: Paragraph numbers as first element in each line
- **Baseline alignment**: Numbers and text align naturally on the same line
- **Focus highlighting**: Soft accent color background when line has focus
- **Responsive design**: Text wraps naturally after paragraph numbers
- **Hover states**: Visual feedback for interactive elements

## Testing

### Integration Testing
The line-based editor is now integrated into the normal page editing flow:
- Visit `/new` to create a new page with the line-based editor
- Edit any existing page to test the editor in edit mode
- All existing pages work seamlessly with the new editor

### Test Scenarios
1. **Basic editing**: Type in lines, create new paragraphs
2. **Auto-resize**: Type long content and watch lines expand
3. **Enter behavior**: Press Enter to create new lines after current line
4. **Drag and drop**: Drag lines to reorder and verify auto-renumbering
5. **Dense mode**: Toggle dense mode to see bible verse style layout
6. **Normal mode**: Toggle normal mode to see separate paragraph numbers
7. **Page creation**: Create new pages with multiple paragraphs
8. **Page editing**: Edit existing pages and verify content preservation
9. **Data integrity**: Verify content structure is maintained

## Performance Considerations

### Optimizations
- **Minimal re-renders**: Only affected lines re-render on changes
- **Efficient DOM updates**: Direct manipulation of line content
- **Memory management**: Proper cleanup of event listeners and refs
- **Lazy loading**: Future enhancement for very long documents

### Scalability
- **Large documents**: Handles hundreds of paragraphs efficiently
- **Real-time updates**: Smooth performance during rapid typing
- **Memory usage**: Minimal overhead compared to single contentEditable

## Future Enhancements

### Planned Features
1. **Rich text formatting**: Bold, italic, underline within lines
2. **Drag and drop**: Reorder lines by dragging paragraph numbers
3. **Line selection**: Multi-line selection and operations
4. **Collaborative editing**: Real-time collaboration support
5. **Undo/redo**: Comprehensive history management
6. **Accessibility**: Enhanced screen reader support

### Integration Points
- **Search functionality**: Search across all lines
- **Export options**: PDF, Markdown, HTML export
- **Import support**: Import from various formats
- **Plugin system**: Extensible architecture for custom features

## Migration Guide

### From Legacy Editors
1. **Component replacement**: Replace any old editor components with unified `Editor`
2. **Props mapping**: Same props interface, no changes needed
3. **Styling updates**: Include new CSS classes
4. **Testing**: Verify functionality with existing content
5. **Gradual rollout**: Deploy to subset of users first

### Rollback Plan
- **Dual support**: Both editors can coexist during transition
- **Feature flags**: Toggle between editors per user/page
- **Data compatibility**: No data migration needed for rollback
- **Quick switch**: Instant fallback to original editor if needed

## Conclusion

The Line-Based Editor represents a fundamental improvement in contentEditable architecture, solving long-standing cursor positioning issues while maintaining full backward compatibility. Its clean separation of concerns and natural browser behavior make it both more reliable and easier to maintain than traditional approaches.
