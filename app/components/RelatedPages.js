"use client";

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { PillLink } from './PillLink';
import { Loader2, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './ui/tooltip';

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

// Check if a title exactly matches the YYYY-MM-DD format
function isExactDateFormat(title) {
  // Must be exactly 10 characters long
  if (title.length !== 10) {
    return false;
  }
  // Must match YYYY-MM-DD pattern exactly
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  return datePattern.test(title);
}

// Process words with improved cleaning and stemming
function processWords(text) {
  // If the text is an exact date format, don't process it as words
  if (isExactDateFormat(text)) {
    return [text]; // Return the exact date as a single "word"
  }

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
    .split(/\s+/)
    .filter(word => word.length >= 2) // Include words of at least 2 characters
    .filter(word => !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'to', 'of', 'in', 'on', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could'].includes(word))
    .filter(word => !/^\d{4}$|^\d{2}$/.test(word)) // Filter out year-only (YYYY) and month/day-only (MM/DD) matches
    .map(word => simpleStem(word)); // Apply stemming
}

/**
 * RelatedPages Component
 *
 * Displays a list of pages related to the current page.
 * Uses a combination of user-based and content-based relevance.
 * Filters out pages that are already linked in the body of the page.
 *
 * @param {Object} page - The current page object
 * @param {Array} linkedPageIds - Array of page IDs that are already linked in the page content
 * @param {number} maxPages - Maximum number of related pages to display (default: 5)
 */
export default function RelatedPages({ page, linkedPageIds = [], maxPages = 5 }) {
  const [relatedPages, setRelatedPages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

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
          console.log(`Finding related pages for: ${page.id} (${page.title || 'Untitled'})`);

          // Mark that we've fetched data for this page
          dataFetchedRef.current = true;

          // Extract significant words from the title with improved processing
          const titleWords = processWords(page.title);

          console.log(`Title words for matching: ${titleWords.join(', ')}`);

          // If we don't have any significant words, return empty results
          if (titleWords.length === 0) {
            setRelatedPages([]);
            setIsLoading(false);
            return;
          }

          // Query for public pages
          const pagesQuery = query(
            collection(db, 'pages'),
            where('isPublic', '==', true),
            limit(100) // Limit to 100 pages for performance
          );

          const pagesSnapshot = await getDocs(pagesQuery);
          console.log(`Analyzing ${pagesSnapshot.docs.length} public pages for title and content matches`);

          // Arrays to store pages with different types of matches
          const titleMatchingPages = [];
          const contentMatchingPages = [];

          // Process each page
          pagesSnapshot.docs.forEach(doc => {
            const pageData = { id: doc.id, ...doc.data() };

            // Skip the current page
            if (pageData.id === page.id) return;

            // Skip pages without titles
            if (!pageData.title) return;

            // Check for word matches in the title with improved processing
            const pageTitleWords = processWords(pageData.title);

            // Find exact word matches in title
            const titleExactMatches = titleWords.filter(word =>
              pageTitleWords.includes(word)
            );

            // Calculate base match score from individual word matches in title
            let titleMatchScore = titleExactMatches.length;

            // Check for consecutive word matches (phrases) in title
            let maxConsecutiveMatches = 0;

            // Convert title words to string for easier comparison
            const titleString = titleWords.join(' ');
            const pageTitleString = pageTitleWords.join(' ');

            // Find the longest matching phrase by checking all possible substrings
            for (let i = 0; i < titleWords.length - 1; i++) {
              for (let j = i + 2; j <= titleWords.length; j++) {
                const phrase = titleWords.slice(i, j).join(' ');
                // Only consider phrases with at least 2 words
                if (phrase.split(' ').length >= 2 && pageTitleString.includes(phrase)) {
                  // Count the number of words in the phrase
                  const wordCount = phrase.split(' ').length;
                  if (wordCount > maxConsecutiveMatches) {
                    maxConsecutiveMatches = wordCount;
                    console.log(`Found consecutive title match: "${phrase}" (${wordCount} words)`);
                  }
                }
              }
            }

            // Add bonus points for consecutive matches (3x per word)
            const consecutiveMatchBonus = maxConsecutiveMatches > 1 ? maxConsecutiveMatches * 3 : 0;

            // Calculate total title score (individual matches + consecutive bonus)
            const totalTitleScore = titleMatchScore + consecutiveMatchBonus;

            // If we have title matches, add to title matching pages
            if (totalTitleScore > 0) {
              titleMatchingPages.push({
                ...pageData,
                matchCount: totalTitleScore,
                matchType: 'title',
                hasConsecutiveMatches: maxConsecutiveMatches > 1,
                consecutiveMatchCount: maxConsecutiveMatches
              });
            } else {
              // Check for content matches only if no title matches
              // This prevents duplicate entries and prioritizes title matches
              let contentMatchScore = 0;

              // Only check content if the page has content and we have a reasonable amount to search
              if (pageData.content && typeof pageData.content === 'string' && pageData.content.length > 50) {
                try {
                  // Parse content if it's JSON (from editor state)
                  let contentText = pageData.content;
                  if (contentText.startsWith('[') || contentText.startsWith('{')) {
                    const parsedContent = JSON.parse(contentText);
                    // Extract text from editor state structure
                    if (Array.isArray(parsedContent)) {
                      contentText = parsedContent
                        .map(block => block?.children?.map(child => child?.text || '').join('') || '')
                        .join(' ');
                    }
                  }

                  // Process content words (limit to first 1000 characters for performance)
                  const limitedContent = contentText.substring(0, 1000);
                  const contentWords = processWords(limitedContent);

                  // Find matches in content
                  const contentExactMatches = titleWords.filter(word =>
                    contentWords.includes(word)
                  );

                  contentMatchScore = contentExactMatches.length;

                  // Add to content matching pages if we have matches
                  if (contentMatchScore > 0) {
                    contentMatchingPages.push({
                      ...pageData,
                      matchCount: contentMatchScore,
                      matchType: 'content',
                      hasConsecutiveMatches: false,
                      consecutiveMatchCount: 0
                    });
                  }
                } catch (error) {
                  // If content parsing fails, skip content matching for this page
                  console.warn(`Failed to parse content for page ${pageData.id}:`, error);
                }
              }
            }
          });

          // Combine title and content matches, prioritizing title matches
          const allMatches = [
            ...titleMatchingPages,
            ...contentMatchingPages
          ];

          // Filter out pages that are already linked in the content
          const filteredPages = allMatches
            .filter(page => !linkedPageIds.includes(page.id))
            .sort((a, b) => {
              // First, prioritize by match type (title matches come first)
              if (a.matchType !== b.matchType) {
                return a.matchType === 'title' ? -1 : 1;
              }
              // Then sort by match count within the same type
              if (b.matchCount !== a.matchCount) {
                return b.matchCount - a.matchCount;
              }
              // Finally, sort by last modified date if available
              return (b.lastModified ? new Date(b.lastModified) : 0) -
                     (a.lastModified ? new Date(a.lastModified) : 0);
            })
            .slice(0, maxPages);

          console.log(`Found ${filteredPages.length} related pages (${titleMatchingPages.length} title matches, ${contentMatchingPages.length} content matches)`);

          setRelatedPages(filteredPages);
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
            <TooltipContent side="top" className="max-w-[300px]">
              <p>Pages that share similar words in their titles or content. Title matches are prioritized over content matches. Excludes links that are already mentioned in the page.</p>
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
              <PillLink
                key={page.id}
                href={`/${page.id}`}
                className="max-w-[200px] sm:max-w-[250px] md:max-w-[300px]"
              >
                {page.title || "Untitled"}
              </PillLink>
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
