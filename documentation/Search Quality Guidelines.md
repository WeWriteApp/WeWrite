# Search Quality Guidelines

## Core Principles

### 1. Precision Over Recall
- **Better to show 5 relevant results than 50 irrelevant ones**
- Users prefer accurate, targeted results over comprehensive but noisy results
- Quality trumps quantity in search experience

### 2. Zero Tolerance for Irrelevant Results
- **If a result doesn't match the query, it must score 0**
- No fallback scoring or padding with random content
- Strict relevance filtering prevents "hallucinations"

### 3. Transparent Scoring
- **Scoring must be explainable and consistent**
- Higher scores for better matches (exact > partial > substring)
- Clear hierarchy: title matches > content matches

## Search Quality Standards

### Relevance Requirements
✅ **Must Have**:
- All results must contain the search term (in title or content)
- Results must be ranked by relevance score
- No random or unrelated content

❌ **Must Not Have**:
- Results that don't contain any part of the search query
- Fallback content when few results exist
- Inconsistent scoring between similar matches

### Data Quality Requirements
✅ **Must Have**:
- Valid usernames for all page results
- Complete page titles (no "Untitled" unless actually untitled)
- Proper page metadata (public/private status, ownership)

❌ **Must Not Have**:
- "Missing username" placeholders
- Broken or invalid page references
- Inconsistent data between search and page views

## Implementation Checklist

### For Search Algorithm Changes
- [ ] Test with queries that should return few/no results
- [ ] Verify no fallback scoring for unmatched content
- [ ] Ensure consistent scoring across title and content
- [ ] Test edge cases (very short queries, special characters)
- [ ] Document any scoring changes

### For Search API Updates
- [ ] Populate all required fields (username, title, metadata)
- [ ] Implement proper error handling for missing data
- [ ] Use consistent field names across all endpoints
- [ ] Add logging for debugging data quality issues
- [ ] Test with real production data

### For Frontend Components
- [ ] Handle missing data gracefully (no "Missing username")
- [ ] Implement proper loading states
- [ ] Show clear "no results" messages when appropriate
- [ ] Don't pad empty results with placeholder content
- [ ] Provide helpful search suggestions for no-result queries

## Testing Guidelines

### Manual Testing Scenarios
1. **Specific Term Search**: Search for "protests" - all results should relate to protests
2. **Rare Term Search**: Search for very specific terms - should return few but relevant results
3. **No Results Search**: Search for nonsense terms - should return empty results, not random content
4. **Username Verification**: Check that all results show proper usernames, not "Missing username"
5. **Mixed Content**: Verify both title and content matches appear appropriately ranked

### Automated Testing
```javascript
// Example test for relevance
test('search results must be relevant', async () => {
  const results = await searchAPI('protests');
  
  results.forEach(result => {
    const hasTermInTitle = result.title.toLowerCase().includes('protests');
    const hasTermInContent = result.content?.toLowerCase().includes('protests');
    
    expect(hasTermInTitle || hasTermInContent).toBe(true);
    expect(result.matchScore).toBeGreaterThan(0);
  });
});

// Example test for data quality
test('search results must have valid usernames', async () => {
  const results = await searchAPI('test');
  
  results.forEach(result => {
    expect(result.username).toBeDefined();
    expect(result.username).not.toBe('Missing username');
    expect(result.username).not.toBe('Anonymous');
  });
});
```

## Common Issues and Solutions

### Issue: Irrelevant Results
**Symptoms**: Results that don't contain the search term
**Solution**: Check scoring function for fallback logic, ensure score = 0 for no match

### Issue: Missing Usernames
**Symptoms**: "Missing username" appearing in search results
**Solution**: Populate usernames in search API, don't rely on frontend fallback

### Issue: Poor Ranking
**Symptoms**: Less relevant results appearing before more relevant ones
**Solution**: Review scoring weights, ensure title matches score higher than content

### Issue: Too Few Results
**Symptoms**: Users complain about not finding content they know exists
**Solution**: Check for artificial limits, ensure comprehensive search coverage

### Issue: Too Many Irrelevant Results
**Symptoms**: Users complain about noise in search results
**Solution**: Tighten relevance criteria, increase minimum score threshold

## Monitoring and Metrics

### Key Metrics to Track
- **Result Relevance Rate**: % of results that actually match the query
- **Username Completion Rate**: % of results with valid usernames
- **Search Success Rate**: % of searches that return at least one result
- **User Satisfaction**: Click-through rates on search results

### Quality Alerts
Set up monitoring for:
- High percentage of "Missing username" in results
- Searches returning 0 results for common terms
- Unusual spikes in irrelevant result reports
- Performance degradation in search response times

## Best Practices Summary

### Do ✅
- Return 0 score for irrelevant results
- Populate all required data fields in search API
- Test with edge cases and real user queries
- Document scoring changes and rationale
- Monitor search quality metrics continuously

### Don't ❌
- Use fallback scoring for unmatched content
- Pad results with random content when few matches exist
- Rely on frontend to fix missing backend data
- Make scoring changes without comprehensive testing
- Ignore data quality issues in search results

## Related Documentation
- [Search Scoring System](./Search%20Scoring%20System.md)
- [Search System Migration](./search-system-migration.md)
- [Search Regression Fix Summary](./search-regression-fix-summary.md)
