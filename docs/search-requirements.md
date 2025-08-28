# Search Requirements Documentation

## Overview
WeWrite has two main search surfaces that serve different purposes and user contexts.

## Search Surfaces

### 1. Main Search Page (`/search`)
**Purpose**: Comprehensive search across all WeWrite content
**URL**: `/search`
**Users**: All authenticated users

**Requirements**:
- **Input Responsiveness**: Input must be as fast as a normal text input (no lag/blocking)
- **Debouncing**: 300ms delay before API calls to prevent excessive requests
- **Optimistic UI**: Input updates immediately, search results update separately
- **Search Scope**: Pages (titles + content) + Users
- **Results Display**: Grouped by type (Pages, Users) with metadata
- **URL Sync**: Search query reflected in URL (`?q=search+term`)
- **Recent Searches**: Track and display recent search queries
- **Saved Searches**: Allow users to save/pin frequent searches
- **Performance**: Handle large result sets efficiently
- **Context**: Full-featured search with all metadata and content matching

### 2. Link Editor Search
**Purpose**: Quick page selection when adding links in the editor
**Context**: Modal/dropdown within page editor
**Users**: Content creators adding links

**Requirements**:
- **Input Responsiveness**: Instant typing feedback
- **Search Scope**: Pages only (titles primarily)
- **Results Display**: Simple list with page titles and ownership indicators
- **Filtering**: Exclude current page from results
- **Selection**: Click to select and insert link
- **Performance**: Fast, lightweight for editor context
- **Context**: Title-focused search for link insertion

## Technical Requirements

### Performance Standards
- **Input Lag**: < 16ms (60fps) - input should never feel sluggish
- **API Debouncing**: 300ms delay after user stops typing
- **Search Response**: < 500ms for typical queries
- **UI Updates**: Immediate for input, async for results

### Search Behavior
- **Empty Query**: Show recent searches or user's pages
- **Short Queries**: Minimum 1 character for search
- **Long Queries**: Handle up to 100 characters efficiently
- **Special Characters**: Support quotes, spaces, punctuation

### Data Sources
- **Pages**: Firestore collection with title and content indexing
- **Users**: User profiles with username and display name
- **Permissions**: Respect page visibility and user access rights

### Caching Strategy
- **Client-side**: Cache recent search results for 5 minutes
- **Server-side**: Cache common queries for 1 minute
- **Invalidation**: Clear cache on content updates

## Implementation Standards

### State Management
- **Single Source of Truth**: One search hook per surface
- **Optimistic Updates**: UI state separate from API state
- **Error Handling**: Graceful degradation on API failures

### API Design
- **Unified Endpoint**: `/api/search-unified` for all search needs
- **Context Parameter**: Differentiate between search surfaces
- **Pagination**: Support for large result sets
- **Abort Controllers**: Cancel in-flight requests on new searches

### User Experience
- **Loading States**: Show appropriate loading indicators
- **Empty States**: Helpful messages when no results found
- **Error States**: Clear error messages with retry options
- **Keyboard Navigation**: Support arrow keys and enter for selection

## Cleanup Priorities

### Remove/Consolidate
1. **Old Search Component** (`Search.js`) - Replace with unified implementation
2. **Duplicate Hooks** (`useSearchState.ts`) - Use only `useUnifiedSearch`
3. **Old API Routes** (`/api/search`) - Migrate to `/api/search-unified`
4. **Unused Components** (`TotalSearch.tsx`) - Remove if not used

### Simplify
1. **Reduce Debouncing Layers** - Single debounce at hook level
2. **Eliminate setTimeout Chains** - Direct state updates for UI
3. **Streamline State Management** - Separate input state from search state
4. **Optimize Re-renders** - Proper memoization and isolation

## Success Metrics
- **Input Responsiveness**: No user reports of sluggish typing
- **Search Speed**: 95% of searches complete within 500ms
- **User Satisfaction**: Positive feedback on search experience
- **Code Maintainability**: Single search implementation per surface
