"use client";

import React, { useState, forwardRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, ExternalLink, Users, Trash2 } from "lucide-react";
import { ShimmerEffect } from "../ui/skeleton";
import { useAuth } from "../../providers/AuthProvider";
import { formatPageTitle, formatUsername, isUserLink, isPageLink, isExternalLink, isGroupLink } from "../../utils/linkFormatters";
import Modal from "../ui/modal";
import { Button } from "../ui/button";
import { usePillStyle } from "../../contexts/PillStyleContext";
import { navigateToPage, canUserEditPage } from "../../utils/pagePermissions";
import { getPageById } from "../../firebase/database/pages";
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
  const router = useRouter();
  const { trackInteractionEvent, events } = useWeWriteAnalytics();

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

  // Determine link properties
  const showLock = isPublic === false;
  const isUserLinkType = isUserLink(href);
  const isGroupLinkType = isGroupLink(href);
  const isPageLinkType = isPageLink(href);
  const isExternalLinkType = isExternalLink(href);
  const pageId = href.split('/').pop();

  // Fetch page data for permission checking (only for page links)
  // CIRCUIT BREAKER: Add error tracking to prevent infinite loops
  const [fetchAttempts, setFetchAttempts] = useState(0);
  const [lastError, setLastError] = useState(null);
  const maxAttempts = 2; // Lower for PillLink since it's more frequent

  useEffect(() => {
    if (isPageLinkType && pageId && user && fetchAttempts < maxAttempts) {
      const fetchPageData = async () => {
        try {
          // Use proper page access function instead of direct Firestore access
          const result = await getPageById(pageId, user?.uid);
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
  let displayTitle = children;
  if (typeof children === 'string') {
    if (isUserLinkType) {
      displayTitle = formatUsername(children);
    } else if (isPageLinkType) {
      displayTitle = formatPageTitle(children);
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
            setShowExternalLinkModal(true);
          }}
          className={baseStyles}
          data-pill-style={pillStyle}
          tabIndex={0}
        >
          {showLock && <Lock size={14} className="mr-1 flex-shrink-0" />}
          <span className="pill-text">{displayTitle}</span>
          <ExternalLink size={14} className="ml-1 flex-shrink-0" />
          {formattedByline && <span className="ml-1 text-xs opacity-75 flex-shrink-0">{formattedByline}</span>}
        </a>

        <Modal
          isOpen={showExternalLinkModal}
          onClose={() => setShowExternalLinkModal(false)}
          title="External Link"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowExternalLinkModal(false)}>
                Back
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  if (window.navigator.standalone) {
                    window.location.href = href;
                  } else {
                    window.open(href, '_blank', 'noopener,noreferrer');
                  }
                  setShowExternalLinkModal(false);
                }}
              >
                Visit link
              </Button>
            </div>
          }
        >
          <p className="mb-4">You're about to visit an external website:</p>
          <div className="bg-muted p-3 rounded mb-2 break-all">
            <code>{href}</code>
          </div>
        </Modal>
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
      {showLock && <Lock size={14} className="mr-1 flex-shrink-0" />}
      {isGroupLinkType && <Users size={14} className="mr-1 flex-shrink-0" />}
      <span className="pill-text">{displayTitle}</span>
      {formattedByline && <span className="ml-1 text-xs opacity-75 flex-shrink-0">{formattedByline}</span>}
    </a>
  );
});

export default PillLink;
