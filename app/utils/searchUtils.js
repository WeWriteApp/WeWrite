"use client";

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
  const normalizedSearchTerm = searchTerm.toLowerCase();
  
  // Check for exact match (case insensitive)
  if (normalizedTitle === normalizedSearchTerm) {
    return 100;
  }
  
  // Check if title starts with the search term
  if (normalizedTitle.startsWith(normalizedSearchTerm)) {
    return 90;
  }
  
  // Check if title contains the search term as a whole word
  const titleWords = normalizedTitle.split(/\s+/);
  if (titleWords.includes(normalizedSearchTerm)) {
    return 80;
  }
  
  // Calculate percentage of search term that matches
  const searchTermLength = normalizedSearchTerm.length;
  if (normalizedTitle.includes(normalizedSearchTerm)) {
    return 70;
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
  const percentageMatch = (matchCount / searchTermLength) * 100;
  
  // Scale the percentage to a range of 0-60
  return Math.min(60, percentageMatch * 0.6);
};

/**
 * Sort search results by match score
 * 
 * @param {Array} results - Array of search results
 * @param {string} searchTerm - The search term
 * @returns {Array} - Sorted array of search results
 */
export const sortSearchResultsByScore = (results, searchTerm) => {
  return [...results].sort((a, b) => {
    const scoreA = calculateMatchScore(a.title || a.name, searchTerm);
    const scoreB = calculateMatchScore(b.title || b.name, searchTerm);
    
    // Add the score to the result objects for debugging
    a.matchScore = scoreA;
    b.matchScore = scoreB;
    
    // Sort by score (descending)
    return scoreB - scoreA;
  });
};
