"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from "../../firebase/config';
import { getCollectionName } from '../../utils/environmentConfig';
import PillLink from "../utils/PillLink";
// Removed Loader import - using simple loading state

/**
 * SimilarPages Component
 *
 * Displays a list of pages with similar titles to the current page.
 * Uses the page title to find other pages with similar content.
 *
 * @param {Object} currentPage - The current page object
 * @param {number} maxPages - Maximum number of similar pages to display (default: 3)
 */
export default function SimilarPages({ currentPage, maxPages = 3 }) {
  const [similarPages, setSimilarPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSimilarPages() {
      if (!currentPage || !currentPage.title) {
        setLoading(false);
        return;
      }

      try {
        // Extract all words from the title for better search coverage
        // Include the full title as a search term as well
        let titleWords = [];

        // Add individual words
        const individualWords = currentPage.title
          .toLowerCase()
          .split(/\s+/)
          .filter(word => word.length >= 3)
          .filter(word => !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'to', 'of', 'in', 'on', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could'].includes(word));

        // Use individual words for better search coverage
        titleWords = [...individualWords];

        if (titleWords.length === 0) {
          // If no significant words, use a generic query
          const genericQuery = query(
            collection(db, getCollectionName('pages')),
            where('isPublic', '==', true),
            where('deleted', '!=', true),
            orderBy('lastModified', 'desc'),
            limit(maxPages * 2)
          );

          const snapshot = await getDocs(genericQuery);
          const pages = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(page => page.id !== currentPage.id)
            .slice(0, maxPages);

          setSimilarPages(pages);
          setLoading(false);
          return;
        }

        // Create queries for each significant word in the title
        const queries = [];

        for (const word of titleWords) {
          // Skip very short words
          if (word.length < 2) continue;

          // Create a query for titles containing this word
          const titleQuery = query(
            collection(db, getCollectionName('pages')),
            where('isPublic', '==', true),
            where('deleted', '!=', true),
            orderBy('title'),
            limit(50)
          );

          queries.push(titleQuery);
        }

        // Execute all queries
        const queryResults = await Promise.all(
          queries.map(q => getDocs(q))
        );

        // Combine and deduplicate results
        const pageMap = new Map();

        queryResults.forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            const pageData = { id: doc.id, ...doc.data() };

            // Skip the current page
            if (pageData.id === currentPage.id) return;

            // Calculate relevance score based on title similarity
            let relevanceScore = 0;

            // Check if title contains any of the search words
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
              if (pageTitle.includes(word) && !pageTitleWords.includes(word)) {
                relevanceScore += 0.5; // Lower score for partial matches
              }
            }

            // If no direct match but we want to include it anyway with low score
            if (relevanceScore === 0) {
              relevanceScore = 0.1;
            }

            // If we already have this page, keep the higher relevance score
            if (pageMap.has(pageData.id)) {
              const existing = pageMap.get(pageData.id);
              if (relevanceScore > existing.relevanceScore) {
                pageMap.set(pageData.id, {
                  ...existing,
                  relevanceScore: relevanceScore
                });
              }
            } else {
              // Otherwise, add it with its calculated score
              pageMap.set(pageData.id, { ...pageData, relevanceScore });
            }
          });
        });

        // Convert to array, filter out pages with low relevance, sort by relevance score, and limit
        const sortedPages = Array.from(pageMap.values())
          // Only include pages with significant relevance (prioritizing exact matches)
          .filter(page => page.relevanceScore >= 5)
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, maxPages);

        setSimilarPages(sortedPages);
      } catch (error) {
        console.error('Error fetching similar pages:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSimilarPages();
  }, [currentPage, maxPages]);

  if (loading) {
    return (
      <div className="mt-8 pt-6 border-t border-border dark:border-border">
        <h3 className="text-lg font-medium mb-4">Similar Pages</h3>
        <div className="flex justify-center py-4">
          <div className="loader loader-sm"></div>
        </div>
      </div>
    );
  }

  if (similarPages.length === 0 && !loading) {
    return (
      <div className="mt-8 pt-6 border-t border-border dark:border-border">
        <h3 className="text-lg font-medium mb-4">Similar Pages</h3>
        <div className="text-muted-foreground text-sm py-4 text-center border-theme-medium rounded-md p-6 bg-muted/20">
          No similar pages found with matching words in the title.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6 border-t border-border dark:border-border">
      <h3 className="text-lg font-medium mb-4">Similar Pages</h3>
      <div className="space-y-2">
        {similarPages.map(page => (
          <PillLink
            key={page.id}
            href={`/${page.id}`}
            className="inline-block"
          >
            {page.title}
          </PillLink>
        ))}
      </div>
    </div>
  );
}