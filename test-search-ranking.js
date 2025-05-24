#!/usr/bin/env node

/**
 * Test script to verify search ranking improvements
 * This script tests the enhanced search algorithm to ensure title matches
 * are prioritized over content matches.
 */

// Simple test functions to verify our search logic
function calculateMatchScore(title, searchTerm, isContentMatch = false) {
  if (!title || !searchTerm) return 0;

  const normalizedTitle = title.toLowerCase();
  const normalizedSearchTerm = searchTerm.toLowerCase().trim();

  // Helper function to apply content match penalty
  const applyContentPenalty = (score) => {
    if (isContentMatch && score > 0) {
      return Math.max(score - 40, 5);
    }
    return score;
  };

  // Check for exact match (case insensitive)
  if (normalizedTitle === normalizedSearchTerm) {
    return applyContentPenalty(100);
  }

  // Check if title starts with the search term
  if (normalizedTitle.startsWith(normalizedSearchTerm)) {
    return applyContentPenalty(95);
  }

  // Check for sequential word matches (highest priority for multi-word searches)
  if (normalizedTitle.includes(normalizedSearchTerm)) {
    return applyContentPenalty(92);
  }

  // Check if any word in the title starts with the search term
  const titleWords = normalizedTitle.split(/\s+/);
  for (const word of titleWords) {
    if (word.startsWith(normalizedSearchTerm)) {
      return applyContentPenalty(85);
    }
  }

  // Handle multi-word search terms
  const searchTermWords = normalizedSearchTerm.split(/\s+/);
  if (searchTermWords.length > 1) {
    // Count how many search term words are found in the title
    let matchedWords = 0;
    for (const word of searchTermWords) {
      if (word.length > 1 && normalizedTitle.includes(word)) {
        matchedWords++;
      }
    }

    // If all words are found, give a high score
    if (matchedWords === searchTermWords.length) {
      return applyContentPenalty(75);
    }

    // If some words are found, give a proportional score
    if (matchedWords > 0) {
      return applyContentPenalty(60 + (matchedWords / searchTermWords.length) * 10);
    }
  }

  return applyContentPenalty(0);
}

function containsAllSearchWords(title, searchTerm, isContentMatch = false) {
  if (!title || !searchTerm) return { match: false, type: 'none' };

  const normalizedTitle = title.toLowerCase();
  const normalizedSearchTerm = searchTerm.toLowerCase().trim();
  const searchWords = normalizedSearchTerm.split(/\s+/).filter(word => word.length > 0);

  // Helper function to get match type with content prefix if needed
  const getMatchType = (baseType) => {
    return isContentMatch ? `content_${baseType}` : baseType;
  };

  // Check for exact sequential match of the entire search term
  if (normalizedTitle.includes(normalizedSearchTerm)) {
    return { match: true, type: getMatchType('sequential_exact') };
  }

  // For multi-word search terms, check if all words are present
  if (searchWords.length > 1) {
    const allWordsFound = searchWords.every(word => {
      return normalizedTitle.includes(word);
    });

    if (allWordsFound) {
      return { match: true, type: getMatchType('all_words') };
    }
  } else {
    // For single-word search terms, check if it's part of any word in the title
    const titleWords = normalizedTitle.split(/\s+/);
    for (const titleWord of titleWords) {
      if (titleWord.includes(searchWords[0])) {
        return { match: true, type: getMatchType('partial_word') };
      }
    }
  }

  return { match: false, type: 'none' };
}

function sortSearchResultsByScore(results, searchTerm) {
  if (!results || !Array.isArray(results)) {
    return [];
  }

  // Pre-process results to add search-related properties
  const processedResults = [...results].map(result => {
    const title = result.title || result.name || '';
    const isContentMatch = result.isContentMatch || false;

    // Calculate match score
    const score = calculateMatchScore(title, searchTerm, isContentMatch);

    // Determine match type
    const wordMatchResult = containsAllSearchWords(title, searchTerm, isContentMatch);
    const matchType = wordMatchResult.type;
    const containsAllWords = wordMatchResult.match;

    // Add search properties to the result object
    result.matchScore = score;
    result.matchType = matchType;
    result.containsAllSearchWords = containsAllWords;

    return result;
  });

  // Sort the results
  const sortedResults = processedResults.sort((a, b) => {
    // First prioritize by match type (sequential matches first)
    const matchTypeOrder = {
      'sequential_exact': 0,
      'sequential_exact_words': 1,
      'sequential_partial_words': 2,
      'sequential_text': 3,
      'sequential_words': 4,
      'word_start': 5,
      'prefix_match': 6,
      'partial_word': 7,
      'partial_word_match': 8,
      'all_words': 9,
      // Content matches are lower priority than title matches
      'content_sequential_exact': 10,
      'content_sequential_exact_words': 11,
      'content_sequential_partial_words': 12,
      'content_sequential_text': 13,
      'content_sequential_words': 14,
      'content_word_start': 15,
      'content_prefix_match': 16,
      'content_partial_word': 17,
      'content_all_words': 18,
      'none': 19
    };

    const aTypeOrder = matchTypeOrder[a.matchType] || 19;
    const bTypeOrder = matchTypeOrder[b.matchType] || 19;

    if (aTypeOrder !== bTypeOrder) {
      return aTypeOrder - bTypeOrder;
    }

    // Then sort by match score
    return b.matchScore - a.matchScore;
  });

  return sortedResults;
}

