"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { PillLink } from './PillLink';
import { Loader2 } from 'lucide-react';

/**
 * RelatedPages Component
 *
 * Displays a list of pages related to the current page.
 * Uses a combination of user-based and content-based relevance.
 *
 * @param {Object} page - The current page object
 * @param {number} maxPages - Maximum number of related pages to display (default: 5)
 */
export default function RelatedPages({ page, maxPages = 5 }) {
  const [relatedPages, setRelatedPages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRelatedPages = async () => {
      setIsLoading(true);

      if (!page || !page.id || !page.userId) {
        setIsLoading(false);
        return;
      }

      try {
        // First, get pages by the same author (user-based relevance)
        const userPagesRef = collection(db, 'pages');
        const userQuery = query(
          userPagesRef,
          where('userId', '==', page.userId),
          where('isPublic', '==', true),
          orderBy('updatedAt', 'desc'),
          limit(maxPages * 2)
        );

        const userQuerySnapshot = await getDocs(userQuery);

        // Map of page IDs to page data with relevance score
        const pageMap = new Map();

        // Add user's pages with a base relevance score
        userQuerySnapshot.docs.forEach(doc => {
          const pageData = { id: doc.id, ...doc.data() };

          // Skip the current page
          if (pageData.id === page.id) return;

          // Add to map with a base relevance score
          pageMap.set(pageData.id, {
            ...pageData,
            relevanceScore: 1 // Base score for being by the same author
          });
        });

        // If we have a title, try to find content-based related pages
        if (page.title) {
          // Extract significant words from the title
          const titleWords = page.title
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length >= 3)
            .filter(word => !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'to', 'of', 'in', 'on', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could'].includes(word));

          // If we have significant words, search for content-based related pages
          if (titleWords.length > 0) {
            // Create a query for public pages
            const contentQuery = query(
              collection(db, 'pages'),
              where('isPublic', '==', true),
              limit(50)
            );

            const contentQuerySnapshot = await getDocs(contentQuery);

            // Process each page for content relevance
            contentQuerySnapshot.docs.forEach(doc => {
              const pageData = { id: doc.id, ...doc.data() };

              // Skip the current page
              if (pageData.id === page.id) return;

              // Calculate content relevance score
              let relevanceScore = 0;

              // Check title for word matches
              if (pageData.title) {
                const pageTitle = pageData.title.toLowerCase();
                const pageTitleWords = pageTitle
                  .split(/\s+/)
                  .filter(word => word.length >= 3)
                  .filter(word => !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'to', 'of', 'in', 'on', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could'].includes(word));

                // First, check for exact word matches
                const exactMatches = titleWords.filter(word =>
                  pageTitleWords.includes(word)
                );

                // Then check for partial matches
                const partialMatches = titleWords.filter(word => {
                  // Skip words that are already exact matches
                  if (exactMatches.includes(word)) return false;

                  // Check if any word in pageTitleWords contains this word as a substring
                  // This helps with cases like "ACP" matching "Woke ACP"
                  for (const pageWord of pageTitleWords) {
                    if (pageWord.includes(word) || word.includes(pageWord)) {
                      return true;
                    }
                  }

                  return false;
                });

                // Combine all matching words for total count
                const matchingWords = [...exactMatches, ...partialMatches];

                if (matchingWords.length > 0) {
                  // Give much higher score for exact matches
                  if (exactMatches.length > 0) {
                    // Higher score for more exact matching words
                    relevanceScore += exactMatches.length * 5;

                    // Bonus for matching a higher percentage of words exactly
                    const exactMatchPercentage = exactMatches.length / titleWords.length;
                    if (exactMatchPercentage >= 0.5) {
                      relevanceScore += 10;
                    } else if (exactMatchPercentage >= 0.25) {
                      relevanceScore += 5;
                    }
                  }

                  // Add smaller score for partial matches
                  if (partialMatches.length > 0) {
                    relevanceScore += partialMatches.length * 1;
                  }

                  // Bonus for matching a higher percentage of words (exact + partial)
                  const matchPercentage = matchingWords.length / titleWords.length;
                  if (matchPercentage >= 0.5) {
                    relevanceScore += 3;
                  } else if (matchPercentage >= 0.25) {
                    relevanceScore += 1;
                  }
                }

                // Check for partial matches too
                for (const word of titleWords) {
                  if (pageTitle.includes(word) && !matchingWords.includes(word)) {
                    relevanceScore += 0.5; // Lower score for partial matches
                  }
                }
              }

              // If we already have this page in the map, add to its relevance score
              if (pageMap.has(pageData.id)) {
                const existing = pageMap.get(pageData.id);
                pageMap.set(pageData.id, {
                  ...existing,
                  relevanceScore: existing.relevanceScore + relevanceScore
                });
              }
              // Otherwise, if it has a relevance score, add it to the map
              else if (relevanceScore > 0) {
                pageMap.set(pageData.id, { ...pageData, relevanceScore });
              }
            });
          }
        }

        // Convert to array, filter out pages with no content relevance, sort by relevance score, and limit
        const sortedPages = Array.from(pageMap.values())
          // Only include pages that have a relevance score from content matching (not just author-based)
          // Increase the threshold to 2.0 to prioritize pages with at least some exact word matches
          .filter(page => page.relevanceScore >= 2.0)
          .sort((a, b) => b.relevanceScore - a.relevanceScore || b.updatedAt - a.updatedAt)
          .slice(0, maxPages);

        setRelatedPages(sortedPages);
      } catch (error) {
        console.error('Error fetching related pages:', error);
      }

      setIsLoading(false);
    };

    fetchRelatedPages();
  }, [page, maxPages]);

  if (isLoading) {
    return (
      <div className="mt-8 pt-6">
        <h3 className="text-lg font-medium mb-4">Related Pages</h3>
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        </div>
      </div>
    );
  }

  if (relatedPages.length === 0) {
    return (
      <div className="mt-8 pt-6">
        <h3 className="text-lg font-medium mb-4">Related Pages</h3>
        <div className="text-muted-foreground text-sm py-4 text-center border border-border dark:border-border rounded-md p-6 bg-muted/20">
          No related pages found with matching words in the title.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6">
      <h3 className="text-lg font-medium mb-4">Related Pages</h3>
      <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
