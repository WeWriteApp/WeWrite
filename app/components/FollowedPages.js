"use client";

import React, { useState, useEffect } from 'react';
import { getFollowedPages } from '../firebase/follows';
import { db } from '../firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { PillLink } from './PillLink';
import { Loader, Heart } from 'lucide-react';

/**
 * FollowedPages Component
 *
 * Displays a list of pages that a user follows
 *
 * @param {Object} props
 * @param {string} props.userId - The ID of the user whose followed pages to display
 * @param {number} props.limit - Maximum number of pages to display
 */
export default function FollowedPages({ userId, limit = 10 }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFollowedPages = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Get the IDs of pages the user follows
        const followedPageIds = await getFollowedPages(userId);

        if (followedPageIds.length === 0) {
          setPages([]);
          setLoading(false);
          return;
        }

        // Fetch details for each page
        const pagePromises = followedPageIds.slice(0, limit).map(async (pageId) => {
          try {
            const pageRef = doc(db, 'pages', pageId);
            const pageDoc = await getDoc(pageRef);

            if (pageDoc.exists()) {
              return {
                id: pageDoc.id,
                ...pageDoc.data()
              };
            }
            return null;
          } catch (err) {
            console.error(`Error fetching page ${pageId}:`, err);
            return null;
          }
        });

        const pageResults = await Promise.all(pagePromises);
        const validPages = pageResults.filter(page => page !== null);

        setPages(validPages);
      } catch (err) {
        console.error('Error fetching followed pages:', err);
        setError('Failed to load followed pages');
      } finally {
        setLoading(false);
      }
    };

    fetchFollowedPages();
  }, [userId, limit]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        {error}
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Heart className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-lg font-medium mb-2">No followed pages yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          When you follow pages, they'll appear here so you can easily find them later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Heart className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Followed Pages</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {pages.map(page => (
          <div key={page.id} className="flex-none max-w-full">
            <PillLink
              href={`/pages/${page.id}`}
              className="max-w-[200px] sm:max-w-[250px] md:max-w-[300px]"
            >
              {page.title || 'Untitled Page'}
            </PillLink>
          </div>
        ))}
      </div>
    </div>
  );
}