// Test data simulating search results
const testResults = [
  {
    id: '1',
    title: 'My Book Lists',
    type: 'page',
    isOwned: true
  },
  {
    id: '2',
    title: 'Books I\'m reading',
    type: 'page',
    isOwned: true
  },
  {
    id: '3',
    title: 'Books to read',
    type: 'page',
    isOwned: true
  },
  {
    id: '4',
    title: 'Reading List Management',
    type: 'page',
    isOwned: false,
    isContentMatch: true // Simulate this being a content match
  },
  {
    id: '5',
    title: 'My Reading Notes',
    type: 'page',
    isOwned: false,
    isContentMatch: true // Simulate this being a content match with "book lists" in content
  }
];

console.log('🧪 Testing Search Ranking Improvements\n');

// Test 1: Calculate match scores for title matches vs content matches
console.log('📊 Test 1: Match Score Calculation');
console.log('=====================================');

const searchTerm = 'book lists';

testResults.forEach(result => {
  const isContentMatch = result.isContentMatch || false;
  const score = calculateMatchScore(result.title, searchTerm, isContentMatch);
  const wordMatch = containsAllSearchWords(result.title, searchTerm, isContentMatch);

  console.log(`Title: "${result.title}"`);
  console.log(`  Content Match: ${isContentMatch}`);
  console.log(`  Score: ${score}`);
  console.log(`  Match Type: ${wordMatch.type}`);
  console.log(`  Contains All Words: ${wordMatch.match}`);
  console.log('');
});

// Test 2: Sort results and verify ranking
console.log('🏆 Test 2: Search Result Ranking');
console.log('=================================');

const sortedResults = sortSearchResultsByScore(testResults, searchTerm);

console.log(`Search term: "${searchTerm}"`);
console.log('Ranked results:');
sortedResults.forEach((result, index) => {
  console.log(`${index + 1}. "${result.title}" (Score: ${result.matchScore}, Type: ${result.matchType})`);
});

// Test 3: Verify title matches come before content matches
console.log('\n✅ Test 3: Verification');
console.log('=======================');

const titleMatches = sortedResults.filter(r => !r.isContentMatch);
const contentMatches = sortedResults.filter(r => r.isContentMatch);

console.log(`Title matches: ${titleMatches.length}`);
console.log(`Content matches: ${contentMatches.length}`);

if (titleMatches.length > 0 && contentMatches.length > 0) {
  const highestTitleScore = Math.max(...titleMatches.map(r => r.matchScore));
  const highestContentScore = Math.max(...contentMatches.map(r => r.matchScore));

  console.log(`Highest title match score: ${highestTitleScore}`);
  console.log(`Highest content match score: ${highestContentScore}`);

  if (highestTitleScore > highestContentScore) {
    console.log('✅ SUCCESS: Title matches have higher scores than content matches');
  } else {
    console.log('❌ FAILURE: Content matches have higher or equal scores to title matches');
  }
} else {
  console.log('ℹ️  Cannot compare - need both title and content matches for comparison');
}

// Test 4: Test specific "My Book Lists" case
console.log('\n📚 Test 4: "My Book Lists" Specific Test');
console.log('=========================================');

const bookListsResult = testResults.find(r => r.title === 'My Book Lists');
if (bookListsResult) {
  const score = calculateMatchScore(bookListsResult.title, 'book lists');
  const wordMatch = containsAllSearchWords(bookListsResult.title, 'book lists');

  console.log(`Title: "${bookListsResult.title}"`);
  console.log(`Search: "book lists"`);
  console.log(`Score: ${score}`);
  console.log(`Match Type: ${wordMatch.type}`);
  console.log(`Should Match: ${wordMatch.match ? 'YES' : 'NO'}`);

  if (wordMatch.match && score > 70) {
    console.log('✅ SUCCESS: "My Book Lists" should be found with high score');
  } else {
    console.log('❌ FAILURE: "My Book Lists" not matching properly');
  }
} else {
  console.log('❌ Test data missing "My Book Lists" entry');
}

console.log('\n🎯 Test Complete!');
