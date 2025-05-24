/**
 * Calculate a match score for a search result
 *
 * @param {string} title - The title of the item
 * @param {string} searchTerm - The search term
 * @param {boolean} isContentMatch - Whether this is a content match (vs title match)
 * @returns {number} - A score between 0 and 100, where 100 is a perfect match
 */
export const calculateMatchScore = (title, searchTerm, isContentMatch = false) => {
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
  // This helps with cases like "research topics" matching "research"
  if (normalizedTitle.includes(normalizedSearchTerm)) {
    // Give a very high score for sequential word matches
    return applyContentPenalty(92);
  }

  // Check if the search term appears at the beginning of the title
  // This helps with cases like "research" matching "research topics"
  if (normalizedTitle.startsWith(normalizedSearchTerm + ' ')) {
    return applyContentPenalty(90);
  }

  // Check if any word in the title starts with the search term
  const titleWords = normalizedTitle.split(/\s+/);
  for (const word of titleWords) {
    if (word.startsWith(normalizedSearchTerm)) {
      return applyContentPenalty(85);
    }
  }

  // Check if title contains the search term as a whole word
  if (titleWords.includes(normalizedSearchTerm)) {
    return applyContentPenalty(80);
  }

  // Check for fuzzy matches - this helps with cases like "road" matching "roadmap"
  // Check if search term is a substring of any word in the title
  for (const word of titleWords) {
    if (word.includes(normalizedSearchTerm)) {
      // Give a higher score for partial word matches to improve results for terms like "book"
      return applyContentPenalty(78);
    }
  }

  // Check if any word in the title is a substring of the search term
  // This helps with cases like "roadmap" matching "road"
  for (const word of titleWords) {
    if (normalizedSearchTerm.includes(word) && word.length > 2) {
      return applyContentPenalty(72);
    }
  }

  // Handle multi-word search terms
  const searchTermWords = normalizedSearchTerm.split(/\s+/);
  if (searchTermWords.length > 1) {
    // Check for sequential matches of search term words in the title
    // This helps with cases like "research topics" matching "research"
    let sequentialMatches = 0;
    let maxSequentialMatches = 0;

    // Check each word in the title to see if it starts a sequence
    for (let i = 0; i < titleWords.length; i++) {
      sequentialMatches = 0;
      // Try to match as many sequential words as possible
      for (let j = 0; j < searchTermWords.length && i + j < titleWords.length; j++) {
        if (titleWords[i + j].includes(searchTermWords[j]) ||
            searchTermWords[j].includes(titleWords[i + j])) {
          sequentialMatches++;
        } else {
          break;
        }
      }
      maxSequentialMatches = Math.max(maxSequentialMatches, sequentialMatches);
    }

    // If we found a sequence of matches, give a high score based on the length of the sequence
    if (maxSequentialMatches > 0) {
      const sequenceScore = 70 + (maxSequentialMatches / searchTermWords.length) * 20;
      return applyContentPenalty(Math.min(90, sequenceScore)); // Cap at 90 to keep below exact matches
    }

    // Count how many search term words are found in the title (non-sequential)
    let matchedWords = 0;
    for (const word of searchTermWords) {
      if (word.length > 1 && normalizedTitle.includes(word)) {
        matchedWords++;
      }
    }

    // If all words are found, give a high score
    if (matchedWords === searchTermWords.length) {
      return applyContentPenalty(75); // All words found but not in exact order
    }

    // If some words are found, give a proportional score
    if (matchedWords > 0) {
      return applyContentPenalty(60 + (matchedWords / searchTermWords.length) * 10);
    }
  }

  // Check for partial matches at the beginning of words
  // This helps with cases like "ro" matching "roadmap"
  if (normalizedSearchTerm.length >= 2) {
    for (const word of titleWords) {
      if (word.startsWith(normalizedSearchTerm.substring(0, 2))) {
        // Calculate how much of the search term matches the beginning of the word
        let matchLength = 0;
        while (
          matchLength < normalizedSearchTerm.length &&
          matchLength < word.length &&
          normalizedSearchTerm[matchLength] === word[matchLength]
        ) {
          matchLength++;
        }

        // If we matched at least 2 characters, give a score based on match percentage
        if (matchLength >= 2) {
          const matchPercentage = matchLength / normalizedSearchTerm.length;
          return applyContentPenalty(55 + (matchPercentage * 15)); // Score between 55-70 based on match percentage
        }
      }
    }
  }

  // Check if any word in the title contains the search term
  for (const word of titleWords) {
    if (word.includes(normalizedSearchTerm)) {
      return applyContentPenalty(60);
    }
  }

  // Calculate percentage of characters that match in order
  let matchCount = 0;
  let titleIndex = 0;

  for (let i = 0; i < normalizedSearchTerm.length; i++) {
    const char = normalizedSearchTerm[i];
    let found = false;

    // Look for the character in the remaining part of the title
    while (titleIndex < normalizedTitle.length) {
      if (normalizedTitle[titleIndex] === char) {
        matchCount++;
        titleIndex++;
        found = true;
        break;
      }
      titleIndex++;
    }

    if (!found) {
      break;
    }
  }

  // Calculate percentage of search term that matched
  const percentageMatch = (matchCount / normalizedSearchTerm.length) * 100;

  // Scale the percentage to a range of 0-50
  const finalScore = Math.min(50, percentageMatch * 0.5);

  return applyContentPenalty(finalScore);
};

