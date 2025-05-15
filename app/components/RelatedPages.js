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

          // Only focus on title word matching
          // Extract significant words from the title
          const titleWords = page.title
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length >= 2) // Include words of at least 2 characters
            .filter(word => !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'to', 'of', 'in', 'on', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could'].includes(word));

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
          console.log(`Analyzing ${pagesSnapshot.docs.length} public pages for title matches`);

          // Array to store pages with matching titles
          const matchingPages = [];

          // Process each page
          pagesSnapshot.docs.forEach(doc => {
            const pageData = { id: doc.id, ...doc.data() };

            // Skip the current page
            if (pageData.id === page.id) return;

            // Skip pages without titles
            if (!pageData.title) return;

            // Check for word matches in the title
            const pageTitle = pageData.title.toLowerCase();
            const pageTitleWords = pageTitle
              .split(/\s+/)
              .filter(word => word.length >= 2)
              .filter(word => !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'to', 'of', 'in', 'on', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could'].includes(word));

            // Find exact word matches
            const exactMatches = titleWords.filter(word =>
              pageTitleWords.includes(word)
            );

            // Only include pages with at least one exact word match
            if (exactMatches.length > 0) {
              // Calculate a simple match count for sorting
              const matchCount = exactMatches.length;

              matchingPages.push({
                ...pageData,
                matchCount
              });
            }
          });

          // Filter out pages that are already linked in the content
          const filteredPages = matchingPages
            .filter(page => !linkedPageIds.includes(page.id))
            .sort((a, b) => {
              // Sort by match count first
              if (b.matchCount !== a.matchCount) {
                return b.matchCount - a.matchCount;
              }
              // Then by last modified date if available
              return (b.lastModified ? new Date(b.lastModified) : 0) -
                     (a.lastModified ? new Date(a.lastModified) : 0);
            })
            .slice(0, maxPages);

          console.log(`Found ${filteredPages.length} related pages with title matches`);

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
      <h3 className="text-lg font-medium mb-4">Related Pages</h3>

      {!mounted || isLoading ? (
        // Loading state - fixed height placeholder
        <div className="flex justify-center items-center py-4 border border-border/40 rounded-lg h-[100px]">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        </div>
      ) : relatedPages.length > 0 ? (
        // Results state - fixed height container with overflow
        <div className="flex flex-wrap gap-2 py-4 border border-border/40 rounded-lg min-h-[100px] max-h-[200px] overflow-y-auto">
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
        // Empty state - fixed height placeholder
        <div className="flex justify-center items-center py-4 border border-border/40 rounded-lg h-[100px] text-muted-foreground">
          No related pages found
        </div>
      )}
    </div>
  );
}
