"use client";

import React, { useState, forwardRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Users, Trash2 } from "lucide-react";
import { ShimmerEffect } from "../ui/skeleton";
import { useAuth } from '../../providers/AuthProvider';
import { formatPageTitle, formatUsername, isUserLink, isPageLink, isExternalLink, isGroupLink } from "../../utils/linkFormatters";
import Modal from "../ui/modal";
import ExternalLinkPreviewModal from "../ui/ExternalLinkPreviewModal";
import { Button } from "../ui/button";
import { usePillStyle } from "../../contexts/PillStyleContext";
import { navigateToPage, canUserEditPage } from "../../utils/pagePermissions";
import PillLinkContextMenu from "./PillLinkContextMenu";
import { getPageById } from "../../firebase/database/pages";
import { useWeWriteAnalytics } from "../../hooks/useWeWriteAnalytics";

// Simple skeleton loader
const PillLinkSkeleton = () => (
  <div className="inline-flex items-center my-0.5 rounded-lg bg-muted/40">
    <ShimmerEffect className="h-4 w-20 rounded-md" />
  </div>
);

// PillLink component props interface
interface PillLinkProps {
  children: React.ReactNode;
  href: string;
  pageId?: string; // Direct pageId prop for better navigation
  isPublic?: boolean;
  groupId?: string;
  className?: string;
  isOwned?: boolean;
  byline?: string;
  isLoading?: boolean;
  deleted?: boolean;
  isFallback?: boolean;
  isSuggestion?: boolean; // New prop for link suggestions
  clickable?: boolean;
  isEditing?: boolean; // New prop to indicate if we're in edit mode
  onClick?: (e: React.MouseEvent) => void;
  onEditLink?: () => void;
  onConfirmSuggestion?: () => void; // New prop for confirming suggestions
  onDismissSuggestion?: () => void; // New prop for dismissing suggestions
  draggable?: boolean; // New prop to enable dragging
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  [key: string]: any; // For other props passed through
}