/**
 * Sort search results by match score
 *
 * @param {Array} results - Array of search results
 * @param {string} searchTerm - The search term
 * @returns {Array} - Sorted array of search results
 */
/**
 * Check if a title contains all words in a search term, with priority for sequential matches
 *
 * @param {string} title - The title to check
 * @param {string} searchTerm - The search term
 * @param {boolean} isContentMatch - Whether this is a content match (vs title match)
 * @returns {Object} - Result object with match status and match type
 */
export const containsAllSearchWords = (title, searchTerm, isContentMatch = false) => {
  if (!title || !searchTerm) return { match: false, type: 'none' };

  const normalizedTitle = title.toLowerCase();
  const normalizedSearchTerm = searchTerm.toLowerCase().trim();
  const searchWords = normalizedSearchTerm.split(/\s+/).filter(word => word.length > 0);
  const titleWords = normalizedTitle.split(/\s+/);

  // Log for debugging
  console.log(`Checking if "${title}" contains all words in "${searchTerm}". Search words: ${JSON.stringify(searchWords)}`);

  // Helper function to get match type with content prefix if needed
  const getMatchType = (baseType) => {
    return isContentMatch ? `content_${baseType}` : baseType;
  };

  // First priority: Check for exact sequential match of the entire search term
  if (normalizedTitle.includes(normalizedSearchTerm)) {
    console.log(`✅ SEQUENTIAL MATCH: "${title}" contains the exact phrase "${searchTerm}"`);
    return { match: true, type: getMatchType('sequential_exact') };
  }

  // Special case for single-word search terms: Check if any word in the title starts with the search term
  // This helps with cases like "research" matching "research topics" or "researcher"
  if (searchWords.length === 1 && searchWords[0].length >= 3) {
    for (const titleWord of titleWords) {
      if (titleWord.startsWith(searchWords[0])) {
        console.log(`✅ WORD START MATCH: "${titleWord}" in "${title}" starts with "${searchWords[0]}"`);
        return { match: true, type: getMatchType('word_start') };
      }
    }
  }

  // Second priority: Check for sequential matches of search words
  // This helps with cases where search term is "research" and title is "research topics"
  if (searchWords.length === 1) {
    // For single-word search terms, check if it's part of any word in the title
    for (const titleWord of titleWords) {
      if (titleWord.includes(searchWords[0])) {
        console.log(`✅ PARTIAL WORD MATCH: "${titleWord}" in "${title}" contains "${searchWords[0]}"`);
        return { match: true, type: getMatchType('partial_word') };
      }
    }

    // Also check if the search word is a prefix of any title word
    // This helps with cases like "res" matching "research"
    for (const titleWord of titleWords) {
      if (titleWord.startsWith(searchWords[0])) {
        console.log(`✅ PREFIX MATCH: "${titleWord}" in "${title}" starts with "${searchWords[0]}"`);
        return { match: true, type: getMatchType('prefix_match') };
      }
    }
  } else {
    // For multi-word search terms, first check if all search words appear in sequence
    // in the normalized title (even if they span across multiple title words)
    let remainingTitle = normalizedTitle;
    let allWordsFoundInSequence = true;

    for (const searchWord of searchWords) {
      const wordIndex = remainingTitle.indexOf(searchWord);
      if (wordIndex === -1) {
        allWordsFoundInSequence = false;
        break;
      }
      // Move forward in the title text
      remainingTitle = remainingTitle.substring(wordIndex + searchWord.length);
    }

    if (allWordsFoundInSequence) {
      console.log(`✅ SEQUENTIAL TEXT MATCH: "${title}" contains all words in "${searchTerm}" in sequence`);
      return { match: true, type: getMatchType('sequential_text') };
    }

    // Check for sequential matches where each search word matches a complete title word
    for (let i = 0; i <= titleWords.length - searchWords.length; i++) {
      // First check for exact sequential matches
      let exactSequentialMatch = true;
      for (let j = 0; j < searchWords.length; j++) {
        if (titleWords[i + j] !== searchWords[j]) {
          exactSequentialMatch = false;
          break;
        }
      }
      if (exactSequentialMatch) {
        console.log(`✅ EXACT SEQUENTIAL WORD MATCH: "${title}" contains the exact words "${searchWords.join(' ')}" in sequence`);
        return { match: true, type: getMatchType('sequential_exact_words') };
      }

      // Then check for partial sequential matches (where words start with search terms)
      let partialSequentialMatch = true;
      for (let j = 0; j < searchWords.length; j++) {
        // Check if this title word starts with the search word
        if (!titleWords[i + j].startsWith(searchWords[j])) {
          partialSequentialMatch = false;
          break;
        }
      }
      if (partialSequentialMatch) {
        console.log(`✅ PARTIAL SEQUENTIAL WORD MATCH: "${title}" contains words starting with "${searchWords.join(' ')}" in sequence`);
        return { match: true, type: getMatchType('sequential_partial_words') };
      }

      // Finally check for inclusive sequential matches (where title words contain search words or vice versa)
      let inclusiveSequentialMatch = true;
      for (let j = 0; j < searchWords.length; j++) {
        // Check if this title word contains the search word or vice versa
        if (!titleWords[i + j].includes(searchWords[j]) && !searchWords[j].includes(titleWords[i + j])) {
          inclusiveSequentialMatch = false;
          break;
        }
      }
      if (inclusiveSequentialMatch) {
        console.log(`✅ INCLUSIVE SEQUENTIAL WORD MATCH: "${title}" contains the words "${searchWords.join(' ')}" in sequence`);
        return { match: true, type: getMatchType('sequential_words') };
      }
    }
  }

  // Third priority: Check if all search words are in the title (regardless of order)
  const allWordsFound = searchWords.every(word => {
    // Check if the word is directly included in the title
    if (normalizedTitle.includes(word)) {
      console.log(`Word "${word}" found directly in title`);
      return true;
    }

    // Check if the word is part of any word in the title
    const foundInWord = titleWords.some(titleWord => titleWord.includes(word));
    if (foundInWord) {
      console.log(`Word "${word}" found as part of a word in title`);
      return true;
    }

    // If we get here, the word wasn't found in any form
    console.log(`Word "${word}" NOT found in title`);
    return false;
  });

  if (allWordsFound) {
    console.log(`✅ ALL WORDS MATCH: "${title}" contains all words in "${searchTerm}" but not in sequence`);
    return { match: true, type: getMatchType('all_words') };
  }

  console.log(`❌ NO MATCH: "${title}" does not contain all words in "${searchTerm}"`);
  return { match: false, type: 'none' };
};

