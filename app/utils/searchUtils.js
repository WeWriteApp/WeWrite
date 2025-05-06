/**
 * Calculate a match score for a search result
 *
 * @param {string} title - The title of the item
 * @param {string} searchTerm - The search term
 * @returns {number} - A score between 0 and 100, where 100 is a perfect match
 */
export const calculateMatchScore = (title, searchTerm) => {
  if (!title || !searchTerm) return 0;

  const normalizedTitle = title.toLowerCase();
  const normalizedSearchTerm = searchTerm.toLowerCase().trim();

  // Check for exact match (case insensitive)
  if (normalizedTitle === normalizedSearchTerm) {
    return 100;
  }

  // Check if title starts with the search term
  if (normalizedTitle.startsWith(normalizedSearchTerm)) {
    return 90;
  }

  // Check if any word in the title starts with the search term
  const titleWords = normalizedTitle.split(/\s+/);
  for (const word of titleWords) {
    if (word.startsWith(normalizedSearchTerm)) {
      return 85;
    }
  }

  // Check if title contains the search term as a substring
  if (normalizedTitle.includes(normalizedSearchTerm)) {
    return 80;
  }

  // Check if title contains the search term as a whole word
  if (titleWords.includes(normalizedSearchTerm)) {
    return 80;
  }

  // Check for fuzzy matches - this helps with cases like "road" matching "roadmap"
  // Check if search term is a substring of any word in the title
  for (const word of titleWords) {
    if (word.includes(normalizedSearchTerm)) {
      return 75;
    }
  }

  // Check if any word in the title is a substring of the search term
  // This helps with cases like "roadmap" matching "road"
  for (const word of titleWords) {
    if (normalizedSearchTerm.includes(word) && word.length > 2) {
      return 72;
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
      return 75; // All words found but not in exact order
    }

    // If some words are found, give a proportional score
    if (matchedWords > 0) {
      return 60 + (matchedWords / searchTermWords.length) * 10;
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
          return 55 + (matchPercentage * 15); // Score between 55-70 based on match percentage
        }
      }
    }
  }

  // Check if any word in the title contains the search term
  for (const word of titleWords) {
    if (word.includes(normalizedSearchTerm)) {
      return 60;
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
  return Math.min(50, percentageMatch * 0.5);
};

/**
 * Sort search results by match score
 *
 * @param {Array} results - Array of search results
 * @param {string} searchTerm - The search term
 * @returns {Array} - Sorted array of search results
 */
/**
 * Check if a title contains all words in a search term, regardless of order
 *
 * @param {string} title - The title to check
 * @param {string} searchTerm - The search term
 * @returns {boolean} - True if the title contains all words in the search term
 */
export const containsAllSearchWords = (title, searchTerm) => {
  if (!title || !searchTerm) return false;

  const normalizedTitle = title.toLowerCase();
  const searchWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(word => word.length > 0);

  // Check if all search words are in the title
  return searchWords.every(word => normalizedTitle.includes(word));
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
    const score = calculateMatchScore(title, searchTerm);
    const containsAllWords = hasMultipleWords ? containsAllSearchWords(title, searchTerm) : false;

    // Add search properties to the result object
    result.matchScore = score;
    result.containsAllSearchWords = containsAllWords;
    result._searchDebug = {
      title,
      searchTerm,
      score,
      containsAllWords,
      searchWords
    };

    return result;
  });

  // Sort the results
  const sortedResults = processedResults.sort((a, b) => {
    // First prioritize results that contain all search words
    if (hasMultipleWords) {
      if (a.containsAllSearchWords && !b.containsAllSearchWords) return -1;
      if (!a.containsAllSearchWords && b.containsAllSearchWords) return 1;
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
      containsAllWords: r.containsAllSearchWords
    }))
  );

  // Log if we didn't find any high-scoring results
  if (topResults.length > 0 && topResults[0].matchScore < 60) {
    console.warn('No high-scoring matches found for:', searchTerm);
  }

  // Log if we have results that contain all search words but with low scores
  if (hasMultipleWords) {
    const containsAllWordsResults = sortedResults.filter(r => r.containsAllSearchWords);
    if (containsAllWordsResults.length > 0) {
      console.log(`Found ${containsAllWordsResults.length} results containing all search words:`,
        containsAllWordsResults.slice(0, 3).map(r => ({
          title: r.title || r.name,
          score: r.matchScore
        }))
      );
    } else {
      console.warn('No results contain all search words:', searchWords);
    }
  }

  return sortedResults;
};
