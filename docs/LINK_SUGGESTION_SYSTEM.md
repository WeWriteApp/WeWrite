# Link Suggestion System Documentation

## Overview

The Link Suggestion System automatically detects potential links in page content and suggests existing pages that users can link to. It provides a seamless way to create connections between pages without manual searching.

## Architecture

### Core Components

#### 1. Link Suggestion API
**Location**: `app/api/link-suggestions/route.ts`

**Purpose**: Analyzes text and returns matching pages from the database

**Algorithm**:
1. **Text Processing**: Extracts words and phrases from input text
2. **Database Query**: Searches all pages for title matches (no limit for accuracy)
3. **Scoring System**: Ranks matches by confidence level
4. **Response**: Returns top suggestions with confidence scores

**Confidence Scoring**:
- **1.0**: Exact title match (case-insensitive)
- **0.8**: Title contains the search term
- **0.6**: Phrase appears in title
- **0.4**: Word appears in title

#### 2. Link Suggestion Hook
**Location**: `app/hooks/useLinkSuggestions.ts`

**Purpose**: Manages client-side link suggestion state and API calls

**Key Features**:
- Debounced API calls (300ms delay)
- Loading state management
- Error handling
- Suggestion caching

#### 3. Visual Indicators
**Location**: Editor components (TextView, SlateEditor)

**Purpose**: Shows dotted underlines for suggested links

**Implementation**:
- CSS class: `link-suggestion` with `border-bottom: 2px dotted`
- Real-time highlighting as user types
- Hover effects for better UX

### Data Flow

#### 1. Content Analysis
```
User types content
    ↓
Text content extracted
    ↓
API call to /api/link-suggestions
    ↓
Database query for matching pages
    ↓
Confidence scoring applied
    ↓
Top suggestions returned
```

#### 2. Visual Feedback
```
Suggestions received
    ↓
Text parsed for suggestion matches
    ↓
Dotted underlines applied
    ↓
User sees potential links
    ↓
Click to create actual link
```

## API Specification

### Request Format
```typescript
POST /api/link-suggestions
{
  "text": "Algeria is a place in Africa"
}
```

### Response Format
```typescript
{
  "suggestions": [
    {
      "title": "Algeria",
      "confidence": 1.0,
      "pageId": "abc123"
    },
    {
      "title": "Africa", 
      "confidence": 1.0,
      "pageId": "def456"
    }
  ],
  "totalSuggestions": 2
}
```

### Error Handling
- **400**: Invalid request format
- **500**: Database or processing errors
- **Rate Limiting**: Built-in protection against abuse

## Database Integration

### Query Strategy
```javascript
// No limit to ensure all matches are found
const pages = await db.collection('pages')
  .where('isPublic', '==', true)
  .where('deletedAt', '==', null)
  .get();
```

### Performance Considerations
- **Indexing**: Firestore indexes on `isPublic` and `deletedAt`
- **Caching**: Client-side caching of recent suggestions
- **Debouncing**: Prevents excessive API calls

## Matching Algorithm

### Text Processing
1. **Normalization**: Convert to lowercase, remove punctuation
2. **Word Extraction**: Split into individual words
3. **Phrase Generation**: Create 2-4 word phrases
4. **Deduplication**: Remove duplicate terms

### Scoring Logic
```javascript
function calculateConfidence(searchTerm, pageTitle) {
  const normalizedTitle = pageTitle.toLowerCase();
  const normalizedTerm = searchTerm.toLowerCase();
  
  if (normalizedTitle === normalizedTerm) return 1.0;  // Exact match
  if (normalizedTitle.includes(normalizedTerm)) return 0.8;  // Contains
  // Additional scoring logic...
}
```

### Match Types
- **Exact Match**: "Algeria" → "Algeria" (confidence: 1.0)
- **Partial Match**: "place" → "Places" (confidence: 0.8)
- **Word Match**: "africa" → "North Africa Guide" (confidence: 0.6)

## Visual Implementation

### CSS Styling
```css
.link-suggestion {
  border-bottom: 2px dotted hsl(var(--primary));
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.link-suggestion:hover {
  border-bottom-style: solid;
  background-color: hsl(var(--primary) / 0.1);
}
```

### Responsive Design
- **Mobile**: Larger touch targets, clear visual feedback
- **Desktop**: Hover states, precise cursor positioning
- **Accessibility**: Proper ARIA labels, keyboard navigation

## Integration Points

### Editor Components
- **SlateEditor**: Rich text editor with inline suggestions
- **TextView**: Read-only view with suggestion highlighting
- **LineEditor**: Simple line-based editor support

### Page Components
- **PageView**: Main page editing interface
- **Editor**: Wrapper component for all editor types

## Configuration

### API Settings
```javascript
const SUGGESTION_CONFIG = {
  debounceMs: 300,
  maxSuggestions: 10,
  minConfidence: 0.4,
  cacheTimeout: 5 * 60 * 1000 // 5 minutes
};
```

### Feature Flags
- **Enable/Disable**: Global toggle for link suggestions
- **Confidence Threshold**: Minimum confidence for display
- **Rate Limiting**: API call frequency limits

## Performance Metrics

### Current Performance
- **API Response Time**: ~200ms average
- **Database Query**: Scans all public pages
- **Client Processing**: ~50ms for text analysis
- **Memory Usage**: Minimal client-side caching

### Optimization Opportunities
1. **Database Indexing**: Full-text search indexes
2. **Caching Strategy**: Redis cache for common queries
3. **Batch Processing**: Multiple text analysis in single call
4. **CDN Integration**: Cache responses at edge locations

## Testing Strategy

### Unit Tests
- API endpoint functionality
- Confidence scoring algorithm
- Text processing utilities
- Hook state management

### Integration Tests
- End-to-end suggestion flow
- Database query accuracy
- UI interaction testing
- Performance benchmarks

### Manual Testing
- Various text inputs
- Edge cases (special characters, long text)
- Mobile device testing
- Accessibility compliance

## Future Enhancements

### Planned Features
1. **Machine Learning**: Improve scoring with ML models
2. **User Preferences**: Personalized suggestion ranking
3. **Analytics**: Track suggestion usage and accuracy
4. **Bulk Operations**: Suggest multiple links at once

### Technical Improvements
1. **Real-time Updates**: WebSocket for live suggestions
2. **Offline Support**: Cache suggestions for offline use
3. **Internationalization**: Multi-language support
4. **Advanced Parsing**: Better text analysis algorithms

## Troubleshooting

### Common Issues
1. **No suggestions appearing**: Check API connectivity and database access
2. **Incorrect matches**: Review confidence scoring algorithm
3. **Performance issues**: Monitor API response times and database queries
4. **Visual glitches**: Verify CSS styling and responsive design

### Debug Tools
- Browser DevTools Network tab for API calls
- Console logging in suggestion processing
- React DevTools for component state
- Database query analysis tools

### Monitoring
- API response time tracking
- Error rate monitoring
- User engagement metrics
- Database performance metrics
