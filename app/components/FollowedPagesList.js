"use client";

import React, { useState, useEffect } from 'react';
import { getFollowedPages, unfollowPage } from '../firebase/follows';
import { db } from '../firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { PillLink } from './PillLink';
import { Loader, Heart, UserMinus, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useAuth } from '../providers/AuthProvider';

/**
 * FollowedPagesList Component
 *
 * Displays a list of pages that a user follows with unfollow buttons
 *
 * @param {Object} props
 * @param {string} props.userId - The ID of the user whose followed pages to display
 * @param {boolean} props.showUnfollowButtons - Whether to show unfollow buttons
 * @param {Function} props.onUnfollow - Callback when a page is unfollowed
 */
export default function FollowedPagesList({ userId, showUnfollowButtons = true, onUnfollow }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unfollowingIds, setUnfollowingIds] = useState([]);
  const { user } = useAuth();

  // Check if this is the current user's list
  const isCurrentUser = user && user.uid === userId;

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
        const pagePromises = followedPageIds.map(async (pageId) => {
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
  }, [userId]);

  const handleUnfollow = async (pageId, pageTitle) => {
    if (!user) return;

    // Add to unfollowing state to show loading
    setUnfollowingIds(prev => [...prev, pageId]);

    try {
      await unfollowPage(user.uid, pageId);

      // Remove the page from the list
      setPages(prev => prev.filter(page => page.id !== pageId));

      // Call the callback if provided
      if (onUnfollow) {
        onUnfollow(pageId);
      }

      toast.success(`Unfollowed "${pageTitle || 'Untitled Page'}"`);
    } catch (error) {
      console.error('Error unfollowing page:', error);
      toast.error('Failed to unfollow page. Please try again.');
    } finally {
      // Remove from unfollowing state
      setUnfollowingIds(prev => prev.filter(id => id !== pageId));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg">
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
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
          {isCurrentUser
            ? "When you follow pages, they'll appear here so you can easily find them later."
            : "This user hasn't followed any pages yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Heart className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Followed Pages</h3>
      </div>

      <div className="space-y-2">
        {pages.map(page => (
          <div key={page.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-accent/50 group">
            <div className="flex-1 min-w-0">
              <PillLink
                href={`/${page.id}`}
                className="max-w-full inline-block"
              >
                {page.title || 'Untitled Page'}
              </PillLink>
            </div>

            {showUnfollowButtons && isCurrentUser && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => handleUnfollow(page.id, page.title)}
                disabled={unfollowingIds.includes(page.id)}
                title="Unfollow page"
              >
                {unfollowingIds.includes(page.id) ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <UserMinus className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                )}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
