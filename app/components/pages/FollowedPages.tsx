"use client";

import React, { useState, useEffect, useContext } from 'react';
import { getFollowedPages, unfollowPage } from "../../firebase/follows";
import { db } from "../../firebase/database";
import { doc, getDoc } from 'firebase/firestore';
import { PillLink } from "../utils/PillLink";
import { Loader, Heart, X, Plus, RefreshCw } from 'lucide-react';
import { Button } from "../ui/button";
import { AuthContext } from "../../providers/AuthProvider";
import { toast } from "../ui/use-toast";
import UnfollowConfirmationDialog from '../utils/UnfollowConfirmationDialog';
import { ErrorDisplay } from "../ui/error-display";

interface Page {
  id: string;
  title: string;
  isPublic?: boolean;
  userId?: string;
  [key: string]: any;
}

interface FollowedPagesProps {
  userId: string;
  limit?: number;
  isCurrentUser?: boolean;
  showHeader?: boolean;
  className?: string;
  onPageUnfollowed?: () => void;
}

/**
 * FollowedPages Component
 *
 * Displays a list of pages that a user follows with unfollow functionality
 */
export default function FollowedPages({
  userId,
  limit = 50,
  isCurrentUser = false,
  showHeader = true,
  className = "",
  onPageUnfollowed
}: FollowedPagesProps) {
  const { user } = useContext(AuthContext);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);
  const [showUnfollowDialog, setShowUnfollowDialog] = useState(false);
  const [pageToUnfollow, setPageToUnfollow] = useState<Page | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Privacy restriction: Only load followed pages for the current user
    if (!isCurrentUser) {
      setLoading(false);
      setError("This information is private");
      return;
    }

    loadFollowedPages();
  }, [userId, isCurrentUser]);

  const loadFollowedPages = async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setPage(1);
      }

      setError(null);

      // Get the IDs of pages the user follows
      const followedPageIds = await getFollowedPages(userId);

      if (followedPageIds.length === 0) {
        setPages([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      // Calculate pagination
      const currentPage = loadMore ? page + 1 : 1;
      const startIndex = 0;
      const endIndex = currentPage * limit;
      const paginatedIds = followedPageIds.slice(startIndex, endIndex);

      // Check if there are more pages to load
      setHasMore(followedPageIds.length > endIndex);

      // Fetch details for each page
      const pagePromises = paginatedIds.map(async (pageId) => {
        try {
          const pageRef = doc(db, 'pages', pageId);
          const pageDoc = await getDoc(pageRef);

          if (pageDoc.exists()) {
            return {
              id: pageId,
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
      const validPages = pageResults.filter(page => page !== null) as Page[];

      if (loadMore) {
        setPages(prev => [...prev, ...validPages]);
        setPage(currentPage);
      } else {
        setPages(validPages);
      }
    } catch (err) {
      console.error('Error fetching followed pages:', err);
      setError('Failed to load followed pages');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleUnfollowClick = (page: Page) => {
    setPageToUnfollow(page);
    setShowUnfollowDialog(true);
  };

  const handleUnfollow = async () => {
    if (!user || !pageToUnfollow) return;

    try {
      setUnfollowingId(pageToUnfollow.id);

      // Call the unfollow function
      await unfollowPage(user.uid, pageToUnfollow.id);

      // Update the local state
      setPages(prev => prev.filter(p => p.id !== pageToUnfollow.id));

      // Close the dialog
      setShowUnfollowDialog(false);

      // Show success toast
      toast.info(`You are no longer following "${pageToUnfollow.title || 'Untitled Page'}"`);

      // Call the callback if provided
      if (onPageUnfollowed) {
        onPageUnfollowed();
      }
    } catch (err) {
      console.error('Error unfollowing page:', err);
      toast.error('Failed to unfollow page. Please try again.');
    } finally {
      setUnfollowingId(null);
      setPageToUnfollow(null);
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
      <div className="p-2">
        <ErrorDisplay
          message={error}
          severity="warning"
          showDetails={false}
          showRetry={true}
          onRetry={() => loadFollowedPages()}
        />
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 px-4 text-center ${className}`}>
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Heart className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-lg font-medium mb-2">No followed pages yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          {isCurrentUser
            ? "When you follow pages, they'll appear here so you can easily find them later."
            : "This user isn't following any pages yet."}
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {showHeader && (
        <div className="flex items-center gap-2 mb-2">
          <Heart className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Followed Pages</h3>
        </div>
      )}

      <div className="flex flex-col space-y-2">
        {pages.map(page => (
          <div
            key={page.id}
            className="flex items-center justify-between p-3 rounded-md border border-border/40 hover:bg-muted/50 transition-colors"
          >
            <PillLink
              href={`/pages/${page.id}`}
              variant="primary"
              isPublic={page.isPublic}
              className="max-w-[200px] sm:max-w-[250px] md:max-w-[300px]"
            >
              {page.title || 'Untitled Page'}
            </PillLink>

            {isCurrentUser && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-2"
                onClick={() => handleUnfollowClick(page)}
                disabled={unfollowingId === page.id}
              >
                {unfollowingId === page.id ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                <span className="sr-only">Unfollow</span>
              </Button>
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button
            variant="outline"
            onClick={() => loadFollowedPages(true)}
            disabled={loadingMore}
            className="w-full"
          >
            {loadingMore ? (
              <>
                <Loader className="h-4 w-4 animate-spin mr-2" />
                Loading more...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Load more
              </>
            )}
          </Button>
        </div>
      )}

      {/* Unfollow Confirmation Dialog */}
      <UnfollowConfirmationDialog
        isOpen={showUnfollowDialog}
        onClose={() => setShowUnfollowDialog(false)}
        onConfirm={handleUnfollow}
        isLoading={!!unfollowingId}
        type="page"
        name={pageToUnfollow?.title || 'this page'}
      />
    </div>
  );
}
