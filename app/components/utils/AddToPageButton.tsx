"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Icon } from '@/components/ui/Icon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '../ui/dialog';
import { useUnifiedSearch, SEARCH_CONTEXTS } from '../../hooks/useUnifiedSearch';

import { useAuth } from '../../providers/AuthProvider';
import { appendPageReference, getPageById } from '../../utils/apiClient';
import { toast } from '../ui/use-toast';
import { useRouter } from 'next/navigation';
import { canUserEditPage } from '../../utils/pagePermissions';
import type { Page } from '../../types/database';

// Constants for content validation
const MAX_CONTENT_SIZE = 50000; // Maximum characters for content to append
const MAX_CONTENT_BLOCKS = 100; // Maximum number of content blocks

// Rate limiting constants
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
const MAX_OPERATIONS_PER_WINDOW = 5; // Maximum append operations per minute

// Simple in-memory rate limiting (for client-side protection)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

// Error messages for better UX
const ERROR_MESSAGES = {
  permission_denied: "You don't have permission to edit this page",
  page_not_found: "The target page could not be found",
  content_too_large: "The content is too large to append to this page",
  too_many_blocks: "The content has too many blocks to append",
  rate_limit_exceeded: "Too many operations. Please wait a moment before trying again",
  network_error: "Network error. Please check your connection and try again",
  unknown_error: "An unexpected error occurred. Please try again"
} as const;

// Rate limiting function
const checkRateLimit = (userId: string): boolean => {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit) {
    // First operation for this user
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }

  // Check if we're still in the same window
  if (now - userLimit.windowStart < RATE_LIMIT_WINDOW) {
    if (userLimit.count >= MAX_OPERATIONS_PER_WINDOW) {
      return false; // Rate limit exceeded
    }
    userLimit.count++;
    return true;
  } else {
    // New window, reset counter
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }
};

// TypeScript interfaces
interface AddToPageButtonProps {
  page: Page;
  className?: string;
  isOpen?: boolean;
  setIsOpen?: (isOpen: boolean) => void;
  hideButton?: boolean;
}

interface SelectedPage {
  id: string;
  title: string;
  userId?: string;
  groupId?: string;
}