export const PillLink = forwardRef<HTMLAnchorElement, PillLinkProps>(({
  children,
  href,
  pageId: propPageId, // Rename to avoid conflict with extracted pageId
  isPublic,
  groupId,
  className = "",
  isOwned,
  byline,
  isLoading,
  deleted = false,
  isFallback = false,
  isSuggestion = false,
  clickable = true,
  isEditing = false, // Default to false (view mode)
  onClick: customOnClick,
  onEditLink,
  onConfirmSuggestion,
  onDismissSuggestion,
  ...otherProps
}, ref) => {
  // Hooks
  const { user } = useAuth();
  const { getPillStyleClasses, pillStyle } = usePillStyle();
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [pageData, setPageData] = useState(null);
  const [displayTitle, setDisplayTitle] = useState(children);
  const router = useRouter();
  const { trackInteractionEvent, events } = useWeWriteAnalytics();

  // Handle showing context menu
  const handleShowContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setShowContextMenu(true);
  };

  // Handle going to link (navigation)
  const handleGoToLink = () => {
    console.log('🔵 PillLink: handleGoToLink called', {
      href,
      effectiveHref,
      pageId,
      isExternalLinkType,
      isPageLinkType,
      isUserLinkType,
      isGroupLinkType,
      children
    });

    if (isExternalLinkType) {
      console.log('🔵 PillLink: Opening external link modal');
      setShowExternalLinkModal(true);
    } else if (effectiveHref && effectiveHref !== '#') {
      // Track link click
      trackInteractionEvent(events.INTERNAL_LINK_CLICKED, {
        link_type: isPageLinkType ? 'page' : isUserLinkType ? 'user' : isGroupLinkType ? 'group' : 'unknown',
        target_id: pageId,
        target_title: children,
        is_public: isPublic,
        has_byline: !!byline,
        source: 'pill_link_context_menu'
      });

      // Handle page links with click-to-edit functionality
      if (isPageLinkType && pageId) {
        console.log('🔵 PillLink: Navigating to page', { pageId, effectiveHref });
        navigateToPage(pageId, user, pageData, user?.groups, router);
        return;
      }

      // Use Next.js router for navigation when possible (for non-page links)
      console.log('🔵 PillLink: Using router.push for non-page link', { effectiveHref });
      if (typeof window !== 'undefined') {
        router.push(effectiveHref);
      } else {
        window.location.href = effectiveHref;
      }
    } else {
      console.log('🔴 PillLink: No valid href to navigate to', { href, effectiveHref });
    }
  };

  // Handle editing link
  const handleEditLink = () => {
    if (onEditLink) {
      onEditLink();
    }
  };

  // Determine if user can edit this link
  const canEdit = !!onEditLink;

  // Determine link properties early (before useEffect hooks)
  const isUserLinkType = isUserLink(href);
  const isGroupLinkType = isGroupLink(href);
  const isPageLinkType = isPageLink(href);
  const isExternalLinkType = isExternalLink(href);
  // Use prop pageId if available, otherwise extract from href
  const pageId = propPageId || href.split('/').pop();

  // CRITICAL FIX: Generate proper href for page links when href is invalid
  const effectiveHref = useMemo(() => {
    // If we have a pageId and the href is invalid (like '#'), generate the correct href
    if (isPageLinkType && pageId && pageId !== '#' && (href === '#' || !href || href.trim() === '')) {
      console.log('🔵 PillLink: Generating href from pageId', { pageId, originalHref: href });
      return `/${pageId}`;
    }
    return href;
  }, [href, pageId, isPageLinkType]);

  // Listen for page title updates
  useEffect(() => {
    const handleTitleUpdate = (event) => {
      const { pageId: updatedPageId, newTitle } = event.detail;

      // Extract page ID from href for page links
      let extractedPageId = null;
      if (isPageLinkType && href) {
        // Handle different href formats: /pageId, /pages/pageId
        if (href.startsWith('/pages/')) {
          extractedPageId = href.replace('/pages/', '').split('?')[0].split('#')[0];
        } else if (href.startsWith('/') && !href.includes('/')) {
          extractedPageId = href.substring(1).split('?')[0].split('#')[0];
        }
      }

      // Check if this pill link references the updated page
      // Only update if the current title matches the original (not custom text)
      if (extractedPageId === updatedPageId && children === displayTitle) {
        setDisplayTitle(newTitle);
      }
    };

    window.addEventListener('page-title-updated', handleTitleUpdate);

    return () => {
      window.removeEventListener('page-title-updated', handleTitleUpdate);
    };
  }, [children, displayTitle, href, isPageLinkType]);

  // Update displayTitle when children prop changes
  useEffect(() => {
    setDisplayTitle(children);
  }, [children]);

  // Show loading state if needed
  if (isLoading) return <PillLinkSkeleton />;

  // Deleted page pill
  if (deleted) {
    return (
      <span
        className={`inline-flex items-center my-0.5 text-sm font-medium rounded-lg transition-all duration-150 ease-out max-w-full overflow-hidden bg-muted text-muted-foreground opacity-60 cursor-not-allowed px-2 py-0.5 ${className}`}
        style={{ pointerEvents: 'none' }}
      >
        <Trash2 size={14} className="mr-1 flex-shrink-0" />
        <span className="pill-text overflow-hidden text-ellipsis whitespace-nowrap">deleted page</span>
      </span>
    );
  }

  // Fetch page data for permission checking (only for page links)
  // CIRCUIT BREAKER: Add error tracking to prevent infinite loops
  const [fetchAttempts, setFetchAttempts] = useState(0);
  const [lastError, setLastError] = useState(null);
  const maxAttempts = 2; // Lower for PillLink since it's more frequent

  useEffect(() => {
    if (isPageLinkType && pageId && user && fetchAttempts < maxAttempts) {
      const fetchPageData = async () => {
        try {
          // Use direct page access
          const result = await getPageById(pageId, user?.uid);
          if (result.pageData && !result.error) {
            setPageData(result.pageData);
            setLastError(null); // Clear error on success
          } else if (result.error) {
            // Handle access denied or page not found
            setFetchAttempts(maxAttempts); // Stop further attempts
          }
        } catch (error) {
          console.error('Error fetching page data for permissions:', error);
          setFetchAttempts(prev => prev + 1);
          setLastError(error);

          // Stop retrying on certain error types
          if (error?.code === 'unavailable' || error?.code === 'permission-denied') {
            console.warn(`PillLink: Stopping retries for page ${pageId} due to ${error.code}`);
            setFetchAttempts(maxAttempts); // Stop further attempts
          }
        }
      };

      // Only fetch if we haven't hit max attempts
      if (fetchAttempts < maxAttempts) {
        fetchPageData();
      }
    }
  }, [isPageLinkType, pageId, user, fetchAttempts]);

  // Format byline based on whether the page belongs to a group or user
  let formattedByline = null;

  if (byline && isPageLinkType) {
    if (groupId) {
      // For pages with groupId, format as "in [groupName]"
      formattedByline = `in ${byline}`;
    } else {
      // For pages without groupId, format as "by [, sessionname]"
      formattedByline = `by ${byline}`;
    }
  }

  // Ensure we have a valid href to prevent errors
  const safeHref = effectiveHref || '#';

  // Format display title
  let formattedDisplayTitle = displayTitle;
  if (typeof displayTitle === 'string') {
    if (isUserLinkType) {
      formattedDisplayTitle = formatUsername(displayTitle);
    } else if (isPageLinkType) {
      formattedDisplayTitle = formatPageTitle(displayTitle);
    }
  }

  // Use different styling for suggestions vs normal pill links
  const baseStyles = isSuggestion
    ? `inline-block px-2 py-1 text-sm font-medium text-primary bg-transparent border-b-2 border-dotted border-primary/60 hover:bg-primary/10 transition-colors cursor-pointer max-w-full overflow-hidden ${className}`.trim()
    : `${getPillStyleClasses()} max-w-full overflow-hidden ${className}`.trim();

  // External link with confirmation modal
  if (isExternalLinkType) {
    return (
      <>
        <a
          ref={ref}
          href="#"
          {...otherProps}
          onClick={(e) => {
            // Call custom onClick first if provided
            if (customOnClick) {
              customOnClick(e);
              // If custom handler prevented default, don't continue
              if (e.defaultPrevented) {
                return;
              }
            }

            // Don't handle click if component is not clickable
            if (!clickable) {
              return;
            }

            // Remove focus from the clicked element to prevent focus ring on page
            if (e.target && typeof e.target.blur === 'function') {
              e.target.blur();
            }

            // In edit mode: show context menu for editing options
            // In view mode: open external link modal directly
            if (isEditing) {
              handleShowContextMenu(e);
            } else {
              setShowExternalLinkModal(true);
            }
          }}
          className={baseStyles}
          data-pill-style={pillStyle}
          tabIndex={0}
        >
          <span className="pill-text overflow-hidden text-ellipsis whitespace-nowrap">{formattedDisplayTitle}</span>
          <ExternalLink size={14} className="flex-shrink-0" />
          {formattedByline && <span className="text-xs opacity-75 flex-shrink-0">{formattedByline}</span>}
        </a>

        <ExternalLinkPreviewModal
          isOpen={showExternalLinkModal}
          onClose={() => setShowExternalLinkModal(false)}
          url={href}
          displayText={formattedDisplayTitle}
        />

        <PillLinkContextMenu
          isOpen={showContextMenu}
          onClose={() => setShowContextMenu(false)}
          position={contextMenuPosition}
          onGoToLink={handleGoToLink}
          onEditLink={handleEditLink}
          canEdit={canEdit}
        />
      </>
    );
  }

  // Internal link (user, group, or page)
  return (
    <>
      <a
        ref={ref}
        href={safeHref}
        className={baseStyles}
        tabIndex={0}
        data-pill-style={pillStyle}
        data-page-id={isPageLinkType ? pageId : undefined}
        data-user-id={isUserLinkType ? pageId : undefined}
        data-group-id={isGroupLinkType ? pageId : undefined}
        {...otherProps}
        onClick={(e) => {
          // Handle suggestion pill links specially
          if (isSuggestion) {
            e.preventDefault();
            e.stopPropagation();

            // Show confirmation dialog for suggestion (already using system dialog - good!)
            const confirmed = window.confirm(
              `Link "${formattedDisplayTitle}"?\n\nClick OK to confirm this link suggestion, or Cancel to dismiss it.`
            );

            if (confirmed && onConfirmSuggestion) {
              onConfirmSuggestion();
            } else if (!confirmed && onDismissSuggestion) {
              onDismissSuggestion();
            }
            return;
          }

          // Call custom onClick first if provided
          if (customOnClick) {
            customOnClick(e);
            // If custom handler prevented default, don't continue
            if (e.defaultPrevented) {
              return;
            }
          }

          // Don't handle click if component is not clickable
          if (!clickable) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          // Remove focus from the clicked element to prevent focus ring on page
          if (e.target && typeof e.target.blur === 'function') {
            e.target.blur();
          }

          // In edit mode: show context menu for editing options
          // In view mode: navigate directly to the link
          if (isEditing) {
            handleShowContextMenu(e);
          } else {
            handleGoToLink();
          }
        }}
      >
        {isGroupLinkType && <Users size={14} className="flex-shrink-0" />}
        <span className="pill-text overflow-hidden text-ellipsis whitespace-nowrap">{formattedDisplayTitle}</span>
        {formattedByline && <span className="text-xs opacity-75 flex-shrink-0">{formattedByline}</span>}
      </a>

      <PillLinkContextMenu
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        position={contextMenuPosition}
        onGoToLink={handleGoToLink}
        onEditLink={handleEditLink}
        canEdit={canEdit}
      />
    </>
  );
});

export default PillLink;