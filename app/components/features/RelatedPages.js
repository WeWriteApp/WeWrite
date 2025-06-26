"use client";

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
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
 * WeWrite Enhanced Related Pages Algorithm - Title-First Priority (2024)
 *
 * MAJOR UPDATE: This algorithm has been enhanced to prioritize obvious title-based relationships,
 * ensuring that pages like "JavaScript Basics" and "Advanced JavaScript" appear first in results.
 *
 * Algorithm Overview:
 * The Related Pages algorithm now uses a title-first approach, analyzing title similarity with
 * much higher priority than content matches, making relationships more intuitive and transparent.
 *
 * Key Enhancements for Title-First Priority:
 * 1. **Title-First Scoring Strategy**
 *    - Title matches get 5x higher base scores (50 vs 10 points for exact matches)
 *    - Pattern recognition for educational content (basic/advanced, intro/guide)
 *    - Title match ratio bonuses up to 300% for comprehensive similarity
 *    - Content matches only supplement title matches or serve as fallback
 *
 * 2. **Enhanced Title Similarity Algorithm**
 *    - Dedicated calculateTitleSimilarityScore() function for title analysis
 *    - Special bonuses for educational content patterns
 *    - Length similarity bonuses to prevent single-word dominance
 *    - Transparent tracking of which words matched between titles
 *
 * 3. **Improved Ranking Strategy**
 *    - Primary sort: Match type (Title → Title+Content → Content-only)
 *    - Secondary sort: Relevance score within same match type
 *    - Tertiary sort: Title match ratio for title matches
 *    - Quaternary sort: Exact matches count
 *    - Final sort: Recency
 *
 * 4. **Content Analysis as Secondary Factor**
 *    - Content matches only contribute 10% when title matches exist
 *    - Content-only matches get 50% penalty to prioritize title relationships
 *    - Advanced word processing with comprehensive stop words (100+ words)
 *    - Partial word matching for better recall
 *
 * 5. **Transparency and User Trust**
 *    - Tracks matched words for better user understanding
 *    - Clear distinction between title and content matches
 *    - Obvious relationships appear first, building user confidence
 *
 * Examples of Improved Results:
 * - "JavaScript Basics" → "Advanced JavaScript" (high priority due to shared "JavaScript")
 * - "React Components" → "Vue Components" (prioritized over unrelated React content)
 * - "Machine Learning Introduction" → "Advanced Machine Learning" (multiple shared words)
 *
 * Performance Considerations:
 * - Efficient title analysis before content processing
 * - Content limit: 2000 characters for performance
 * - Query limit: 500 pages with optimized processing
 * - Smart caching and error handling
 *
 * Expected Results:
 * - Obvious title relationships appear first
 * - Increased user trust in recommendations
 * - Better discovery of related educational content
 * - More intuitive and transparent connections
 * - Maintained performance with enhanced accuracy
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
 * Calculate enhanced title similarity score with direct word matching priority
 *
 * ENHANCED ALGORITHM: This function prioritizes obvious title relationships like:
 * - "JavaScript Basics" and "Advanced JavaScript" (shared word + pattern bonus)
 * - "React Components" and "Vue Components" (shared specific terms)
 * - "Machine Learning Introduction" and "Advanced Machine Learning" (multiple shared words)
 *
 * Key improvements:
 * 1. Much higher base scores for title matches (50 vs 10 for exact matches)
 * 2. Pattern recognition for educational content (basic/advanced, intro/guide)
 * 3. Title match ratio bonuses for comprehensive similarity
 * 4. Length similarity bonuses to prevent single-word dominance
 *
 * @param {string} sourceTitle - Title of the source page
 * @param {string} targetTitle - Title of the target page
 * @returns {Object} - Enhanced title score object with details
 */
