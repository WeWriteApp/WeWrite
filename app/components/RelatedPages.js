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
            .filter(word => !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'to', 'of', 'in', 'on', 'by', 'as'].includes(word));
          
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
                
                for (const word of titleWords) {
                  if (pageTitle.includes(word)) {
                    relevanceScore += 1;
                    
                    // Exact word match gets higher score
                    if (pageTitle.split(/\s+/).includes(word)) {
                      relevanceScore += 1;
                    }
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
        
        // Convert to array, sort by relevance score, and limit
        const sortedPages = Array.from(pageMap.values())
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
      <div className="mt-8 pt-6 border-t">
        <h3 className="text-lg font-medium mb-4">Related Pages</h3>
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        </div>
      </div>
    );
  }

  if (relatedPages.length === 0) {
    return null; // Don't show the section if there are no related pages
  }

  return (
    <div className="mt-8 pt-6 border-t">
      <h3 className="text-lg font-medium mb-4">Related Pages</h3>
      <div className="flex flex-wrap gap-2">
        {relatedPages.map(page => (
          <div key={page.id} className="flex-none max-w-full">
            <PillLink
              key={page.id}
              href={`/pages/${page.id}`}
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
