import React, { useState, useEffect, useMemo } from "react";
import PillLink from "../utils/PillLink";
import { usePillStyle } from "../../contexts/PillStyleContext";
import { getPageById } from "../../utils/apiClient";

// Type definitions
interface InternalLinkWithTitleProps {
  pageId: string;
  href: string;
  displayText: string;
  originalPageTitle: string | null;
  showAuthor: boolean;
  authorUsername: string | null;
  canEdit?: boolean;
  isEditing?: boolean;
  onEditLink?: () => void;
}

// Cache for page titles to avoid repeated API calls
const pageTitleCache = new Map<string, string>();

const getPageTitle = async (pageId: string): Promise<string | null> => {
  if (!pageId) return null;

  // Check cache first
  if (pageTitleCache.has(pageId)) {
    return pageTitleCache.get(pageId) || null;
  }

  try {
    const pageData = await getPageById(pageId);
    if (pageData && pageData.title) {
      // Cache the result
      pageTitleCache.set(pageId, pageData.title);
      return pageData.title;
    }
  } catch (error) {
    console.error('Error fetching page title:', error);
  }

  return null;
};

/**
 * InternalLinkWithTitle Component - Renders internal page links with dynamic title fetching
 * 
 * Features:
 * - Fetches and displays current page titles
 * - Caches titles to avoid repeated API calls
 * - Prioritizes custom display text over fetched titles
 * - Shows loading state when fetching titles
 * - Handles error states gracefully
 */
const InternalLinkWithTitle: React.FC<InternalLinkWithTitleProps> = ({
  pageId,
  href,
  displayText,
  originalPageTitle,
  showAuthor,
  authorUsername,
  canEdit = false,
  isEditing = false,
  onEditLink
}) => {
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Start with false, only set to true when actually fetching
  const [fetchError, setFetchError] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Ensure href is properly formatted
  const formattedHref = useMemo(() => {
    // CRITICAL FIX: Validate pageId before using it
    if (pageId && pageId !== '#' && pageId.trim() !== '' && !pageId.includes('#')) {
      return `/${pageId}`;
    }

    // CRITICAL FIX: Don't use '#' as fallback - use null to indicate invalid link
    // This prevents navigation attempts to invalid pages
    if (!href || href === '#' || !pageId || pageId === '#' || pageId.includes('#')) {
      return null; // Return null instead of '#' to prevent navigation
    }

    // If href doesn't start with /, add it
    if (href && !href.startsWith('/')) {
      return `/${href}`;
    }

    return href;
  }, [href, pageId]);

  useEffect(() => {
    // Reset states when pageId changes
    setFetchError(false);
    setCurrentTitle(null);

    const fetchTitle = async () => {
      try {
        // CRITICAL FIX: Validate pageId before making any API calls
        // This prevents Firebase errors when pageId is '#' or other invalid values
        if (!pageId || pageId === '#' || pageId.trim() === '' || pageId.includes('#')) {
          setFetchError(true);
          setIsLoading(false);
          return;
        }

        // Only show loading if we don't have originalPageTitle
        if (!originalPageTitle) {
          setIsLoading(true);
        }

        // Check cache first to avoid unnecessary API calls
        const pageTitle = await getPageTitle(pageId);

        if (isMounted) {
          setCurrentTitle(pageTitle);
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setFetchError(true);
          setIsLoading(false);
        }
      }
    };

    // Only fetch if we have a valid pageId and don't have originalPageTitle or if we want to update the cache
    // But prioritize showing originalPageTitle immediately
    if (pageId && pageId !== '#' && pageId.trim() !== '' && !pageId.includes('#')) {
      fetchTitle();
    } else if (!pageId || pageId === '#' || pageId.includes('#')) {
      // Handle invalid pageId gracefully
      setFetchError(true);
      setIsLoading(false);
    }
  }, [pageId, isMounted, originalPageTitle]);

  // Determine what text to display using a clear priority system
  let textToDisplay: React.ReactNode;

  // CRITICAL FIX: Always prioritize displayText if it exists and is not empty
  // The displayText comes from the link's children and represents what the user actually typed
  if (displayText && displayText.trim() && displayText !== 'Link' && displayText !== 'Page Link') {
    textToDisplay = displayText;
  }
  // If we have a currentTitle from the database (updated page title), use it
  else if (currentTitle && currentTitle.trim()) {
    textToDisplay = currentTitle;
  }
  // If originalPageTitle is available, use it (original page title)
  else if (originalPageTitle && originalPageTitle.trim()) {
    textToDisplay = originalPageTitle;
  }
  // If we're loading and have no other text, show a loading indicator
  else if (isLoading) {
    textToDisplay = (
      <>
        <span className="inline-block w-3 h-3 border-2 border-t-transparent border-primary rounded-full animate-spin mr-1"></span>
        <span className="text-xs">Loading</span>
      </>
    );
  }
  // If there was an error or we have no other text, use a fallback
  else {
    const fallbackText = fetchError ? 'Page Link (Error)' : (pageId ? `Page: ${pageId}` : 'Page Link');
    textToDisplay = fallbackText;
  }

  // Use PillStyleContext for consistent styling between edit and view modes
  const { getPillStyleClasses } = usePillStyle();
  const pillStyles = getPillStyleClasses('paragraph');

  // TextView is now for viewing only - editing is handled by Editor component
  // Always render in view mode - normal navigation behavior - no tooltip

  // CRITICAL FIX: Handle invalid links gracefully
  if (!formattedHref) {
    // For invalid links, render as disabled pill without navigation
    return (
      <span className="inline-block">
        <span className={`${getPillStyleClasses('paragraph')} opacity-50 cursor-not-allowed`}>
          {textToDisplay || 'Invalid Link'}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-block">
      <PillLink
        href={formattedHref}
        isPublic={true}
        className="inline page-link"
        data-page-id={pageId}
        isEditing={isEditing}
        onEditLink={isEditing ? onEditLink : undefined}
      >
        {textToDisplay}
      </PillLink>
    </span>
  );
};

export default InternalLinkWithTitle;
