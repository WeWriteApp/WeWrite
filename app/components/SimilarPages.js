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
        // Extract meaningful keywords from the title (words with 3+ characters)
        const titleWords = currentPage.title
          .toLowerCase()
          .split(/\\s+/)
          .filter(word => word.length >= 3)
          .filter(word => !['the', 'and', 'for', 'with', 'this', 'that', 'from'].includes(word));

        if (titleWords.length === 0) {
          setLoading(false);
          return;
        }

        // Create queries for each significant word in the title
        const queries = [];
        
        for (const word of titleWords) {
          // Skip very common words or short words
          if (word.length < 3) continue;
          
          // Create a query for titles containing this word
          const titleQuery = query(
            collection(db, 'pages'),
            where('title', '>=', word),
            where('title', '<=', word + '\\uf8ff'),
            limit(5)
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

  if (similarPages.length === 0) {
    return null; // Don't show the section if no similar pages found
  }

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="text-lg font-medium mb-4">Similar Pages</h3>
      <div className="space-y-2">
        {similarPages.map(page => (
          <PillLink 
            key={page.id} 
            href={`/${page.id}`}
            className="w-full"
          >
            {page.title}
          </PillLink>
        ))}
      </div>
    </div>
  );
}
