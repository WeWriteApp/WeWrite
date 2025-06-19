"use client";

import React, { useState, forwardRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, ExternalLink, Users, Trash2 } from "lucide-react";
import { ShimmerEffect } from "../ui/skeleton";
import { useAuth } from "../../providers/AuthProvider";
import { formatPageTitle, formatUsername, isUserLink, isPageLink, isExternalLink, isGroupLink } from "../../utils/linkFormatters";
import Modal from "../ui/modal";
import ExternalLinkPreviewModal from "../ui/ExternalLinkPreviewModal";
import { Button } from "../ui/button";
import { usePillStyle } from "../../contexts/PillStyleContext";
import { navigateToPage, canUserEditPage } from "../../utils/pagePermissions";
import { getCachedPageById } from "../../utils/requestCache";
import { useWeWriteAnalytics } from "../../hooks/useWeWriteAnalytics";

// Simple skeleton loader
const PillLinkSkeleton = () => (
  <div className="inline-flex items-center my-0.5 rounded-lg bg-muted/40">
    <ShimmerEffect className="h-4 w-20 rounded-md" />
  </div>
);

export const PillLink = forwardRef(({
  children,
  href,
  isPublic,
  groupId,
  className = "",
  isOwned,
  byline,
  isLoading,
  deleted = false,
  isFallback = false
}, ref) => {
  // Hooks
  const { user } = useAuth();
  const { getPillStyleClasses, pillStyle } = usePillStyle();
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);
  const [pageData, setPageData] = useState(null);
  const [displayTitle, setDisplayTitle] = useState(children);
  const router = useRouter();
  const { trackInteractionEvent, events } = useWeWriteAnalytics();

  // Determine link properties early (before useEffect hooks)
  const showLock = isPublic === false;
  const isUserLinkType = isUserLink(href);
  const isGroupLinkType = isGroupLink(href);
  const isPageLinkType = isPageLink(href);
  const isExternalLinkType = isExternalLink(href);
  const pageId = href.split('/').pop();

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
        console.log(`💊 PillLink: Updating title in real-time: ${children} -> ${newTitle}`);
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
        className={`inline-flex items-center my-0.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap max-w-full bg-muted text-muted-foreground opacity-60 cursor-not-allowed ${className}`}
        style={{ pointerEvents: 'none' }}
      >
        <Trash2 size={14} className="mr-1 flex-shrink-0" />
        <span className="pill-text">deleted page</span>
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
          // Use cached page access with deduplication
          const result = await getCachedPageById(pageId, user?.uid);
          if (result.pageData && !result.error) {
            setPageData(result.pageData);
            setLastError(null); // Clear error on success
          } else if (result.error) {
            // Handle access denied or page not found
            console.log(`PillLink: Access denied or page not found for ${pageId}: ${result.error}`);
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
      // For pages without groupId, format as "by [username]"
      formattedByline = `by ${byline}`;
    }
  }

  // Ensure we have a valid href to prevent errors
  const safeHref = href || '#';

  // Format display title
  let formattedDisplayTitle = displayTitle;
  if (typeof displayTitle === 'string') {
    if (isUserLinkType) {
      formattedDisplayTitle = formatUsername(displayTitle);
    } else if (isPageLinkType) {
      formattedDisplayTitle = formatPageTitle(displayTitle);
    }
  }

  // Log the link type for debugging
  console.log('PillLink properties:', {
    href,
    isUserLink: isUserLinkType,
    isGroupLink: isGroupLinkType,
    isPageLink: isPageLinkType,
    isExternalLink: isExternalLinkType
  });

  // Use centralized styling with any additional custom classes
  const baseStyles = `${getPillStyleClasses()} ${className}`.trim();

  // External link with confirmation modal
  if (isExternalLinkType) {
    return (
      <>
        <a
          ref={ref}
          href="#"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling to parent containers

            // Remove focus from the clicked element to prevent focus ring on page
            if (e.target && typeof e.target.blur === 'function') {
              e.target.blur();
            }

            setShowExternalLinkModal(true);
          }}
          className={baseStyles}
          data-pill-style={pillStyle}
          tabIndex={0}
        >
          {showLock && <Lock size={14} className="flex-shrink-0" />}
          <span className="pill-text">{formattedDisplayTitle}</span>
          <ExternalLink size={14} className="flex-shrink-0" />
          {formattedByline && <span className="text-xs opacity-75 flex-shrink-0">{formattedByline}</span>}
        </a>

        <ExternalLinkPreviewModal
          isOpen={showExternalLinkModal}
          onClose={() => setShowExternalLinkModal(false)}
          url={href}
          displayText={formattedDisplayTitle}
        />
      </>
    );
  }

  // Internal link (user, group, or page)
  return (
    <a
      ref={ref}
      href={safeHref}
      className={baseStyles}
      tabIndex={0}
      data-pill-style={pillStyle}
      data-page-id={isPageLinkType ? pageId : undefined}
      data-user-id={isUserLinkType ? pageId : undefined}
      data-group-id={isGroupLinkType ? pageId : undefined}
      onClick={(e) => {
        // Only prevent default and navigate if we have a valid href
        if (href && href !== '#') {
          e.preventDefault(); // Prevent default to handle navigation manually
          e.stopPropagation(); // CRITICAL: Stop event bubbling to prevent edit mode activation

          // Remove focus from the clicked element to prevent focus ring on page
          if (e.target && typeof e.target.blur === 'function') {
            e.target.blur();
          }

          // Track link click
          trackInteractionEvent(events.INTERNAL_LINK_CLICKED, {
            link_type: isPageLinkType ? 'page' : isUserLinkType ? 'user' : isGroupLinkType ? 'group' : 'unknown',
            target_id: pageId,
            target_title: children,
            is_public: isPublic,
            has_byline: !!byline,
            source: 'pill_link'
          });

          console.log('PillLink clicked:', {
            href,
            isPageLink: isPageLinkType,
            isUserLink: isUserLinkType,
            isGroupLink: isGroupLinkType,
            pageId: isPageLinkType ? pageId : undefined
          });

          // Special handling for group links to avoid scroll issues
          if (isGroupLinkType) {
            console.log('PillLink - Group link clicked, using window.location for navigation', {
              href,
              groupId: pageId,
              location: window.location.href
            });

            // Ensure we have a valid group ID
            if (pageId) {
              // Use direct navigation for group links to avoid scroll issues
              try {
                // Create a full URL to ensure proper navigation
                const baseUrl = window.location.origin;
                const fullUrl = `${baseUrl}/group/${pageId}`;
                console.log('PillLink - Navigating to full URL:', fullUrl);

                // Use window.location.href for more reliable navigation
                window.location.href = fullUrl;
              } catch (error) {
                console.error('PillLink - Error with navigation, falling back to direct href', error);
                window.location.href = `/group/${pageId}`;
              }
            } else {
              // If we don't have a valid pageId, use the href directly
              window.location.href = href;
            }
            return;
          }

          // Handle page links with click-to-edit functionality
          if (isPageLinkType && pageId) {
            // Use the new navigation function that handles edit permissions
            navigateToPage(pageId, user, pageData, user?.groups, router);
            return;
          }

          // Use Next.js router for navigation when possible (for non-page links)
          if (typeof window !== 'undefined') {
            // Use router.push for client-side navigation
            router.push(href);

            console.log('PillLink: Navigating to:', href);
          } else {
            // Fallback to direct navigation if router is not available
            window.location.href = href;
          }
        }
      }}
    >
      {showLock && <Lock size={14} className="flex-shrink-0" />}
      {isGroupLinkType && <Users size={14} className="flex-shrink-0" />}
      <span className="pill-text">{formattedDisplayTitle}</span>
      {formattedByline && <span className="text-xs opacity-75 flex-shrink-0">{formattedByline}</span>}
    </a>
  );
});

export default PillLink;
