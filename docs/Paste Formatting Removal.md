# Paste Formatting Removal

## Overview

WeWrite's editor automatically removes formatting when pasting text, similar to using Cmd+Shift+V (paste without formatting), while intelligently preserving links and WeWrite-specific formatting.

## Features

### 1. **Automatic Formatting Removal**
- All rich text formatting (bold, italic, colors, fonts, etc.) is automatically stripped
- Behaves like "Paste and Match Style" (Cmd+Shift+V) by default
- Preserves paragraph structure and line breaks

### 2. **Smart Link Preservation**
- **URLs**: Automatically detected and converted to clickable external links
- **WeWrite Links**: Page links, user links, and other WeWrite-specific formatting is preserved when pasting from other WeWrite pages

### 3. **Content Type Detection**

#### Plain Text
- URLs are automatically converted to clickable links
- Text is inserted as-is with proper paragraph structure

#### Rich HTML Content
- All formatting is stripped except for links
- Text content is extracted and URLs are converted to links
- Paragraph structure is preserved

#### WeWrite Content
- Custom WeWrite formatting is preserved (page links, user links, etc.)
- Maintains the pill-style link appearance
- Preserves link metadata and functionality

## Implementation Details

### Core Components

1. **`pasteHandler.ts`** - Main paste processing logic
2. **Editor.tsx** - Integration with the contentEditable editor
3. **Automatic Detection** - Identifies content type and applies appropriate processing

### Processing Flow

```
Paste Event
    ↓
Detect Content Type
    ↓
┌─────────────────┬─────────────────┬─────────────────┐
│   Plain Text    │   Rich HTML     │ WeWrite Content │
│                 │                 │                 │
│ Convert URLs    │ Strip Formatting│ Preserve Links  │
│ to Links        │ + Convert URLs  │ + Structure     │
└─────────────────┴─────────────────┴─────────────────┘
    ↓
Insert Processed Content
    ↓
Update Editor State
```

### URL Detection

The system uses an enhanced regex pattern to detect URLs:
- Supports HTTP and HTTPS protocols
- Handles ports, paths, query parameters, and fragments
- Automatically cleans trailing punctuation
- Escapes HTML entities for security

### WeWrite Content Detection

WeWrite content is identified by:
- `data-link-type` attributes
- WeWrite-specific CSS classes (`page-link`, `user-link`, `pill-link`)
- Custom link structures

## Usage Examples

### Basic Text Paste
```
Input: "Check out https://example.com for more info"
Output: "Check out [https://example.com](external) for more info"
```

### Rich Text Paste
```
Input: "<strong>Bold text</strong> with <em>italic</em> and https://example.com"
Output: "Bold text with italic and [https://example.com](external)"
```

### WeWrite Content Paste
```
Input: WeWrite page with existing page links and user mentions
Output: Preserves all WeWrite-specific formatting and links
```

## Error Handling

- Graceful fallback to browser default paste behavior on errors
- Console logging for debugging paste processing
- Fallback to `execCommand` for content insertion if modern methods fail

## Browser Compatibility

- Uses modern Clipboard API when available
- Falls back to `execCommand` for older browsers
- Handles various clipboard data formats (HTML, plain text)

## Performance Considerations

- Minimal DOM manipulation during paste processing
- Efficient regex patterns for URL detection
- Lazy evaluation of content type detection
- Error boundaries prevent paste failures from breaking the editor

## Future Enhancements

- Support for additional link types (email, phone numbers)
- Configurable paste behavior per content type
- Enhanced WeWrite content detection
- Paste preview functionality
