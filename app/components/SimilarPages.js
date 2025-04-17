"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { PillLink } from './PillLink';
import { Loader } from './Loader';

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
        let titleWords = [currentPage.title.toLowerCase()];

        // Add individual words
        const individualWords = currentPage.title
          .toLowerCase()
          .split(/\s+/)
          .filter(word => word.length >= 2)
          .filter(word => !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'to', 'of', 'in', 'on', 'by', 'as'].includes(word));

        // Combine full title and individual words for better search coverage
        titleWords = [...titleWords, ...individualWords];

        if (titleWords.length === 0) {
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
            collection(db, 'pages'),
            where('title', '>=', word),
            where('title', '<=', word + '\uf8ff'),
            where('isPublic', '==', true),
            limit(20)
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

            // If we already have this page, increment its relevance score
            if (pageMap.has(pageData.id)) {
              const existing = pageMap.get(pageData.id);
              pageMap.set(pageData.id, {
                ...existing,
                relevanceScore: existing.relevanceScore + 1
              });
            } else {
              // Otherwise, add it with a score of 1
              pageMap.set(pageData.id, { ...pageData, relevanceScore: 1 });
            }
          });
        });

        // Convert to array, sort by relevance score, and limit
        const sortedPages = Array.from(pageMap.values())
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
      <div className="mt-8 border-t pt-6">
        <h3 className="text-lg font-medium mb-4">Similar Pages</h3>
        <div className="flex justify-center py-4">
          <Loader size="sm" />
        </div>
      </div>
    );
  }

  if (similarPages.length === 0 && !loading) {
    return (
      <div className="mt-8 border-t pt-6">
        <h3 className="text-lg font-medium mb-4">Similar Pages</h3>
        <div className="text-muted-foreground text-sm py-4 text-center border rounded-md p-6 bg-muted/20">
          No similar pages found. Be the first to create related content!
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t pt-6">
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
