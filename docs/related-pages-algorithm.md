# Enhanced Related Pages Algorithm

## Overview

The Related Pages algorithm has been completely redesigned to match the effectiveness of the main search functionality. This document explains the improvements, algorithm details, and performance considerations.

## Key Improvements

### 1. **Comprehensive Content Analysis**
- **Before**: Only analyzed words from the current page title
- **After**: Analyzes both title AND content from the current page
- **Impact**: Much richer source material for finding related content

### 2. **Advanced Word Processing**
- **Before**: Basic stemming with limited stop words (30 words)
- **After**: Advanced stemming with comprehensive stop words (50+ words)
- **Features**:
  - Porter Stemmer-based algorithm
  - Handles plurals, verb forms, adjectives
  - Filters out articles, prepositions, pronouns, auxiliary verbs

### 3. **Partial Word Matching**
- **Before**: Only exact word matches
- **After**: Supports partial matches like the search API
- **Example**: "research" matches "researcher", "researching"

### 4. **Sophisticated Scoring System**
- **Before**: Simple word count
- **After**: Multi-factor relevance scoring
- **Factors**:
  - Exact matches (10 points each)
  - Partial matches (5 points each)
  - Match ratio bonuses
  - Title length similarity
  - Content vs title match penalties

### 5. **Increased Coverage**
- **Before**: Limited to 100 pages
- **After**: Analyzes 500 pages for better coverage
- **Performance**: Optimized with 2000-character content limits

## Algorithm Details

### Word Extraction Process

```javascript
// 1. Text normalization
text.toLowerCase()
  .replace(/[^\w\s]/g, ' ')  // Remove punctuation
  .replace(/[-_]+/g, ' ')    // Handle hyphens/underscores

// 2. Stop word filtering
.filter(word => !STOP_WORDS.has(word))

// 3. Advanced stemming
.map(word => advancedStem(word))

// 4. Deduplication
.filter((word, index, array) => array.indexOf(word) === index)
```

### Relevance Scoring

```javascript
score = (exactMatches * 10) + (partialMatches * 5)

// Apply bonuses and penalties
if (isContentMatch) score *= 0.6  // Content penalty
if (matchRatio > 0.5) score *= 1.5  // High ratio bonus
if (similarTitleLength) score *= 1.2  // Length bonus
```

### Ranking Criteria (in order)

1. **Match Type**: Title matches before content matches
2. **Relevance Score**: Higher scores first
3. **Exact Matches**: More exact matches first
4. **Match Ratio**: Higher percentage of matched words
5. **Recency**: More recently modified pages first

## Performance Considerations

### Optimizations
- **Content Limit**: Only analyzes first 2000 characters of content
- **Query Limit**: Increased to 500 pages but with efficient processing
- **Caching**: Results cached per page to avoid re-computation
- **Error Handling**: Graceful fallbacks for parsing errors

### Limitations
- Content analysis limited for performance
- Only analyzes public pages
- Requires meaningful words (filters out pure numbers/dates)

## Comparison with Search API

| Feature | Previous Algorithm | Enhanced Algorithm | Search API |
|---------|-------------------|-------------------|------------|
| Content Analysis | Title only | Title + Content | Title + Content |
| Word Processing | Basic | Advanced | Advanced |
| Partial Matching | No | Yes | Yes |
| Scoring System | Simple count | Multi-factor | Multi-factor |
| Query Limit | 100 pages | 500 pages | All pages |
| Stop Words | 30 words | 50+ words | Comprehensive |

## Expected Results

The enhanced algorithm should now:
- Show significantly more relevant results
- Find pages that the previous algorithm missed
- Rank results more accurately by relevance
- Match the effectiveness of the main search functionality
- Provide better user experience with more useful recommendations

## Debugging and Monitoring

The algorithm includes comprehensive logging:
- Source word analysis
- Candidate evaluation details
- Top match summaries with scores
- Performance metrics

Check browser console for detailed logs when viewing pages with Related Pages sections.
