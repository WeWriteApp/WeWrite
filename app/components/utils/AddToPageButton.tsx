"use client";

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Icon } from '@/components/ui/Icon';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '../ui/drawer';
import FilteredSearchResults from '../search/FilteredSearchResults';
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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isCreatingNewPage, setIsCreatingNewPage] = useState<boolean>(false);
  const { user } = useAuth();
  const router = useRouter();

  // Determine which state to use
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalSetIsOpen || setInternalIsOpen;

  const handleClose = (): void => {
    if (!isAdding && !isCreatingNewPage) {
      setIsOpen(false);
      setSearchQuery("");
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

  // Handle creating a new page with the source content already appended
  const handleCreateNewPage = async (): Promise<void> => {
    if (!user || !page || !searchQuery.trim()) return;

    setIsCreatingNewPage(true);

    try {
      // 1. Check rate limiting
      if (!checkRateLimit(user.uid)) {
        toast.error(ERROR_MESSAGES.rate_limit_exceeded);
        setIsCreatingNewPage(false);
        return;
      }

      // 2. Validate source page content size
      const sourceContent = page.content || [];
      const contentString = typeof sourceContent === 'string' ? sourceContent : JSON.stringify(sourceContent);

      if (contentString.length > MAX_CONTENT_SIZE) {
        toast.error(ERROR_MESSAGES.content_too_large);
        setIsCreatingNewPage(false);
        return;
      }

      if (Array.isArray(sourceContent) && sourceContent.length > MAX_CONTENT_BLOCKS) {
        toast.error(ERROR_MESSAGES.too_many_blocks);
        setIsCreatingNewPage(false);
        return;
      }

      // 3. Create the new page with content that includes a link to the source page
      // Build initial content with a page link to the source
      const initialContent = [
        {
          type: "paragraph",
          children: [
            { text: "From " },
            {
              type: "pageLink",
              pageId: page.id,
              displayText: page.title || 'Untitled',
              children: [{ text: page.title || 'Untitled' }]
            },
            { text: ":" }
          ]
        },
        { type: "paragraph", children: [{ text: "" }] },
        // Include the source page's content
        ...(Array.isArray(sourceContent) ? sourceContent : [])
      ];

      // 4. Create the page via API
      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: searchQuery.trim(),
          content: initialContent,
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create page');
      }

      const result = await response.json();
      const newPageId = result.data?.id || result.id;

      if (newPageId) {
        // Close the drawer and redirect to the new page
        setIsOpen(false);
        setSearchQuery("");
        toast.success(`Created "${searchQuery.trim()}" with "${page.title}" added`);
        router.push(`/${newPageId}`);
      } else {
        throw new Error('No page ID returned');
      }
    } catch (error: any) {
      console.error("Error creating new page:", error);
      toast.error(error.message || ERROR_MESSAGES.unknown_error);
    } finally {
      setIsCreatingNewPage(false);
    }
  };

  // Don't render if no page data
  if (!page) return null;

  // Handle click - show toast if user not logged in
  const handleClick = () => {
    if (!user) {
      toast.error("Please sign in to add this page to another page");
      return;
    }
    setIsOpen(true);
  };

  return (
    <>
      {!hideButton && (
        <Button
          variant="default"
          size="lg"
          className={`gap-2 w-full md:w-auto rounded-2xl font-medium ${className}`}
          onClick={handleClick}
          disabled={isAdding}
          aria-label={`Add "${page?.title || 'this page'}" to another page`}
        >
          <Icon name="Copy" size={20} />
          <span>Add this page to another page</span>
        </Button>
      )}

      <Drawer
        open={isOpen}
        onOpenChange={(open) => {
          if (!isAdding && !isCreatingNewPage) {
            setIsOpen(open);
            if (!open) setSearchQuery("");
          }
        }}
        hashId="add-to-page"
      >
        <DrawerContent
          height="95vh"
          accessibleTitle="Add to another page"
        >
          <DrawerHeader>
            <DrawerTitle>Add to another page</DrawerTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Select a page to add "{page?.title || 'this page'}" to.
            </p>
          </DrawerHeader>

          {/* Tappable area to dismiss keyboard - clicking here blurs any focused input */}
          <div
            className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col"
            onMouseDown={(e) => {
              // If user taps on the container (not on an interactive element), blur active element to dismiss keyboard
              const target = e.target as HTMLElement;
              if (!target.closest('input') && !target.closest('button') && !target.closest('[role="option"]')) {
                (document.activeElement as HTMLElement)?.blur?.();
              }
            }}
          >
            {isAdding || isCreatingNewPage ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Icon name="Loader" size={32} className="text-primary mb-3" />
                <p className="text-sm text-muted-foreground">
                  {isCreatingNewPage ? "Creating page..." : "Adding page..."}
                </p>
              </div>
            ) : (
              <>
                <div className="flex-1 min-h-0 overflow-auto">
                  <FilteredSearchResults
                    onSelect={handlePageSelect}
                    userId={user?.uid}
                    placeholder="Search your pages..."
                    editableOnly={true}
                    preventRedirect={true}
                    autoFocus={false}
                    hideCreateButton={true}
                    currentPageId={page?.id}
                    maxResults={50}
                    onInputChange={(value: string) => setSearchQuery(value)}
                  />
                </div>

                {/* Create new page button - shown when user types a search query */}
                {searchQuery.trim().length >= 2 && (
                  <div className="flex-shrink-0 pt-4 border-t border-border mt-4">
                    <Button
                      variant="secondary"
                      className="w-full justify-center gap-2"
                      onClick={handleCreateNewPage}
                      disabled={isCreatingNewPage}
                    >
                      <Icon name="Plus" size={16} />
                      <span>Create new page called "{searchQuery.trim()}"</span>
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default AddToPageButton;