function calculateTitleSimilarityScore(sourceTitle, targetTitle) {
  if (!sourceTitle || !targetTitle) {
    return { score: 0, exactMatches: 0, partialMatches: 0, details: [], titleMatchRatio: 0 };
  }

  const sourceWords = extractMeaningfulWords(sourceTitle);
  const targetWords = extractMeaningfulWords(targetTitle);

  if (!sourceWords.length || !targetWords.length) {
    return { score: 0, exactMatches: 0, partialMatches: 0, details: [], titleMatchRatio: 0 };
  }

  let exactMatches = 0;
  let partialMatches = 0;
  const matchDetails = [];

  // Find exact word matches with enhanced scoring for title context
  sourceWords.forEach(sourceWord => {
    if (targetWords.includes(sourceWord)) {
      exactMatches++;
      matchDetails.push({ type: 'exact', word: sourceWord });
    } else {
      // Check for partial matches
      const partialMatch = targetWords.find(targetWord => {
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

  // Calculate title-specific score with heavy emphasis on direct matches
  let score = 0;

  // ENHANCED: Much higher base scores for title matches
  matchDetails.forEach(match => {
    if (match.type === 'exact') {
      let wordScore = 50; // Increased from 10 to 50 for title matches

      // Extra bonus for longer, more specific words
      if (match.word.length >= 6) {
        wordScore *= 2.0; // 100% bonus for long words in titles
      } else if (match.word.length >= 4) {
        wordScore *= 1.5; // 50% bonus for medium words in titles
      }

      score += wordScore;
    } else if (match.type === 'partial') {
      let wordScore = 20; // Increased from 5 to 20 for title partial matches

      if (match.word.length >= 6) {
        wordScore *= 1.5;
      }

      score += wordScore;
    }
  });

  // ENHANCED: Title-specific bonuses
  const titleMatchRatio = (exactMatches + partialMatches) / Math.max(sourceWords.length, targetWords.length);

  // Massive bonus for high title match ratios
  if (titleMatchRatio >= 0.5) {
    score *= 3.0; // 200% bonus for high title similarity
  } else if (titleMatchRatio >= 0.3) {
    score *= 2.0; // 100% bonus for moderate title similarity
  }

  // Bonus for similar title lengths (prevents single-word matches from dominating)
  const lengthRatio = Math.min(sourceWords.length, targetWords.length) / Math.max(sourceWords.length, targetWords.length);
  if (lengthRatio > 0.6) {
    score *= 1.5; // 50% bonus for similar title lengths
  }

  // Special bonus for common title patterns
  const sourceText = sourceTitle.toLowerCase();
  const targetText = targetTitle.toLowerCase();

  // Detect common patterns like "Basic/Advanced", "Introduction/Guide", etc.
  const patterns = [
    ['basic', 'advanced'], ['introduction', 'guide'], ['beginner', 'intermediate', 'advanced'],
    ['part 1', 'part 2'], ['chapter', 'section'], ['overview', 'deep dive'],
    ['fundamentals', 'advanced'], ['getting started', 'mastery']
  ];

  for (const pattern of patterns) {
    const sourceHasPattern = pattern.some(word => sourceText.includes(word));
    const targetHasPattern = pattern.some(word => targetText.includes(word));

    if (sourceHasPattern && targetHasPattern && exactMatches > 0) {
      score *= 1.8; // 80% bonus for related educational content
      break;
    }
  }

  return {
    score: Math.round(score),
    exactMatches,
    partialMatches,
    titleMatchRatio,
    details: matchDetails
  };
}

/**
 * Calculate relevance score between two sets of words (legacy function for content matching)
 * Now used primarily for content matches, with title matches handled by calculateTitleSimilarityScore
 *
 * @param {Array<string>} sourceWords - Words from the source page
 * @param {Array<string>} targetWords - Words from the target page
 * @param {string} targetTitle - Title of the target page for additional scoring
 * @param {boolean} isContentMatch - Whether this is a content match vs title match
 * @returns {Object} - Score object with details
 */
function calculateRelevanceScore(sourceWords, targetWords, targetTitle = '', isContentMatch = false) {
  // Note: targetTitle parameter kept for API compatibility but not used in content matching
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
      // Check for partial matches
      const partialMatch = targetWords.find(targetWord => {
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

  // Calculate base score - reduced for content matches
  let score = 0;

  matchDetails.forEach(match => {
    if (match.type === 'exact') {
      let wordScore = isContentMatch ? 5 : 15; // Lower scores for content matches

      if (match.word.length >= 6) {
        wordScore *= 1.3;
      } else if (match.word.length >= 4) {
        wordScore *= 1.1;
      }

      score += wordScore;
    } else if (match.type === 'partial') {
      let wordScore = isContentMatch ? 2 : 7;

      if (match.word.length >= 6) {
        wordScore *= 1.2;
      }

      score += wordScore;
    }
  });

  // Apply content penalty
  if (isContentMatch) {
    score = Math.max(score * 0.4, 1); // Heavy penalty for content-only matches
  }

  const matchRatio = (exactMatches + partialMatches) / sourceWords.length;
  if (matchRatio > 0.4) {
    score *= 1.3;
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
 * @param {number} maxPages - Maximum number of related pages to display (default: 20)
 */
export default function RelatedPages({ page, linkedPageIds = [], maxPages = 20 }) {
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

          // If we don't have any significant words, try with a more lenient approach
          if (allSourceWords.length === 0) {
            console.log('⚠️ No meaningful words found with strict filtering, trying lenient approach...');
            console.log('🔍 Debug - Original title:', page.title);
            console.log('🔍 Debug - Original content length:', page.content ? page.content.length : 0);
            console.log('🔍 Debug - Title words extracted:', titleWords);
            console.log('🔍 Debug - Content words extracted:', contentWords);

            // Try a more lenient word extraction for very short titles
            const lenientTitleWords = page.title
              .toLowerCase()
              .replace(/[^\w\s]/g, ' ')
              .split(' ')
              .filter(word => word.length >= 2)
              .filter(word => !STOP_WORDS.has(word));

            if (lenientTitleWords.length > 0) {
              console.log('🔍 Lenient title words:', lenientTitleWords);
              allSourceWords.push(...lenientTitleWords);
            } else {
              console.log('❌ Even lenient approach found no words, returning empty results');
              setRelatedPages([]);
              setIsLoading(false);
              return;
            }
          }

          // Query for public pages with increased limit to match search functionality
          // CRITICAL: Exclude soft-deleted pages from related pages suggestions
          // Note: Simplified query to avoid issues with deleted field - we'll filter client-side
          const pagesQuery = query(
            collection(db, 'pages'),
            where('isPublic', '==', true),
            limit(500) // Increased from 100 to 500 for better coverage
          );

          const pagesSnapshot = await getDocs(pagesQuery);
          console.log(`📊 Analyzing ${pagesSnapshot.docs.length} public pages for enhanced title-based matching`);

          // Array to store all candidate pages with their scores
          const candidatePages = [];

          // Process each page with enhanced scoring
          pagesSnapshot.docs.forEach(doc => {
            const pageData = { id: doc.id, ...doc.data() };

            // Skip the current page
            if (pageData.id === page.id) return;

            // Skip soft-deleted pages (client-side filtering)
            if (pageData.deleted === true) return;

            // Skip pages without titles
            if (!pageData.title) return;

            // Extract words from the candidate page title
            const candidateTitleWords = extractMeaningfulWords(pageData.title);

            // ENHANCED: Calculate title similarity score using new algorithm
            const titleSimilarityScore = calculateTitleSimilarityScore(page.title, pageData.title);

            // Initialize best score with enhanced title score
            let bestScore = titleSimilarityScore;
            let matchType = 'title';
            let matchDetails = titleSimilarityScore.details;

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

                  // ENHANCED: Title-first strategy - only use content if no meaningful title matches
                  if (titleSimilarityScore.score === 0 && contentScore.score > 0) {
                    // No title matches, so content becomes primary
                    bestScore = {
                      score: Math.round(contentScore.score * 0.5), // Reduce content-only scores
                      exactMatches: contentScore.exactMatches,
                      partialMatches: contentScore.partialMatches,
                      details: contentScore.details
                    };
                    matchType = 'content';
                    matchDetails = contentScore.details;
                  } else if (titleSimilarityScore.score > 0) {
                    // Title matches exist, add small content bonus
                    bestScore.score += Math.round(contentScore.score * 0.1);
                    matchType = 'title+content';
                  }
                }
              } catch (error) {
                console.warn(`⚠️ Failed to parse content for page ${pageData.id}:`, error);
              }
            }

            // Only include pages with meaningful scores
            if (bestScore.score > 0) {
              // ENHANCED: Extract matched words for transparency
              const matchedWords = matchDetails
                .filter(detail => detail.type === 'exact')
                .map(detail => detail.word);

              const partialMatchedWords = matchDetails
                .filter(detail => detail.type === 'partial')
                .map(detail => ({ source: detail.word, target: detail.match }));

              candidatePages.push({
                ...pageData,
                relevanceScore: bestScore.score,
                exactMatches: bestScore.exactMatches,
                partialMatches: bestScore.partialMatches,
                matchRatio: bestScore.matchRatio,
                matchType,
                matchDetails,
                // ENHANCED: Add transparency fields
                matchedWords: matchedWords,
                partialMatchedWords: partialMatchedWords,
                titleMatchRatio: bestScore.titleMatchRatio || 0,
                // Additional metadata for debugging
                debugInfo: {
                  titleWords: candidateTitleWords.length,
                  originalTitleScore: titleSimilarityScore.score,
                  hasContentBonus: matchType.includes('content')
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
              // ENHANCED: Primary sort by match type priority (title matches first)
              const getMatchTypePriority = (matchType) => {
                if (matchType === 'title') return 3;
                if (matchType === 'title+content') return 2;
                if (matchType === 'content') return 1;
                return 0;
              };

              const aPriority = getMatchTypePriority(a.matchType);
              const bPriority = getMatchTypePriority(b.matchType);

              if (bPriority !== aPriority) {
                return bPriority - aPriority;
              }

              // Secondary sort: by relevance score within same match type
              if (b.relevanceScore !== a.relevanceScore) {
                return b.relevanceScore - a.relevanceScore;
              }

              // ENHANCED: Tertiary sort by title match ratio for title matches
              if (a.matchType === 'title' && b.matchType === 'title') {
                if (b.titleMatchRatio !== a.titleMatchRatio) {
                  return b.titleMatchRatio - a.titleMatchRatio;
                }
              }

              // Quaternary sort: by exact matches count
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
          } else if (candidatePages.length === 0) {
            console.log('⚠️ No candidate pages found, this might indicate a database or query issue');
            // Try a fallback query for recent pages
            console.log('🔄 Attempting fallback: showing recent public pages...');
            try {
              const fallbackQuery = query(
                collection(db, 'pages'),
                where('isPublic', '==', true),
                limit(5)
              );
              const fallbackSnapshot = await getDocs(fallbackQuery);
              const fallbackPages = fallbackSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(pageData => pageData.id !== page.id && !pageData.deleted && pageData.title)
                .slice(0, 3)
                .map(pageData => ({
                  ...pageData,
                  relevanceScore: 1,
                  exactMatches: 0,
                  partialMatches: 0,
                  matchRatio: 0,
                  matchType: 'fallback',
                  isAlreadyLinked: linkedPageIds.includes(pageData.id)
                }));

              if (fallbackPages.length > 0) {
                console.log(`🔄 Fallback found ${fallbackPages.length} recent pages`);
                setRelatedPages(fallbackPages);
              } else {
                setRelatedPages([]);
              }
            } catch (fallbackError) {
              console.error('❌ Fallback query also failed:', fallbackError);
              setRelatedPages([]);
            }
          } else {
            console.log('⚠️ No matches found despite having candidates, algorithm might be too strict');
          }

          // Set the final results (this handles the normal case where we have matches)
          if (sortedCandidates.length > 0) {
            setRelatedPages(sortedCandidates);
          }
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
        // Results state - natural flow layout without scrolling
        <div className="flex flex-wrap gap-2 py-4">
          {relatedPages.map(page => (
            <div key={page.id} className="flex-none max-w-full">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={page.isAlreadyLinked ? "opacity-60" : ""}>
                      <PillLink
                        key={page.id}
                        href={`/${page.id}`}
                        className="max-w-[150px] sm:max-w-[200px] md:max-w-[250px] lg:max-w-[300px] truncate"
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
