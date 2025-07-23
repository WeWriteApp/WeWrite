"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Plus, X, Quote } from 'lucide-react';
import Modal from '../ui/modal';
import { useUnifiedSearch, SEARCH_CONTEXTS } from '../../hooks/useUnifiedSearch';
import SearchResultsDisplay from '../search/SearchResultsDisplay';

import { useAuth } from '../../providers/AuthProvider';
import { appendPageReference, getPageById } from '../../firebase/database';
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

// Audit logging function
const logAppendOperation = (
  userId: string,
  sourcePageId: string,
  targetPageId: string,
  success: boolean,
  error?: string
): void => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId,
    action: 'append_page',
    sourcePageId,
    targetPageId,
    success,
    error: error || null,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
  };

  // In a production environment, this would go to a proper logging service:
  // await fetch('/api/audit-log', { method: 'POST', body: JSON.stringify(logEntry) });
};

/**
 * WeWrite Page Button Consistency Fix - Enhanced AddToPageButton Component
 *
 * Enhanced AddToPageButton component that supports external state management
 * to enable consistent functionality between top navigation and bottom page buttons.
 *
 * Key Enhancements:
 * - External State Management: Supports isOpen and setIsOpen props for external control
 * - Conditional Rendering: hideButton prop allows modal-only usage
 * - Consistent Behavior: Same modal functionality regardless of trigger location
 * - Proper State Handling: Uses external state when provided, internal state otherwise
 *
 * Usage Patterns:
 * 1. Standalone Button (original behavior):
 *    <AddToPageButton page={page} />
 *
 * 2. External State Management (for top navigation):
 *    <AddToPageButton
 *      page={page}
 *      isOpen={isAddToPageOpen}
 *      setIsOpen={setIsAddToPageOpen}
 *      hideButton={true}
 *    />
 *
 * This enhancement enables the PageHeader component to use the same modal
 * functionality as the bottom page buttons, ensuring consistent user experience.
 */

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
  const [selectedPage, setSelectedPage] = useState<SelectedPage | null>(null);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [successTargetPage, setSuccessTargetPage] = useState<SelectedPage | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  // Determine which state to use
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalSetIsOpen || setInternalIsOpen;

  const handleAddToPage = async (selected: SelectedPage): Promise<void> => {
    if (!selected || !page) return;

    // Store the selected page for the Insert button
    setSelectedPage(selected);
  };

  const handleGoToTargetPage = (): void => {
    if (successTargetPage) {
      router.push(`/${successTargetPage.id}`);
      handleClose();
    }
  };

  const handleClose = (): void => {
    setIsOpen(false);
    setSelectedPage(null);
    setShowSuccess(false);
    setSuccessTargetPage(null);
  };

  const handleInsert = async (): Promise<void> => {
    if (!selectedPage || !page) return;

    setIsAdding(true);

    try {
      // 1. Check rate limiting
      if (!checkRateLimit(user.uid)) {
        toast.error(ERROR_MESSAGES.rate_limit_exceeded);
        return;
      }

      // 2. Fetch the target page to check permissions and validate
      const { pageData: targetPageData, error: fetchError } = await getPageById(selectedPage.id);
      
      if (fetchError || !targetPageData) {
        toast.error(ERROR_MESSAGES.page_not_found);
        return;
      }

      // 3. Check if user has permission to edit the target page
      const canEdit = canUserEditPage(user, targetPageData);
      if (!canEdit) {
        toast.error(ERROR_MESSAGES.permission_denied);
        return;
      }

      // 4. Validate source page content size
      const sourceContent = page.content || [];
      const contentString = typeof sourceContent === 'string' ? sourceContent : JSON.stringify(sourceContent);
      
      if (contentString.length > MAX_CONTENT_SIZE) {
        toast.error(ERROR_MESSAGES.content_too_large);
        return;
      }

      if (Array.isArray(sourceContent) && sourceContent.length > MAX_CONTENT_BLOCKS) {
        toast.error(ERROR_MESSAGES.too_many_blocks);
        return;
      }

      // 5. Create a source page data object with the current page info
      const sourcePageData = {
        id: page.id,
        title: page.title || 'Untitled Page',
        userId: page.userId // Include the user ID for notification
      };

      // 6. Append the current page reference to the selected page
      const result = await appendPageReference(selectedPage.id, sourcePageData, user.uid);

      if (result) {
        // Log successful operation
        logAppendOperation(user.uid, page.id, selectedPage.id, true);

        // Show success state instead of redirecting immediately
        setSuccessTargetPage(selectedPage);
        setShowSuccess(true);
        setSelectedPage(null);
      } else {
        // Log failed operation
        logAppendOperation(user.uid, page.id, selectedPage.id, false, 'Append operation returned false');
        toast.error(ERROR_MESSAGES.unknown_error);
      }
    } catch (error: any) {
      console.error("Error adding page:", error);

      // Log failed operation with error details
      logAppendOperation(user.uid, page.id, selectedPage.id, false, error.message || 'Unknown error');

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



  // Keyboard navigation support
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape') {
      handleClose();
    } else if (event.key === 'Enter' && selectedPage && !isAdding) {
      event.preventDefault();
      handleInsert();
    }
  };

  if (!user || !page) return null;

  // Always show the button, even for the page owner

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
          aria-describedby="add-to-page-description"
        >
          {isAdding ? (
            <>
              <div className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin mr-1"></div>
              <span>Adding...</span>
            </>
          ) : (
            <>
              <Quote className="h-5 w-5" />
              <span>Add this page to another page</span>
            </>
          )}
        </Button>
      )}

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={showSuccess ? 'Page Added Successfully' : 'Add this page to another page'}
        className="sm:max-w-md max-h-[80vh] w-[95vw] sm:w-full overflow-hidden flex flex-col rounded-lg border-theme-strong bg-card"
        showCloseButton={true}
      >

          {showSuccess ? (
            // Success state
            <div className="flex-1 py-4 text-center">
              <div className="mb-4">
                <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">
                  "{page?.title || 'This page'}" has been successfully added to "{successTargetPage?.title}".
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={handleGoToTargetPage}
                  className="rounded-2xl font-medium"
                  size="lg"
                >
                  Go to {successTargetPage?.title}
                </Button>
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="rounded-2xl font-medium"
                  size="lg"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            // Search state
            <>
              <div className="flex-1 overflow-y-auto py-4">
                <p
                  id="add-to-page-description"
                  className="text-sm text-muted-foreground mb-4"
                >
                  Select a page to add "{page?.title || 'this page'}" to. You can only add to pages you have permission to edit.
                </p>
                <AddToPageSearch onSelect={handleAddToPage} />
              </div>

              <div className="mt-4 pt-4 border-t border-border dark:border-neutral-700">
                <Button
                  onClick={handleInsert}
                  disabled={!selectedPage || isAdding}
                  className="w-full sm:w-auto rounded-2xl font-medium"
                  size="lg"
                  aria-label={selectedPage ? `Add content to ${selectedPage.title}` : 'Select a page first'}
                  aria-describedby="add-to-page-description"
                >
                  {isAdding ? (
                    <>
                      <div className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin mr-1"></div>
                      <span>Adding...</span>
                    </>
                  ) : (
                    'Add Content'
                  )}
                </Button>
              </div>
            </>
          )}
      </Modal>
    </>
  );
};

// Search component for Add to Page functionality
const AddToPageSearch = ({ onSelect }: { onSelect: (page: any) => void }) => {
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
        const response = await fetch(`/api/recent-pages?userId=${userId}&limit=10`);

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

  const handlePageSelect = (page: any) => {
    onSelect(page);
  };

  // Determine what to show: search results if there's a query, otherwise recent pages
  const showSearchResults = currentQuery && currentQuery.trim().length > 0;
  const pagesToShow = showSearchResults ? editableSearchPages : recentPages;
  const isLoadingPages = showSearchResults ? isLoading : recentPagesLoading;

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search your pages..."
        className="w-full px-3 py-2 border border-input rounded-md"
        onChange={(e) => performSearch(e.target.value)}
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
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
        </div>
      )}

      {pagesToShow.length > 0 && (
        <div className="max-h-60 overflow-y-auto space-y-2">
          {pagesToShow.map((page) => (
            <button
              key={page.id}
              onClick={() => handlePageSelect(page)}
              className="w-full text-left p-3 rounded-md border border-input hover:bg-accent transition-colors"
            >
              <div className="font-medium">{page.title || 'Untitled'}</div>
              {page.username && (
                <div className="text-sm text-muted-foreground">by {page.username}</div>
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