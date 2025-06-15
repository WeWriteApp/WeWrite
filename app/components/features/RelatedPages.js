"use client";

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from "../../firebase/config";
import { PillLink } from "../utils/PillLink";
import { Loader2, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "../ui/tooltip";
import { useDateFormat } from "../../contexts/DateFormatContext";
import { isExactDateFormat as isDailyNoteFormat } from "../../utils/dailyNoteNavigation";

/**
 * WeWrite Enhanced Related Pages Algorithm
 *
 * This algorithm has been completely redesigned to match the effectiveness of the main search
 * functionality, providing sophisticated content analysis and relevance scoring.
 *
 * Algorithm Overview:
 * The Related Pages algorithm analyzes both title and content from the current page to find
 * related content using advanced word processing, partial matching, and multi-factor scoring.
 *
 * Key Improvements Over Previous Algorithm:
 * 1. **Comprehensive Content Analysis**
 *    - Before: Only analyzed words from the current page title
 *    - After: Analyzes both title AND content from the current page
 *    - Impact: Much richer source material for finding related content
 *
 * 2. **Advanced Word Processing**
 *    - Before: Basic stemming with limited stop words (30 words)
 *    - After: Advanced stemming with comprehensive stop words (50+ words)
 *    - Features: Porter Stemmer-based algorithm, handles plurals, verb forms, adjectives
 *    - Filters: Articles, prepositions, pronouns, auxiliary verbs
 *
 * 3. **Partial Word Matching**
 *    - Before: Only exact word matches
 *    - After: Supports partial matches like the search API
 *    - Example: "research" matches "researcher", "researching"
 *
 * 4. **Sophisticated Scoring System**
 *    - Before: Simple word count
 *    - After: Multi-factor relevance scoring
 *    - Factors: Exact matches (10 points), Partial matches (5 points), Match ratio bonuses,
 *              Title length similarity, Content vs title match penalties
 *
 * 5. **Increased Coverage**
 *    - Before: Limited to 100 pages
 *    - After: Analyzes 500 pages for better coverage
 *    - Performance: Optimized with 2000-character content limits
 *
 * Ranking Criteria (in order):
 * 1. Match Type: Title matches before content matches
 * 2. Relevance Score: Higher scores first
 * 3. Exact Matches: More exact matches first
 * 4. Match Ratio: Higher percentage of matched words
 * 5. Recency: More recently modified pages first
 *
 * Performance Considerations:
 * - Content Limit: Only analyzes first 2000 characters of content
 * - Query Limit: Increased to 500 pages but with efficient processing
 * - Caching: Results cached per page to avoid re-computation
 * - Error Handling: Graceful fallbacks for parsing errors
 *
 * Expected Results:
 * - Show significantly more relevant results
 * - Find pages that the previous algorithm missed
 * - Rank results more accurately by relevance
 * - Match the effectiveness of the main search functionality
 * - Provide better user experience with more useful recommendations
 *
 * Debugging and Monitoring:
 * The algorithm includes comprehensive logging for source word analysis,
 * candidate evaluation details, top match summaries with scores, and performance metrics.
 * Check browser console for detailed logs when viewing pages with Related Pages sections.
 */

/**
 * Comprehensive stop words list for better filtering
 * Includes common English words that don't contribute to content relevance
 */
const STOP_WORDS = new Set([
  // Articles and determiners
  'the', 'a', 'an', 'this', 'that', 'these', 'those',
  // Prepositions
  'in', 'on', 'at', 'by', 'for', 'with', 'from', 'to', 'of', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
  // Conjunctions
  'and', 'or', 'but', 'so', 'yet', 'nor',
  // Pronouns
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their',
  // Auxiliary verbs - ENHANCED to include more question words and common verbs
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could',
  // Common verbs that are often not meaningful for content matching
  'get', 'got', 'go', 'went', 'come', 'came', 'see', 'saw', 'know', 'knew', 'think', 'thought', 'take', 'took', 'make', 'made', 'give', 'gave',
  // Question words and interrogatives - ENHANCED for better filtering
  'what', 'when', 'where', 'why', 'how', 'who', 'whom', 'whose', 'which', 'whether',
  // Common adjectives and adverbs that don't add semantic value
  'very', 'just', 'now', 'here', 'there', 'all', 'any', 'some', 'each', 'every', 'no', 'not', 'only', 'also', 'too', 'much', 'many', 'more', 'most', 'other', 'such', 'same', 'different', 'new', 'old', 'first', 'last', 'next', 'previous', 'good', 'bad', 'big', 'small', 'long', 'short', 'high', 'low', 'right', 'left', 'yes', 'no',
  // Additional common words that reduce semantic matching quality
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'said', 'say', 'says', 'saying', 'tell', 'told', 'telling', 'ask', 'asked', 'asking',
  'like', 'liked', 'likes', 'liking', 'want', 'wanted', 'wanting', 'need', 'needed', 'needing',
  'use', 'used', 'using', 'work', 'worked', 'working', 'find', 'found', 'finding',
  'look', 'looked', 'looking', 'seem', 'seemed', 'seeming', 'feel', 'felt', 'feeling',
  'try', 'tried', 'trying', 'keep', 'kept', 'keeping', 'let', 'lets', 'letting',
  'put', 'puts', 'putting', 'set', 'sets', 'setting', 'turn', 'turned', 'turning',
  'call', 'called', 'calling', 'move', 'moved', 'moving', 'live', 'lived', 'living',
  'show', 'showed', 'showing', 'play', 'played', 'playing', 'run', 'ran', 'running',
  'bring', 'brought', 'bringing', 'help', 'helped', 'helping', 'leave', 'left', 'leaving'
]);

/**
 * Advanced stemming function that handles more word variations
 * Based on Porter Stemmer algorithm principles but simplified for performance
 *
 * @param {string} word - The word to stem
 * @returns {string} - The stemmed word
 */
function advancedStem(word) {
  if (word.length <= 2) return word;

  // Handle common suffixes in order of specificity
  const suffixRules = [
    // Plurals and verb forms
    { pattern: /ies$/, replacement: 'y' },
    { pattern: /ied$/, replacement: 'y' },
    { pattern: /ying$/, replacement: 'y' },
    { pattern: /sses$/, replacement: 'ss' },
    { pattern: /ies$/, replacement: 'i' },
    { pattern: /ss$/, replacement: 'ss' },
    { pattern: /s$/, replacement: '', minLength: 4 },

    // Verb forms
    { pattern: /eed$/, replacement: 'ee' },
    { pattern: /ed$/, replacement: '', minLength: 4 },
    { pattern: /ing$/, replacement: '', minLength: 4 },

    // Adjective forms
    { pattern: /ly$/, replacement: '', minLength: 4 },
    { pattern: /ful$/, replacement: '', minLength: 5 },
    { pattern: /ness$/, replacement: '', minLength: 5 },
    { pattern: /ment$/, replacement: '', minLength: 5 },
    { pattern: /tion$/, replacement: 'te', minLength: 5 },
    { pattern: /sion$/, replacement: 's', minLength: 5 },
  ];

  for (const rule of suffixRules) {
    if (rule.pattern.test(word)) {
      const stemmed = word.replace(rule.pattern, rule.replacement);
      if (!rule.minLength || stemmed.length >= rule.minLength) {
        return stemmed;
      }
    }
  }

  return word;
}

/**
 * Check if a title exactly matches the YYYY-MM-DD format
 * Special handling for daily notes and date-based pages
 *
 * @param {string} title - The title to check
 * @returns {boolean} - Whether the title is an exact date format
 */
function isExactDateFormat(title) {
  if (!title || title.length !== 10) return false;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  return datePattern.test(title);
}

/**
 * Extract and process meaningful words from text for matching
 *
 * This function performs comprehensive text processing similar to the search API:
 * 1. Normalizes text (lowercase, remove punctuation)
 * 2. Filters out stop words and short words
 * 3. Applies advanced stemming
 * 4. Removes numbers and dates that aren't meaningful for content matching
 * 5. Deduplicates the result
 *
 * @param {string} text - The text to process
 * @returns {Array<string>} - Array of processed, meaningful words
 */
function extractMeaningfulWords(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Special handling for exact date formats
  if (isExactDateFormat(text)) {
    return [text]; // Return the exact date as a single "word"
  }

  return text
    .toLowerCase()
    // Replace punctuation and special characters with spaces
    .replace(/[^\w\s]/g, ' ')
    // Replace hyphens, underscores, and multiple spaces with single spaces
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    // Filter out empty strings and very short words
    .filter(word => word.length >= 3)
    // Filter out stop words
    .filter(word => !STOP_WORDS.has(word))
    // Filter out pure numbers, years, and dates
    .filter(word => {
      // Skip pure numbers
      if (/^\d+$/.test(word)) return false;
      // Skip years (4 digits)
      if (/^\d{4}$/.test(word)) return false;
      // Skip dates (various formats)
      if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/.test(word)) return false;
      return true;
    })
    // Apply advanced stemming
    .map(word => advancedStem(word))
    // Remove duplicates while preserving order
    .filter((word, index, array) => array.indexOf(word) === index)
    // Final filter to ensure we have meaningful words
    .filter(word => word.length >= 2);
}