/**
 * Extract plain text from Slate content structure
 *
 * @param {Array} nodes - Slate content nodes
 * @returns {string} - Plain text extracted from the content
 */
export const extractTextFromSlateContent = (nodes) => {
  let text = '';
  if (!nodes || !Array.isArray(nodes)) return text;

  for (const node of nodes) {
    if (typeof node.text === 'string') {
      text += node.text + ' ';
    } else if (node.children && Array.isArray(node.children)) {
      text += extractTextFromSlateContent(node.children) + ' ';
    }
  }
  return text;
};

export const sortSearchResultsByScore = (results, searchTerm) => {
  if (!results || !Array.isArray(results)) {
    console.warn('sortSearchResultsByScore called with invalid results:', results);
    return [];
  }

  if (!searchTerm) {
    console.warn('sortSearchResultsByScore called with empty searchTerm');
    return [...results];
  }

  // Log the original results for debugging
  console.log(`Sorting ${results.length} results for search term: "${searchTerm}"`);

  // First, check if any results contain all search words
  const searchWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(word => word.length > 0);
  const hasMultipleWords = searchWords.length > 1;

  // Pre-process results to add search-related properties
  const processedResults = [...results].map(result => {
    const title = result.title || result.name || '';

    // Determine if this is a content match based on existing matchType or result properties
    const isContentMatch = result.isContentMatch ||
                          (result.matchType && result.matchType.startsWith('content_')) ||
                          false;

    // Use existing matchScore if available (from flexible matching), otherwise calculate
    const score = result.matchScore !== undefined ?
                  result.matchScore :
                  calculateMatchScore(title, searchTerm, isContentMatch);

    // Use existing matchType if available, otherwise determine from word matching
    let matchType = result.matchType;
    let containsAllWords = result.containsAllSearchWords;

    if (!matchType) {
      const wordMatchResult = containsAllSearchWords(title, searchTerm, isContentMatch);
      matchType = wordMatchResult.type;
      containsAllWords = wordMatchResult.match;
    }

    // Add search properties to the result object
    result.matchScore = score;
    result.matchType = matchType;
    result.containsAllSearchWords = containsAllWords;

    // Add debug info
    result._searchDebug = {
      title,
      searchTerm,
      score,
      matchType: matchType,
      containsAllWords: containsAllWords,
      searchWords
    };

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
      'partial_word_match': 8, // New flexible matching type
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

    const aTypeOrder = matchTypeOrder[a.matchType] || 19; // Default to 'none' if type not found
    const bTypeOrder = matchTypeOrder[b.matchType] || 19;

    if (aTypeOrder !== bTypeOrder) {
      return aTypeOrder - bTypeOrder;
    }

    // Then sort by match score
    return b.matchScore - a.matchScore;
  });

  // Log the top 5 results with their scores for debugging
  const topResults = sortedResults.slice(0, 5);
  console.log('Top search results with scores:',
    topResults.map(r => ({
      title: r.title || r.name,
      score: r.matchScore,
      matchType: r.matchType,
      containsAllWords: r.containsAllSearchWords
    }))
  );

  // Log if we didn't find any high-scoring results
  if (topResults.length > 0 && topResults[0].matchScore < 60) {
    console.warn('No high-scoring matches found for:', searchTerm);
  }

  // Log match type statistics
  const matchTypeCounts = sortedResults.reduce((counts, result) => {
    counts[result.matchType] = (counts[result.matchType] || 0) + 1;
    return counts;
  }, {});

  console.log('Match type statistics:', matchTypeCounts);

  return sortedResults;
};
