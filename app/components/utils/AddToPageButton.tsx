"use client";

import React, { useState, useContext } from 'react';
import { Button } from '../ui/button';
import { Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '../ui/dialog';
import TypeaheadSearch from '../search/TypeaheadSearch';
import { AuthContext } from '../../providers/AuthProvider';
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

  // Log to console for now (in production, this would go to a proper logging service)
  console.log('AUDIT LOG:', logEntry);

  // In a production environment, you would send this to your logging service:
  // await fetch('/api/audit-log', { method: 'POST', body: JSON.stringify(logEntry) });
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
  const [selectedPage, setSelectedPage] = useState<SelectedPage | null>(null);
  const { user } = useContext(AuthContext);
  const router = useRouter();

  // Determine which state to use
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalSetIsOpen || setInternalIsOpen;

  const handleAddToPage = async (selected: SelectedPage): Promise<void> => {
    if (!selected || !page) return;

    // Store the selected page for the Insert button
    setSelectedPage(selected);
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

        toast.success(`Added "${page.title || 'this page'}" to "${selectedPage.title}"`);
        setIsOpen(false);
        setSelectedPage(null);

        // Redirect to the target page (will load in view mode with click-to-edit functionality)
        router.push(`/${selectedPage.id}`);
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

  const handleClose = (): void => {
    setIsOpen(false);
    setSelectedPage(null);
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
              <Plus className="h-5 w-5" />
              <span>Add this page to another page</span>
            </>
          )}
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent
          className="sm:max-w-md max-h-[80vh] w-[95vw] sm:w-full overflow-hidden flex flex-col rounded-lg border border-border dark:border-neutral-700 bg-white dark:bg-neutral-900 animate-in fade-in-0 zoom-in-95 duration-300 px-4 sm:px-6 py-4 sm:py-6"
          onKeyDown={handleKeyDown}
        >
          <DialogClose asChild>
            <Button variant="outline" size="icon" className="absolute right-4 top-4">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
          <DialogHeader>
            <DialogTitle>Add this page to another page</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            <p 
              id="add-to-page-description" 
              className="text-sm text-muted-foreground mb-4"
            >
              Select a page to add "{page?.title || 'this page'}" to. You can only add to pages you have permission to edit.
            </p>
            <TypeaheadSearch
              placeholder="Search your pages..."
              editableOnly={true}
              onSelect={handleAddToPage}
              setShowResults={() => {}}
              aria-label="Search for pages to add content to"
            />
          </div>

          <DialogFooter className="mt-4 pt-4 border-t border-border dark:border-neutral-700">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddToPageButton;