/**
 * Extract text content from editor state JSON
 * Handles the complex nested structure of Slate.js editor content
 *
 * @param {string} contentString - JSON string of editor content
 * @returns {string} - Extracted plain text
 */
function extractTextFromEditorContent(contentString) {
  try {
    if (!contentString || typeof contentString !== 'string') {
      return '';
    }

    // Parse the JSON content
    let parsedContent;
    if (contentString.startsWith('[') || contentString.startsWith('{')) {
      parsedContent = JSON.parse(contentString);
    } else {
      return contentString; // Already plain text
    }

    // Extract text from editor state structure
    if (Array.isArray(parsedContent)) {
      return parsedContent
        .map(block => {
          if (block?.children && Array.isArray(block.children)) {
            return block.children
              .map(child => child?.text || '')
              .join('');
          }
          return block?.text || '';
        })
        .join(' ');
    } else if (parsedContent?.children) {
      return parsedContent.children
        .map(child => child?.text || '')
        .join('');
    }

    return '';
  } catch (error) {
    console.warn('Failed to parse editor content:', error);
    return '';
  }
}

/**
 * Calculate relevance score between two sets of words
 * Uses multiple factors similar to the search API scoring system
 *
 * @param {Array<string>} sourceWords - Words from the source page
 * @param {Array<string>} targetWords - Words from the target page
 * @param {string} targetTitle - Title of the target page for additional scoring
 * @param {boolean} isContentMatch - Whether this is a content match vs title match
 * @returns {Object} - Score object with details
 */
