"use client";

import React, { useState, forwardRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Users, Trash2 } from "lucide-react";
import { Element, Node as SlateNode, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { ShimmerEffect } from "../ui/skeleton";
import { useAuth } from '../../providers/AuthProvider';
import { formatPageTitle, formatUsername, isUserLink, isPageLink, isExternalLink, isGroupLink } from "../../utils/linkFormatters";
import Modal from "../ui/modal";
import ExternalLinkPreviewModal from "../ui/ExternalLinkPreviewModal";
import { Button } from "../ui/button";
import { usePillStyle, PILL_STYLES } from "../../contexts/PillStyleContext";
import { navigateToPage, canUserEditPage } from "../../utils/pagePermissions";
import PillLinkContextMenu from "./PillLinkContextMenu";
import { getPageById } from "../../utils/apiClient";
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
  customOnClick?: (e: React.MouseEvent) => void;
  onEditLink?: () => void;
  onConfirmSuggestion?: () => void; // New prop for confirming suggestions
  onDismissSuggestion?: () => void; // New prop for dismissing suggestions
  draggable?: boolean; // New prop to enable dragging
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isLinkEditor?: boolean; // New prop to indicate if we're in link editor mode
  onLinkEditorSelect?: () => void; // New prop for link editor selection
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
  deleted: deletedProp = false,
  isFallback = false,
  isSuggestion = false,
  clickable = true,
  isEditing = false, // Default to false (view mode)
  onClick: customOnClickFromOnClick,
  customOnClick: customOnClickProp,
  onEditLink,
  onConfirmSuggestion,
  onDismissSuggestion,
  isLinkEditor = false,
  onLinkEditorSelect,
  ...otherProps
}, ref) => {
  const customOnClick = customOnClickProp || customOnClickFromOnClick;
  // Hooks
  const { user } = useAuth();
  const { getPillStyleClasses, pillStyle } = usePillStyle();
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [pageData, setPageData] = useState(null);
  const [displayTitle, setDisplayTitle] = useState(children);
  const [isPageDeleted, setIsPageDeleted] = useState(false);

  // Fetch page data for permission checking (only for page links)
  // CIRCUIT BREAKER: Add error tracking to prevent infinite loops
  const [fetchAttempts, setFetchAttempts] = useState(0);
  const [lastError, setLastError] = useState(null);
  const maxAttempts = 2; // Lower for PillLink since it's more frequent
  const router = useRouter();
  const { trackInteractionEvent, events } = useWeWriteAnalytics();

  // Determine link properties early (before useEffect hooks)
  const isUserLinkType = isUserLink(href);
  const isGroupLinkType = isGroupLink(href);
  const isPageLinkType = isPageLink(href);
  const isExternalLinkType = isExternalLink(href);
  // Use prop pageId if available, otherwise extract from href
  const pageId = propPageId || href.split('/').pop();

  // Debug logging removed to prevent React reconciliation issues

  // CRITICAL FIX: Generate proper href for page links when href is invalid
  const effectiveHref = useMemo(() => {
    // If we have a pageId and the href is invalid (like '#'), generate the correct href
    if (isPageLinkType && pageId && pageId !== '#' && (href === '#' || !href || href.trim() === '')) {
      console.log('🔵 PillLink: Generating href from pageId', { pageId, originalHref: href });
      return `/${pageId}`;
    }
    return href;
  }, [href, pageId, isPageLinkType]);

  // Fetch page data for permission checking and deleted status (only for page links)
  useEffect(() => {
    if (isPageLinkType && pageId && fetchAttempts < maxAttempts) {
      const fetchPageData = async () => {
        try {
          // Use direct page access - works for both authenticated and anonymous users
          const result = await getPageById(pageId, user?.uid);

          if (result.pageData) {
            // Check if the page is marked as deleted - now available directly from main API
            const isDeleted = result.pageData.deleted === true;
            setIsPageDeleted(isDeleted);

            if (!result.error && !isDeleted) {
              // Normal page - set page data and clear error
              setPageData(result.pageData);
              setLastError(null);
            } else if (isDeleted) {
              // Deleted page - don't set full page data, just mark as deleted
              setPageData(null);
              setLastError(null);
            } else {
              // Error case
              setFetchAttempts(maxAttempts);
              setLastError(result.error);
            }
          } else if (result.error) {
            // Handle access denied or page not found without pageData
            setFetchAttempts(maxAttempts); // Stop further attempts
            setLastError(result.error);
            setIsPageDeleted(false);
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
  }, [isPageLinkType, pageId, fetchAttempts]);

  // Handle showing context menu
  const handleShowContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setShowContextMenu(true);
  };

  // Handle going to link (navigation)
  const handleGoToLink = async () => {
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
      // Check if this is a "new page" link that might already exist
      if (isPageLinkType && pageId && pageId.startsWith('new:')) {
        const titleFromPageId = pageId.substring(4); // Remove 'new:' prefix
        console.log('🔵 PillLink: Checking for existing page with title:', titleFromPageId);

        try {
          // Search for existing pages with this title
          const response = await fetch(`/api/search-unified?q=${encodeURIComponent(titleFromPageId)}&limit=5`);
          if (response.ok) {
            const searchResults = await response.json();

            // Look for an exact title match
            const exactMatch = searchResults.pages?.find((page: any) =>
              page.title.toLowerCase().trim() === titleFromPageId.toLowerCase().trim()
            );

            if (exactMatch) {
              console.log('🔵 PillLink: Found existing page, navigating to:', exactMatch.id);
              // Navigate to the existing page instead of creating a new one
              navigateToPage(exactMatch.id, user, exactMatch, user?.groups, router);
              return;
            }
          }
        } catch (error) {
          console.error('🔴 PillLink: Error checking for existing page:', error);
          // Continue with normal navigation if search fails
        }
      }

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

    window.addEventListener('pageTitle:updated', handleTitleUpdate);

    return () => {
      window.removeEventListener('pageTitle:updated', handleTitleUpdate);
    };
  }, [children, displayTitle, href, isPageLinkType]);

  // Update displayTitle when children prop changes
  useEffect(() => {
    setDisplayTitle(children);
  }, [children]);

  // Show loading state if needed
  if (isLoading) return <PillLinkSkeleton />;

  // Deleted page pill - clickable to show deleted page view
  // Use detected deleted status for page links, or prop for other types
  const deleted = isPageLinkType ? isPageDeleted : deletedProp;
  if (deleted) {
    const handleDeletedClick = (e: React.MouseEvent) => {
      e.preventDefault();
      if (customOnClick) {
        customOnClick(e);
      } else if (pageId) {
        router.push(`/${pageId}`);
      } else if (href && href !== '#') {
        router.push(href);
      }
    };

    return (
      <span
        className={`inline-flex items-center my-0.5 text-sm font-medium rounded-lg transition-all duration-150 ease-out bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-pointer hover:bg-neutral-300 dark:hover:bg-neutral-600 px-2 py-0.5 ${className}`}
        onClick={handleDeletedClick}
        title="This page has been deleted. Click to see more options."
      >
        <Trash2 size={12} className="mr-1.5 flex-shrink-0" />
        <span className="pill-text truncate max-w-[300px]">{children || "deleted page"}</span>
      </span>
    );
  }





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

  // Determine if this is a container style that needs truncation (filled/outline have visual boundaries)
  // Text styles (text_only/underlined) can wrap naturally since they have no container
  const isContainerStyle = pillStyle === PILL_STYLES.FILLED || pillStyle === PILL_STYLES.OUTLINE;

  // Classes for the pill-text span based on style type
  const pillTextClasses = isContainerStyle
    ? 'pill-text truncate max-w-[300px]' // Container styles: single-line with ellipsis
    : 'pill-text'; // Text styles: allow natural wrapping

  // Use different styling for suggestions vs normal pill links
  const baseStyles = isSuggestion
    ? `inline-flex items-center my-0.5 px-2 py-0.5 text-sm font-medium text-foreground bg-transparent border border-dotted border-neutral-15 rounded-lg hover:bg-neutral-5 transition-colors cursor-pointer ${className}`.trim()
    : `${getPillStyleClasses()} ${className}`.trim();

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
            // Allow event bubbling for parent handlers when not clickable
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
          <span className={pillTextClasses}>{formattedDisplayTitle}</span>
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
          onDeleteLink={() => {
            // Handle delete link action for external links
            console.log('🗑️ Delete external link clicked for:', href);
            // TODO: Implement link deletion logic
          }}
          canEdit={canEdit}
          isDeleted={deleted}
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

          // Handle link editor mode first
          if (isLinkEditor && onLinkEditorSelect) {
            e.preventDefault();
            e.stopPropagation();
            onLinkEditorSelect();
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
          // Only prevent default to avoid navigation, but allow event bubbling for parent handlers
          if (!clickable) {
            e.preventDefault();
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
        <span className={pillTextClasses}>{formattedDisplayTitle}</span>
        {formattedByline && <span className="text-xs opacity-75 flex-shrink-0">{formattedByline}</span>}
      </a>

      <PillLinkContextMenu
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        position={contextMenuPosition}
        onGoToLink={handleGoToLink}
        onEditLink={handleEditLink}
        onDeleteLink={() => {
          // Handle delete link action
          console.log('🗑️ Delete link clicked for:', href);

          // Find and delete the link element from the Slate editor
          if (editor && ReactEditor.isFocused(editor)) {
            try {
              // Find all link nodes that match this element
              const linkNodes = Array.from(SlateNode.nodes(editor, {
                match: n => Element.isElement(n) && n.type === 'link' && (
                  n.pageId === element.pageId ||
                  n.url === element.url ||
                  (n.pageTitle === element.pageTitle && n.customText === element.customText)
                )
              }));

              if (linkNodes.length > 0) {
                // Delete the first matching link
                const [, linkPath] = linkNodes[0];
                Transforms.removeNodes(editor, { at: linkPath });
                console.log('🗑️ Link deleted via context menu:', {
                  pageId: element.pageId,
                  pageTitle: element.pageTitle,
                  url: element.url
                });
              } else {
                console.warn('🗑️ Could not find link to delete');
              }
            } catch (error) {
              console.error('🗑️ Error deleting link:', error);
            }
          }

          setShowContextMenu(false);
        }}
        canEdit={canEdit}
        isDeleted={deleted}
      />
    </>
  );
});

export default PillLink;
