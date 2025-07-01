/**
 * Search utilities for WeWrite application
 * Enhanced with word boundary prioritization for better search results
 */

/**
 * Helper function to check if a term appears as a complete word (word boundary)
 * This is used throughout the search utilities for prioritizing complete word matches
 *
 * @param text - The text to search in
 * @param term - The term to search for
 * @returns True if the term appears as a complete word
 */
const isCompleteWordMatch = (text: string, term: string): boolean => {
  // Create regex with word boundaries (\b) to match complete words only
  const wordBoundaryRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return wordBoundaryRegex.test(text);
};

/**
 * Calculate a match score for a search result with enhanced word boundary prioritization
 *
 * @param title - The title of the item
 * @param searchTerm - The search term
 * @param isContentMatch - Whether this is a content match (vs title match)
 * @returns A score between 0 and 100, where 100 is a perfect match
 */
export const calculateMatchScore = (title: string, searchTerm: string, isContentMatch: boolean = false): number => {
  if (!title || !searchTerm) return 0;

  const normalizedTitle = title.toLowerCase();
  const normalizedSearchTerm = searchTerm.toLowerCase().trim();

  // Helper function to apply content match penalty
  const applyContentPenalty = (score: number): number => {
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

  // ENHANCED: Check for complete word boundary matches first (highest priority)
  // This prioritizes "ui" as a complete word in "High Density UI" over "ui" in "build"
  if (isCompleteWordMatch(normalizedTitle, normalizedSearchTerm)) {
    return applyContentPenalty(93);
  }

  // Check for sequential word matches (high priority for multi-word searches)
  // This helps with cases like "research topics" matching "research"
  if (normalizedTitle.includes(normalizedSearchTerm)) {
    // Check if this is a word boundary match within the sequence
    if (isCompleteWordMatch(normalizedTitle, normalizedSearchTerm)) {
      return applyContentPenalty(92);
    } else {
      // Lower score for partial matches within words
      return applyContentPenalty(88);
    }
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

  // ENHANCED: Check if title contains the search term as a complete word (word boundary)
  // This is higher priority than partial word matches
  if (titleWords.includes(normalizedSearchTerm)) {
    return applyContentPenalty(82);
  }

  // ENHANCED: Check for word boundary matches in individual words
  // This prioritizes complete word matches over partial matches
  for (const word of titleWords) {
    if (isCompleteWordMatch(word, normalizedSearchTerm)) {
      return applyContentPenalty(80);
    }
  }

  // Check for fuzzy matches - this helps with cases like "road" matching "roadmap"
  // Check if search term is a substring of any word in the title
  // ENHANCED: Lower priority for partial word matches
  for (const word of titleWords) {
    if (word.includes(normalizedSearchTerm)) {
      // Lower score for partial word matches to prioritize complete word matches
      return applyContentPenalty(75);
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
 * Match result interface
 */
interface MatchResult {
  match: boolean;
  type: string;
}

/**
 * Check if a title contains all words in a search term, with priority for sequential matches
 *
 * @param title - The title to check
 * @param searchTerm - The search term
 * @param isContentMatch - Whether this is a content match (vs title match)
 * @returns Result object with match status and match type
 */
export const containsAllSearchWords = (title: string, searchTerm: string, isContentMatch: boolean = false): MatchResult => {
  if (!title || !searchTerm) return { match: false, type: 'none' };

  const normalizedTitle = title.toLowerCase();
  const normalizedSearchTerm = searchTerm.toLowerCase().trim();
  const searchWords = normalizedSearchTerm.split(/\s+/).filter(word => word.length > 0);
  const titleWords = normalizedTitle.split(/\s+/);

  // Helper function to get match type with content prefix if needed
  const getMatchType = (baseType) => {
    return isContentMatch ? `content_${baseType}` : baseType;
  };

  // First priority: Check for exact sequential match of the entire search term
  if (normalizedTitle.includes(normalizedSearchTerm)) {
    // ENHANCED: Check if this is a word boundary match (higher priority)
    if (isCompleteWordMatch(normalizedTitle, normalizedSearchTerm)) {
      return { match: true, type: getMatchType('sequential_exact_word_boundary') };
    } else {
      return { match: true, type: getMatchType('sequential_exact') };
    }
  }

  // Special case for single-word search terms: Prioritize complete word matches
  if (searchWords.length === 1 && searchWords[0].length >= 2) {
    // ENHANCED: First check for exact word boundary matches (highest priority)
    if (isCompleteWordMatch(normalizedTitle, searchWords[0])) {
      return { match: true, type: getMatchType('complete_word_boundary') };
    }

    // Then check if any word in the title starts with the search term
    for (const titleWord of titleWords) {
      if (titleWord.startsWith(searchWords[0])) {
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
        return { match: true, type: getMatchType('partial_word') };
      }
    }

    // Also check if the search word is a prefix of any title word
    // This helps with cases like "res" matching "research"
    for (const titleWord of titleWords) {
      if (titleWord.startsWith(searchWords[0])) {
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
        return { match: true, type: getMatchType('sequential_words') };
      }
    }
  }

  // Third priority: Check if all search words are in the title (regardless of order)
  const allWordsFound = searchWords.every(word => {
    // Check if the word is directly included in the title
    if (normalizedTitle.includes(word)) {
      return true;
    }

    // Check if the word is part of any word in the title
    const foundInWord = titleWords.some(titleWord => titleWord.includes(word));
    if (foundInWord) {
      return true;
    }

    // If we get here, the word wasn't found in any form
    return false;
  });

  if (allWordsFound) {
    return { match: true, type: getMatchType('all_words') };
  }

  return { match: false, type: 'none' };
};

/**
 * Editor content node interface
 */
interface EditorNode {
  text?: string;
  children?: EditorNode[];
  [key: string]: any;
}

/**
 * Extract plain text from editor content structure
 *
 * @param nodes - Editor content nodes
 * @returns Plain text extracted from the content
 */
export const extractTextFromEditorContent = (nodes: EditorNode[]): string => {
  let text = '';
  if (!nodes || !Array.isArray(nodes)) return text;

  for (const node of nodes) {
    if (typeof node.text === 'string') {
      text += node.text + ' ';
    } else if (node.children && Array.isArray(node.children)) {
      text += extractTextFromEditorContent(node.children) + ' ';
    }
  }
  return text;
};

// Compatibility alias for existing code
export const extractTextFromSlateContent = extractTextFromEditorContent;

/**
 * Search result interface
 */
interface SearchResult {
  title?: string;
  name?: string;
  matchScore?: number;
  matchType?: string;
  isContentMatch?: boolean;
  containsAllSearchWords?: boolean;
  _searchDebug?: any;
  [key: string]: any;
}

export const sortSearchResultsByScore = (results: SearchResult[], searchTerm: string): SearchResult[] => {
  if (!results || !Array.isArray(results)) {
    return [];
  }

  if (!searchTerm) {
    return [...results];
  }

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
    // First prioritize by match type (word boundary matches have highest priority)
    const matchTypeOrder = {
      // ENHANCED: Word boundary matches get highest priority
      'sequential_exact_word_boundary': 0,
      'complete_word_boundary': 1,
      'sequential_exact': 2,
      'sequential_exact_words': 3,
      'sequential_partial_words': 4,
      'sequential_text': 5,
      'sequential_words': 6,
      'word_start': 7,
      'prefix_match': 8,
      'partial_word': 9,
      'partial_word_match': 10, // Flexible matching type
      'all_words': 11,
      // Content matches are lower priority than title matches
      'content_sequential_exact_word_boundary': 12,
      'content_complete_word_boundary': 13,
      'content_sequential_exact': 14,
      'content_sequential_exact_words': 15,
      'content_sequential_partial_words': 16,
      'content_sequential_text': 17,
      'content_sequential_words': 18,
      'content_word_start': 19,
      'content_prefix_match': 20,
      'content_partial_word': 21,
      'content_all_words': 22,
      'none': 23
    };

    const aTypeOrder = matchTypeOrder[a.matchType] || 23; // Default to 'none' if type not found
    const bTypeOrder = matchTypeOrder[b.matchType] || 23;

    if (aTypeOrder !== bTypeOrder) {
      return aTypeOrder - bTypeOrder;
    }

    // Then sort by match score
    return b.matchScore - a.matchScore;
  });

  return sortedResults;
};