function calculateRelevanceScore(sourceWords, targetWords, targetTitle = '', isContentMatch = false) {
  if (!sourceWords.length || !targetWords.length) {
    return { score: 0, exactMatches: 0, partialMatches: 0, details: [] };
  }

  let exactMatches = 0;
  let partialMatches = 0;
  const matchDetails = [];

  // Find exact word matches
  sourceWords.forEach(sourceWord => {
    if (targetWords.includes(sourceWord)) {
      exactMatches++;
      matchDetails.push({ type: 'exact', word: sourceWord });
    } else {
      // Check for partial matches (similar to search API)
      const partialMatch = targetWords.find(targetWord => {
        // Partial matching: one word contains the other with significant overlap
        if (sourceWord.length >= 3 && targetWord.includes(sourceWord)) {
          return true;
        }
        if (targetWord.length >= 3 && sourceWord.includes(targetWord)) {
          return true;
        }
        return false;
      });

      if (partialMatch) {
        partialMatches++;
        matchDetails.push({ type: 'partial', word: sourceWord, match: partialMatch });
      }
    }
  });

  // Calculate base score with enhanced weighting for uncommon words
  let score = 0;

  // Weight exact matches more heavily, with bonus for longer/uncommon words
  matchDetails.forEach(match => {
    if (match.type === 'exact') {
      let wordScore = 10;
      // Bonus for longer words (they're usually more specific/uncommon)
      if (match.word.length >= 6) {
        wordScore *= 1.5; // 50% bonus for words 6+ characters
      } else if (match.word.length >= 4) {
        wordScore *= 1.2; // 20% bonus for words 4-5 characters
      }
      score += wordScore;
    } else if (match.type === 'partial') {
      let wordScore = 5;
      // Bonus for longer partial matches
      if (match.word.length >= 6) {
        wordScore *= 1.3;
      }
      score += wordScore;
    }
  });

  // Apply bonuses and penalties
  if (isContentMatch) {
    // Content matches get lower scores than title matches
    score = Math.max(score * 0.6, 1);
  }

  // Bonus for high match ratio
  const matchRatio = (exactMatches + partialMatches) / sourceWords.length;
  if (matchRatio > 0.5) {
    score *= 1.5; // 50% bonus for high match ratio
  }

  // Enhanced bonus for uncommon word matches
  // If we have matches with longer words, give additional bonus
  const hasLongWordMatches = matchDetails.some(match => match.word.length >= 6);
  if (hasLongWordMatches) {
    score *= 1.3; // 30% bonus for having uncommon/specific word matches
  }

  // Bonus for title length similarity (prevents very short titles from dominating)
  if (targetTitle) {
    const titleWords = extractMeaningfulWords(targetTitle);
    const lengthRatio = Math.min(sourceWords.length, titleWords.length) / Math.max(sourceWords.length, titleWords.length);
    if (lengthRatio > 0.7) {
      score *= 1.2; // 20% bonus for similar title lengths
    }
  }

  return {
    score: Math.round(score),
    exactMatches,
    partialMatches,
    matchRatio,
    details: matchDetails
  };
}

