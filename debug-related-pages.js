#!/usr/bin/env node

/**
 * Debug script to test the related pages algorithm
 */

console.log('🔍 Debugging improved related pages algorithm...');

// Simple stemming function to handle common word variations
function simpleStem(word) {
  // Handle common plural forms
  if (word.endsWith('ies') && word.length > 4) {
    return word.slice(0, -3) + 'y'; // stories -> story
  }
  if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) {
    return word.slice(0, -1); // pages -> page, but not class -> clas
  }
  // Handle common verb forms
  if (word.endsWith('ing') && word.length > 5) {
    return word.slice(0, -3); // writing -> writ
  }
  if (word.endsWith('ed') && word.length > 4) {
    return word.slice(0, -2); // created -> creat
  }
  return word;
}

// Process words with improved cleaning and stemming
function processWords(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
    .split(/\s+/)
    .filter(word => word.length >= 2) // Include words of at least 2 characters
    .filter(word => !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'to', 'of', 'in', 'on', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could'].includes(word))
    .map(word => simpleStem(word)); // Apply stemming
}

// Test the word filtering logic
function testWordFiltering() {
  console.log('\n1. Testing word filtering logic...');

  const testTitles = [
    "My Story",
    "A Short Story",
    "Story of My Life",
    "The Story Continues",
    "Another Story About Love",
    "Story Time",
    "My Adventure Story"
  ];

  testTitles.forEach(title => {
    const titleWords = processWords(title);
    console.log(`"${title}" → [${titleWords.join(', ')}]`);
  });
}

// Test the matching logic
function testMatchingLogic() {
  console.log('\n2. Testing matching logic...');

  const currentPageTitle = "My Story";
  const currentTitleWords = processWords(currentPageTitle);

  console.log(`Current page: "${currentPageTitle}" → [${currentTitleWords.join(', ')}]`);

  const testPages = [
    { id: '1', title: "A Short Story" },
    { id: '2', title: "Story of My Life" },
    { id: '3', title: "The Story Continues" },
    { id: '4', title: "Another Story About Love" },
    { id: '5', title: "Story Time" },
    { id: '6', title: "My Adventure Story" },
    { id: '7', title: "Random Page" },
    { id: '8', title: "About Me" }
  ];

  const matchingPages = [];

  testPages.forEach(pageData => {
    const pageTitleWords = processWords(pageData.title);

    // Find exact word matches
    const exactMatches = currentTitleWords.filter(word =>
      pageTitleWords.includes(word)
    );

    // Calculate base match score from individual word matches
    let matchScore = exactMatches.length;

    // Check for consecutive word matches (phrases)
    let maxConsecutiveMatches = 0;

    // Convert title words to string for easier comparison
    const titleString = currentTitleWords.join(' ');
    const pageTitleString = pageTitleWords.join(' ');

    // Find the longest matching phrase by checking all possible substrings
    for (let i = 0; i < currentTitleWords.length - 1; i++) {
      for (let j = i + 2; j <= currentTitleWords.length; j++) {
        const phrase = currentTitleWords.slice(i, j).join(' ');
        // Only consider phrases with at least 2 words
        if (phrase.split(' ').length >= 2 && pageTitleString.includes(phrase)) {
          // Count the number of words in the phrase
          const wordCount = phrase.split(' ').length;
          if (wordCount > maxConsecutiveMatches) {
            maxConsecutiveMatches = wordCount;
          }
        }
      }
    }

    // Add bonus points for consecutive matches (3x per word)
    const consecutiveMatchBonus = maxConsecutiveMatches > 1 ? maxConsecutiveMatches * 3 : 0;

    // Calculate total score (individual matches + consecutive bonus)
    const totalScore = matchScore + consecutiveMatchBonus;

    console.log(`"${pageData.title}"`);
    console.log(`  Words: [${pageTitleWords.join(', ')}]`);
    console.log(`  Exact matches: [${exactMatches.join(', ')}] (${exactMatches.length})`);
    console.log(`  Consecutive matches: ${maxConsecutiveMatches} words`);
    console.log(`  Total score: ${totalScore}`);
    console.log(`  Would be included: ${totalScore > 0 ? 'YES' : 'NO'}`);
    console.log('');

    // Only include pages with at least one match
    if (totalScore > 0) {
      matchingPages.push({
        ...pageData,
        matchCount: totalScore,
        hasConsecutiveMatches: maxConsecutiveMatches > 1,
        consecutiveMatchCount: maxConsecutiveMatches
      });
    }
  });

  // Sort by match count
  const sortedPages = matchingPages.sort((a, b) => b.matchCount - a.matchCount);

  console.log('Final sorted results:');
  sortedPages.forEach((page, index) => {
    console.log(`${index + 1}. "${page.title}" (score: ${page.matchCount})`);
  });
}

// Test edge cases
function testEdgeCases() {
  console.log('\n3. Testing edge cases...');

  // Test with punctuation
  const testCases = [
    { current: "My Story!", test: "A Story" },
    { current: "Story-Time", test: "Story Time" },
    { current: "The Story", test: "Story" },
    { current: "story", test: "Story" }, // Case sensitivity
    { current: "Stories", test: "Story" }, // Plural vs singular
  ];

  testCases.forEach(({ current, test }) => {
    const currentWords = processWords(current);
    const testWords = processWords(test);

    const exactMatches = currentWords.filter(word => testWords.includes(word));

    console.log(`"${current}" vs "${test}"`);
    console.log(`  Current words: [${currentWords.join(', ')}]`);
    console.log(`  Test words: [${testWords.join(', ')}]`);
    console.log(`  Matches: [${exactMatches.join(', ')}] (${exactMatches.length})`);
    console.log(`  Would match: ${exactMatches.length > 0 ? 'YES' : 'NO'}`);
    console.log('');
  });
}

// Run all tests
testWordFiltering();
testMatchingLogic();
testEdgeCases();

console.log('\n🎉 Debug tests completed!');
console.log('\n📝 Analysis:');
console.log('- The algorithm should correctly match pages with "story" in their titles');
console.log('- Check if the issue is in the database query or data availability');
console.log('- Verify that pages with "story" in titles exist and are public');
console.log('- Check browser console logs when viewing a page with "story" in the title');
