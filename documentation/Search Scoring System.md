# Search Scoring System Documentation

## Overview

WeWrite uses a comprehensive search scoring system to rank search results by relevance. The system operates on a **0-100 scale** where higher scores indicate better matches.

## Core Principle

**If a result is irrelevant to the search query, it must score 0.**

This ensures that only relevant results are returned to users, preventing "hallucinations" or random fallback content.

## Scoring Scale (0-100)

### Title Matches (Higher Priority)
- **100**: Exact match (title exactly equals search term)
- **95**: Starts with search term
- **90**: All search words found as complete words
- **85**: Sequential word matches in order
- **80**: Contains all search words (non-sequential)
- **75**: Partial substring match

### Content Matches (Lower Priority)
- **80**: Exact match in content
- **75**: Starts with search term in content
- **70**: All search words found as complete words in content
- **65**: Sequential word matches in content
- **60**: Contains all search words in content (non-sequential)
- **55**: Partial substring match in content

### No Match
- **0**: No relevance to search query (CRITICAL: prevents irrelevant results)

## Implementation Details

### Primary Scoring Function
Located in: `app/api/search-unified/route.js`

```javascript
function calculateSearchScore(text, searchTerm, isTitle = false, isContentMatch = false) {
  if (!text || !searchTerm) return 0;
  
  const normalizedText = text.toLowerCase();
  const normalizedSearch = searchTerm.toLowerCase();
  
  // Exact match (highest score)
  if (normalizedText === normalizedSearch) {
    return isTitle ? 100 : 80;
  }
  
  // ... other scoring logic ...
  
  // CRITICAL: Return 0 for no match (prevents irrelevant results)
  return 0;
}
```

### Match Validation
Results are only included if `matchScore > 0`:

```javascript
matchScore = Math.max(titleScore, contentScore);
isMatch = matchScore > 0; // Only include if score > 0
```

## Recent Fixes

### Issue: Irrelevant Results (Fixed)
**Problem**: Search was returning irrelevant results due to fallback scoring.

**Root Cause**: The scoring function returned a base score of 50 even when no match was found:
```javascript
// OLD (BROKEN) - returned 50 for irrelevant results
const baseScore = Math.max(0, 50 - (isContentMatch ? 20 : 0));
return baseScore;
```

**Fix**: Changed to return 0 for no match:
```javascript
// NEW (FIXED) - returns 0 for irrelevant results
return 0;
```

**Impact**: Eliminates random/irrelevant results from search responses.

### Issue: Missing Usernames (Identified)
**Problem**: Many search results show "Missing username" instead of actual usernames.

**Root Cause**: Search API doesn't populate usernames for page results, relying on frontend fallback logic.

**Status**: Identified, fix pending.

## Search Result Filtering

### Quality Standards
1. **Relevance**: Only results with score > 0 are included
2. **Precision**: No fallback or padding with irrelevant content
3. **Accuracy**: If few results match, show few results (don't hallucinate)

### Empty Search Handling
For empty search queries:
- User pages: Score 50 (base score for browsing)
- Public pages: Score 40 (slightly lower for public content)
- Sorted by recency rather than relevance

## API Endpoints

### Primary Search API
- **Endpoint**: `/api/search-unified`
- **Scoring**: 0-100 scale with strict relevance filtering
- **Usage**: Main search, link editor, add-to-page flows

### Legacy Search API
- **Endpoint**: `/api/search`
- **Scoring**: Boolean matching (isMatch = true/false)
- **Usage**: Fallback for specific use cases

## Best Practices

### For Developers
1. **Never return non-zero scores for irrelevant results**
2. **Always validate matches before scoring**
3. **Use `matchScore > 0` to filter results**
4. **Prefer precision over recall** (better to show fewer relevant results than many irrelevant ones)

### For Search Algorithm Updates
1. **Test with edge cases** (very short queries, special characters)
2. **Verify no fallback scoring** for unmatched content
3. **Ensure consistent scoring** across title and content matches
4. **Document any scoring changes** in this file

## Testing Guidelines

### Manual Testing
1. Search for specific terms and verify all results are relevant
2. Test with queries that should return few/no results
3. Verify no "Missing username" entries in results
4. Check that irrelevant pages don't appear

### Automated Testing
1. Unit tests for scoring function with various inputs
2. Integration tests for search API endpoints
3. Performance tests for large result sets
4. Regression tests for fixed issues

## Troubleshooting

### Common Issues
1. **Irrelevant results**: Check for fallback scoring logic
2. **Missing usernames**: Verify username population in search API
3. **Poor ranking**: Review scoring weights and match types
4. **Performance issues**: Check query limits and indexing

### Debug Tools
- Enable debug logging in search functions
- Use browser dev tools to inspect API responses
- Check search performance metrics in logs

## Related Documentation
- [Search System Migration](./search-system-migration.md)
- [Search Regression Fix Summary](./search-regression-fix-summary.md)