const AddToPageButton: React.FC<AddToPageButtonProps> = ({
  page,
  className = "",
  isOpen: externalIsOpen,
  setIsOpen: externalSetIsOpen,
  hideButton = false
}) => {
  // Use external state if provided, otherwise use internal state
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const { user } = useAuth();
  const router = useRouter();

  // Determine which state to use
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalSetIsOpen || setInternalIsOpen;

  const handleClose = (): void => {
    if (!isAdding) {
      setIsOpen(false);
    }
  };

  // Handle page selection - immediately trigger the append operation
  const handlePageSelect = async (selected: SelectedPage): Promise<void> => {
    if (!selected || !page || !user) return;

    setIsAdding(true);

    try {
      // 1. Check rate limiting
      if (!checkRateLimit(user.uid)) {
        toast.error(ERROR_MESSAGES.rate_limit_exceeded);
        setIsAdding(false);
        return;
      }

      // 2. Fetch the target page to check permissions and validate
      const { pageData: targetPageData, error: fetchError } = await getPageById(selected.id);

      if (fetchError || !targetPageData) {
        toast.error(ERROR_MESSAGES.page_not_found);
        setIsAdding(false);
        return;
      }

      // 3. Check if user has permission to edit the target page
      const canEdit = canUserEditPage(user, targetPageData);
      if (!canEdit) {
        toast.error(ERROR_MESSAGES.permission_denied);
        setIsAdding(false);
        return;
      }

      // 4. Validate source page content size
      const sourceContent = page.content || [];
      const contentString = typeof sourceContent === 'string' ? sourceContent : JSON.stringify(sourceContent);

      if (contentString.length > MAX_CONTENT_SIZE) {
        toast.error(ERROR_MESSAGES.content_too_large);
        setIsAdding(false);
        return;
      }

      if (Array.isArray(sourceContent) && sourceContent.length > MAX_CONTENT_BLOCKS) {
        toast.error(ERROR_MESSAGES.too_many_blocks);
        setIsAdding(false);
        return;
      }

      // 5. Create a source page data object with the current page info
      const sourcePageData = {
        id: page.id,
        title: page.title || 'Untitled Page',
        content: page.content,
        userId: page.userId
      };

      // 6. Append the current page reference to the selected page
      const result = await appendPageReference(selected.id, sourcePageData, user.uid);

      if (result) {
        // Close the dialog and redirect to the target page
        setIsOpen(false);
        toast.success(`Added "${page.title}" to "${selected.title}"`);
        router.push(`/${selected.id}`);
      } else {
        toast.error(ERROR_MESSAGES.unknown_error);
      }
    } catch (error: any) {
      console.error("Error adding page:", error);

      // Provide specific error messages based on error type
      let errorMessage = ERROR_MESSAGES.unknown_error;

      if (error.message?.includes('permission') || error.message?.includes('access')) {
        errorMessage = ERROR_MESSAGES.permission_denied;
      } else if (error.message?.includes('not found')) {
        errorMessage = ERROR_MESSAGES.page_not_found;
      } else if (error.name === 'NetworkError' || error.message?.includes('network')) {
        errorMessage = ERROR_MESSAGES.network_error;
      }

      toast.error(errorMessage);
    } finally {
      setIsAdding(false);
    }
  };

  if (!user || !page) return null;

  return (
    <>
      {!hideButton && (
        <Button
          variant="default"
          size="lg"
          className={`gap-2 w-full md:w-auto rounded-2xl font-medium ${className}`}
          onClick={() => setIsOpen(true)}
          disabled={isAdding}
          aria-label={`Add "${page?.title || 'this page'}" to another page`}
        >
          <Icon name="Copy" size={20} />
          <span>Add this page to another page</span>
        </Button>
      )}

      <Dialog
        open={isOpen}
        onOpenChange={(open) => !isAdding && setIsOpen(open)}
        hashId="add-to-page"
      >
        <DialogContent showCloseButton className="max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Add to another page</DialogTitle>
          </DialogHeader>

          <DialogBody className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select a page to add "{page?.title || 'this page'}" to. You can only add to pages you have permission to edit.
            </p>

            {isAdding ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Icon name="Loader" size={32} className="text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Adding page...</p>
              </div>
            ) : (
              <AddToPageSearch onSelect={handlePageSelect} disabled={isAdding} />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Search component for Add to Page functionality
const AddToPageSearch = ({
  onSelect,
  disabled
}: {
  onSelect: (page: SelectedPage) => void;
  disabled?: boolean;
}) => {
  const { user } = useAuth();
  const userId = user?.uid;
  const [recentPages, setRecentPages] = useState<any[]>([]);
  const [recentPagesLoading, setRecentPagesLoading] = useState<boolean>(true);

  const { currentQuery, results, isLoading, performSearch } = useUnifiedSearch(userId, {
    context: SEARCH_CONTEXTS.ADD_TO_PAGE,
    includeContent: false,
    includeUsers: false,
    maxResults: 50
  });

  // Fetch recent pages on component mount
  useEffect(() => {
    const fetchRecentPages = async () => {
      if (!userId) {
        setRecentPagesLoading(false);
        return;
      }

      try {
        setRecentPagesLoading(true);
        const response = await fetch(`/api/recent-edits/user?userId=${userId}&limit=10`);

        if (!response.ok) {
          throw new Error(`Failed to fetch recent pages: ${response.status}`);
        }

        const data = await response.json();

        // Filter to only show editable pages (user's own pages)
        const editableRecentPages = (data.pages || []).filter((page: any) =>
          page.userId === userId || page.isEditable
        );

        setRecentPages(editableRecentPages);
      } catch (error) {
        console.error('Error fetching recent pages:', error);
        setRecentPages([]);
      } finally {
        setRecentPagesLoading(false);
      }
    };

    fetchRecentPages();
  }, [userId]);

  // Filter search results to only show editable pages
  const editableSearchPages = results.pages?.filter(page =>
    page.userId === userId || page.isEditable
  ) || [];

  // Determine what to show: search results if there's a query, otherwise recent pages
  const showSearchResults = currentQuery && currentQuery.trim().length > 0;
  const pagesToShow = showSearchResults ? editableSearchPages : recentPages;
  const isLoadingPages = showSearchResults ? isLoading : recentPagesLoading;

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search your pages..."
        className="w-full px-3 py-2 border border-input rounded-md bg-background"
        onChange={(e) => performSearch(e.target.value)}
        disabled={disabled}
        aria-label="Search for pages to add content to"
      />

      {/* Show section header */}
      {!isLoadingPages && (
        <div className="text-sm font-medium text-muted-foreground">
          {showSearchResults ? 'Search Results' : 'Recently Visited Pages'}
        </div>
      )}

      {isLoadingPages && (
        <div className="text-center py-4">
          <Icon name="Loader" size={24} className="mx-auto" />
        </div>
      )}

      {pagesToShow.length > 0 && (
        <div className="max-h-60 overflow-y-auto space-y-2">
          {pagesToShow.map((page) => (
            <button
              key={page.id}
              onClick={() => onSelect(page)}
              disabled={disabled}
              className="w-full text-left p-3 rounded-md border border-input hover:bg-accent transition-colors break-words whitespace-normal disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="font-medium break-words whitespace-normal">{page.title || 'Untitled'}</div>
              {page.username && (
                <div className="text-sm text-muted-foreground break-words whitespace-normal">by {page.username}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {showSearchResults && !isLoading && editableSearchPages.length === 0 && (
        <div className="text-center py-4 text-muted-foreground">
          No editable pages found
        </div>
      )}

      {!showSearchResults && !recentPagesLoading && recentPages.length === 0 && (
        <div className="text-center py-4 text-muted-foreground">
          No recent pages found. Start typing to search your pages.
        </div>
      )}
    </div>
  );
};

export default AddToPageButton;