/**
 * RelatedPages Component
 *
 * Enhanced algorithm that matches the effectiveness of the main search functionality.
 *
 * Algorithm Overview:
 * 1. Extracts meaningful words from both title and content of the current page
 * 2. Queries a larger set of public pages (500 vs previous 100)
 * 3. Analyzes both title and content of candidate pages
 * 4. Uses sophisticated scoring similar to search API
 * 5. Supports partial word matching for better recall
 * 6. Ranks results by relevance score with multiple factors
 * 7. Filters out already linked pages and the current page
 *
 * Performance Considerations:
 * - Limits content analysis to first 2000 characters for performance
 * - Uses efficient word processing and deduplication
 * - Caches results per page to avoid re-computation
 * - Implements proper error handling and fallbacks
 *
 * @param {Object} page - The current page object with title and content
 * @param {Array} linkedPageIds - Array of page IDs that are already linked in the page content
 * @param {number} maxPages - Maximum number of related pages to display (default: 8)
 */
export default function RelatedPages({ page, linkedPageIds = [], maxPages = 8 }) {
  const [relatedPages, setRelatedPages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { formatDateString } = useDateFormat();

  // Use a ref to track if we've already fetched data for this page
  // This prevents re-fetching during scroll events
  const dataFetchedRef = useRef(false);
  const pageIdRef = useRef(null);

  // Ensure component is mounted before rendering to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset the dataFetched flag when the page changes
  useEffect(() => {
    if (page && page.id !== pageIdRef.current) {
      dataFetchedRef.current = false;
      pageIdRef.current = page?.id || null;
    }
  }, [page]);

  useEffect(() => {
    // Only fetch data if:
    // 1. We have a valid page object
    // 2. We haven't already fetched data for this page
    // 3. The component is mounted
    if (page && page.id && page.title && !dataFetchedRef.current && mounted) {
      const fetchRelatedPages = async () => {
        setIsLoading(true);

        try {
          console.log(`🔍 ENHANCED RELATED PAGES: Finding related pages for "${page.title}" (${page.id})`);

          // Mark that we've fetched data for this page
          dataFetchedRef.current = true;

          // Extract meaningful words from BOTH title and content of the current page
          const titleWords = extractMeaningfulWords(page.title);

          // Extract content words from the current page if available
          let contentWords = [];
          if (page.content && typeof page.content === 'string' && page.content.length > 20) {
            const contentText = extractTextFromEditorContent(page.content);
            if (contentText) {
              // Limit content analysis to first 2000 characters for performance
              const limitedContent = contentText.substring(0, 2000);
              contentWords = extractMeaningfulWords(limitedContent);
            }
          }

          // Combine title and content words, giving priority to title words
          const allSourceWords = [...new Set([...titleWords, ...contentWords])];

          console.log(`📝 Source analysis: ${titleWords.length} title words, ${contentWords.length} content words, ${allSourceWords.length} total unique words`);
          console.log(`🎯 Key words for matching: ${allSourceWords.slice(0, 10).join(', ')}${allSourceWords.length > 10 ? '...' : ''}`);

          // If we don't have any significant words, return empty results
          if (allSourceWords.length === 0) {
            console.log('❌ No meaningful words found, returning empty results');
            setRelatedPages([]);
            setIsLoading(false);
            return;
          }

          // Query for public pages with increased limit to match search functionality
          const pagesQuery = query(
            collection(db, 'pages'),
            where('isPublic', '==', true),
            limit(500) // Increased from 100 to 500 for better coverage
          );

          const pagesSnapshot = await getDocs(pagesQuery);
          console.log(`📊 Analyzing ${pagesSnapshot.docs.length} public pages for enhanced matching`);

          // Array to store all candidate pages with their scores
          const candidatePages = [];

          // Process each page with enhanced scoring
          pagesSnapshot.docs.forEach(doc => {
            const pageData = { id: doc.id, ...doc.data() };

            // Skip the current page
            if (pageData.id === page.id) return;

            // Skip pages without titles
            if (!pageData.title) return;

            // Extract words from the candidate page title
            const candidateTitleWords = extractMeaningfulWords(pageData.title);

            // Calculate title match score
            const titleScore = calculateRelevanceScore(
              allSourceWords,
              candidateTitleWords,
              pageData.title,
              false // isContentMatch = false for title
            );

            // Initialize best score with title score
            let bestScore = titleScore;
            let matchType = 'title';
            let matchDetails = titleScore.details;

            // Check content matches if we have content and title score is low
            if (pageData.content && typeof pageData.content === 'string' && pageData.content.length > 50) {
              try {
                // Extract text from candidate page content
                const candidateContentText = extractTextFromEditorContent(pageData.content);
                if (candidateContentText) {
                  // Limit content analysis to first 2000 characters for performance
                  const limitedCandidateContent = candidateContentText.substring(0, 2000);
                  const candidateContentWords = extractMeaningfulWords(limitedCandidateContent);

                  // Calculate content match score
                  const contentScore = calculateRelevanceScore(
                    allSourceWords,
                    candidateContentWords,
                    pageData.title,
                    true // isContentMatch = true for content
                  );

                  // Use content score if it's significantly better than title score
                  // or if title score is very low
                  if (contentScore.score > bestScore.score || (titleScore.score < 5 && contentScore.score > 0)) {
                    bestScore = contentScore;
                    matchType = 'content';
                    matchDetails = contentScore.details;
                  }
                }
              } catch (error) {
                console.warn(`⚠️ Failed to parse content for page ${pageData.id}:`, error);
              }
            }

            // Only include pages with meaningful scores
            if (bestScore.score > 0) {
              candidatePages.push({
                ...pageData,
                relevanceScore: bestScore.score,
                exactMatches: bestScore.exactMatches,
                partialMatches: bestScore.partialMatches,
                matchRatio: bestScore.matchRatio,
                matchType,
                matchDetails,
                // Additional metadata for debugging
                debugInfo: {
                  titleWords: candidateTitleWords.length,
                  titleScore: titleScore.score,
                  contentScore: bestScore.score !== titleScore.score ? bestScore.score : 0
                }
              });
            }
          });

          // Sort candidates by relevance score and apply sophisticated ranking
          // Mark already linked pages instead of filtering them out
          const sortedCandidates = candidatePages
            .map(page => ({
              ...page,
              isAlreadyLinked: linkedPageIds.includes(page.id)
            }))
            .sort((a, b) => {
              // Prioritize non-linked pages over already linked ones
              if (a.isAlreadyLinked !== b.isAlreadyLinked) {
                return a.isAlreadyLinked ? 1 : -1;
              }
              // Primary sort: by match type (title matches come first)
              if (a.matchType !== b.matchType) {
                return a.matchType === 'title' ? -1 : 1;
              }

              // Secondary sort: by relevance score
              if (b.relevanceScore !== a.relevanceScore) {
                return b.relevanceScore - a.relevanceScore;
              }

              // Tertiary sort: by exact matches count
              if (b.exactMatches !== a.exactMatches) {
                return b.exactMatches - a.exactMatches;
              }

              // Quaternary sort: by match ratio (higher is better)
              if (b.matchRatio !== a.matchRatio) {
                return b.matchRatio - a.matchRatio;
              }

              // Final sort: by last modified date (more recent first)
              return (b.lastModified ? new Date(b.lastModified) : 0) -
                     (a.lastModified ? new Date(a.lastModified) : 0);
            })
            .slice(0, maxPages);

          // Log detailed results for debugging
          console.log(`✅ ENHANCED RESULTS: Found ${sortedCandidates.length} related pages from ${candidatePages.length} candidates`);

          if (sortedCandidates.length > 0) {
            console.log('🏆 Top matches:');
            sortedCandidates.slice(0, 3).forEach((page, index) => {
              console.log(`  ${index + 1}. "${page.title}" (${page.matchType}) - Score: ${page.relevanceScore}, Exact: ${page.exactMatches}, Partial: ${page.partialMatches}, Ratio: ${(page.matchRatio * 100).toFixed(1)}%`);
            });
          }

          setRelatedPages(sortedCandidates);
        } catch (error) {
          console.error('Error fetching related pages:', error);
          // Set empty array on error to avoid undefined state
          setRelatedPages([]);
        }

        setIsLoading(false);
      };

      fetchRelatedPages();
    }
  }, [page, maxPages, linkedPageIds, mounted]);

  // Use a fixed height container to prevent layout shifts
  // The component will maintain the same height regardless of loading state or content
  return (
    <div className="mt-8 pt-6 min-h-[180px]">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-medium">Related Pages</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[350px]">
              <p>Enhanced algorithm that finds pages with similar content using sophisticated word matching. Analyzes both titles and content, supports partial word matching, and uses advanced relevance scoring similar to the main search functionality. Title matches are prioritized over content matches.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {!mounted || isLoading ? (
        // Loading state - fixed height placeholder
        <div className="flex justify-center items-center py-4 h-[100px]">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        </div>
      ) : relatedPages.length > 0 ? (
        // Results state - fixed height container with overflow
        <div className="flex flex-wrap gap-2 py-4 min-h-[100px] max-h-[200px] overflow-y-auto">
          {relatedPages.map(page => (
            <div key={page.id} className="flex-none max-w-full">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={page.isAlreadyLinked ? "opacity-60" : ""}>
                      <PillLink
                        key={page.id}
                        href={`/${page.id}`}
                        className="max-w-[200px] sm:max-w-[250px] md:max-w-[300px]"
                      >
                        {page.title && isDailyNoteFormat(page.title)
                          ? formatDateString(page.title)
                          : (page.title || "Untitled")}
                      </PillLink>
                    </div>
                  </TooltipTrigger>
                  {page.isAlreadyLinked && (
                    <TooltipContent side="top" className="max-w-[200px]">
                      Already linked in page content
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>
      ) : (
        // Empty state - fixed height placeholder with subtle dotted border
        <div className="flex justify-center items-center py-4 h-[100px] text-muted-foreground border border-dotted border-border/30 rounded-md">
          No related pages found
        </div>
      )}
    </div>
  );
}
