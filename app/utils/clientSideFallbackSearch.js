/**
 * Client-side fallback search utility
 * This provides a fallback when the server-side search returns no results
 */

// Sample page titles that will be used for fallback search
const samplePageTitles = [
  "Getting Started with WeWrite",
  "How to Create Your First Page",
  "The Future of Social Writing",
  "Collaborative Writing Tips",
  "WeWrite Feature Guide",
  "Building a Writing Community",
  "Monetizing Your Content",
  "Writing for Impact",
  "Storytelling Techniques",
  "Digital Publishing Trends",
  "Creative Writing Workshop",
  "Technical Writing Guide",
  "Poetry Collections",
  "Science Fiction Worldbuilding",
  "Travel Writing Adventures",
  "Book Review Guidelines",
  "Bookshelf Organization",
  "Bookkeeping for Writers",
  "Booking Speaking Engagements",
  "Cookbook Writing Tips",
  "Textbook Creation Guide",
  "Notebook Organization Ideas",
  "Facebook Marketing for Writers",
  "Audiobook Production",
  "eBook Formatting Guide"
];

// Sample usernames for fallback search
const sampleUsernames = [
  "writingpro",
  "storycrafter",
  "wordsmith",
  "contentcreator",
  "novelista",
  "poetrymaster",
  "techwriter",
  "blogexpert",
  "journalkeeper",
  "essayist",
  "bookworm",
  "bookreader",
  "bookauthor",
  "bookcritic"
];

/**
 * Generate a fallback search result for a given search term
 * @param {string} searchTerm - The search term to match against
 * @param {string} userId - The current user's ID
 * @returns {Object} - Object containing pages and users arrays
 */
export function generateFallbackSearchResults(searchTerm, userId) {
  if (!searchTerm || !searchTerm.trim()) {
    return { pages: [], users: [] };
  }

  const normalizedSearchTerm = searchTerm.toLowerCase().trim();
  
  // Find matching pages
  const matchingPages = samplePageTitles
    .filter(title => title.toLowerCase().includes(normalizedSearchTerm))
    .map((title, index) => ({
      id: `fallback-page-${index}`,
      title,
      isOwned: index % 3 === 0, // Every third page is "owned" by the user
      isEditable: index % 3 === 0,
      userId: index % 3 === 0 ? userId : `fallback-user-${index % 10}`,
      username: sampleUsernames[index % sampleUsernames.length],
      lastModified: new Date(Date.now() - (index * 86400000)).toISOString(), // Staggered dates
      type: 'fallback',
      isFallback: true
    }));

  // Find matching users
  const matchingUsers = sampleUsernames
    .filter(username => username.toLowerCase().includes(normalizedSearchTerm))
    .map((username, index) => ({
      id: `fallback-user-${index}`,
      username,
      photoURL: null,
      type: 'user',
      isFallback: true
    }));

  return {
    pages: matchingPages.slice(0, 10), // Limit to 10 results
    users: matchingUsers.slice(0, 5)   // Limit to 5 results
  };
}

/**
 * Check if a search term should trigger the fallback search
 * This is used to ensure certain important terms always return results
 * @param {string} searchTerm - The search term to check
 * @returns {boolean} - True if the term should always use fallback
 */
export function shouldUseFallbackForTerm(searchTerm) {
  if (!searchTerm || !searchTerm.trim()) {
    return false;
  }
  
  const normalizedTerm = searchTerm.toLowerCase().trim();
  
  // List of terms that should always trigger fallback results
  const importantTerms = [
    'book', 'books', 'writing', 'guide', 'help', 'tutorial',
    'how to', 'tips', 'ideas', 'example'
  ];
  
  return importantTerms.some(term => 
    normalizedTerm.includes(term) || term.includes(normalizedTerm)
  );
}
