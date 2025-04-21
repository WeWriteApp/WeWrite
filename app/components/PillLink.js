"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Lock, Loader, ExternalLink } from "lucide-react";
import { ShimmerEffect } from "./ui/skeleton";
import { useTheme } from "next-themes";
import { useAuth } from "../providers/AuthProvider";
import { motion } from "framer-motion";
import { formatPageTitle, formatUsername, isUserLink, isPageLink, isExternalLink } from "../utils/linkFormatters";
import Modal from "./ui/modal";
import { Button } from "./ui/button";
import { usePillStyle } from "../contexts/PillStyleContext";
import { getBestTextColor } from "../utils/accessibility";

export const PillLinkSkeleton = () => {
  return (
    <div className="my-0.5 px-[8px] py-[2px] inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium rounded-[8px] bg-muted/40 border-[1.5px] border-border/10 min-w-[80px] max-w-[120px]">
      <ShimmerEffect className="h-3 w-3 rounded-full" />
      <ShimmerEffect className="h-3.5 w-14 rounded-md" />
    </div>
  );
};

export const PillLink = ({
  children,
  href,
  isPublic,
  groupId,
  className,
  isOwned,
  byline,
  isLoading,
  label
}) => {
  const { user } = useAuth();
  // Only show lock for private pages (where isPublic is explicitly false)
  const showLock = isPublic === false;
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { pillStyle, getPillStyleClasses } = usePillStyle();
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);

  // Get pill style classes
  const variantStyles = getPillStyleClasses();

  if (isLoading) {
    return <PillLinkSkeleton />;
  }

  // Get styles based on variant and pill style preference
  const variantStyles = getPillStyleClasses(variant);

  // Extract page ID from href to check if user is the owner
  const pageId = href.split('/').pop();
  const pageOwnerId = groupId?.split('_')[0];
  // Consider both the explicit isOwned prop and the derived ownership from groupId
  const isCurrentUserOwner = isOwned || (user && pageOwnerId === user.uid);

  // Determine if this is a user link or page link
  const isUserLinkType = isUserLink(href);
  const isPageLinkType = isPageLink(href);
  const isExternalLinkType = isExternalLink(href);

  // Determine what title to display - use label prop if provided, otherwise use children
  // Always show the actual title for private pages when the user is the owner or when explicitly requested
  let displayTitle = (isPublic === false && !isCurrentUserOwner)
    ? "Private Page"
    : (label || children);

  // Format the title appropriately based on link type
  if (typeof displayTitle === 'string') {
    if (isUserLinkType) {
      // For user links, ensure they have @ symbol
      displayTitle = formatUsername(displayTitle);
    } else if (isPageLinkType) {
      // For page links, ensure they never have @ symbol
      displayTitle = formatPageTitle(displayTitle);
    }
  }

  // Use consistent padding and styling for all pill links
  const paddingClass = 'py-[2px]';
  const pillLinkBaseClass = `
    my-0.5 px-[8px] ${paddingClass}
    inline-flex items-center gap-1.5
    text-sm font-medium
    rounded-[8px]
    transition-colors duration-200
    shadow-sm
    ${variantStyles}
    ${groupId ? 'opacity-90' : ''}
    ${className || ''}
    max-w-full
  `;

  // For external links, we'll use a custom handler to show a confirmation modal
  if (isExternalLinkType) {
    return (
      <>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setShowExternalLinkModal(true);
          }}
          className={pillLinkBaseClass}
          tabIndex={0}
          // Prevent keyboard navigation inside the pill link
          onKeyDown={(e) => {
            // If left or right arrow keys are pressed, prevent default behavior
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
            }
          }}
        >
            {showLock && <Lock className="h-3.5 w-3.5 flex-shrink-0" />}
            <span className="whitespace-nowrap overflow-hidden text-ellipsis external-link">{displayTitle}</span>
            <ExternalLink className="h-3 w-3 flex-shrink-0 ml-1" />
            {byline && (
              <span className="text-xs opacity-75 whitespace-nowrap overflow-hidden text-ellipsis">
                {byline}
              </span>
            )}
        </a>

        <Modal
          isOpen={showExternalLinkModal}
          onClose={() => setShowExternalLinkModal(false)}
          title="External Link"
          footer={
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowExternalLinkModal(false)}
              >
                Back
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  // Open in new tab and in Safari if in PWA mode
                  if (window.navigator.standalone) {
                    // This is a PWA on iOS, open in Safari
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

  // For internal links (user or page links), use the standard Link component
  return (
    <Link
      href={href}
      className={pillLinkBaseClass}
      tabIndex={0}
      // Prevent keyboard navigation inside the pill link
      onKeyDown={(e) => {
        // If left or right arrow keys are pressed, prevent default behavior
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
        }
      }}
      data-page-id={isPageLinkType ? pageId : undefined}
      data-user-id={isUserLinkType ? pageId : undefined}
    >
        {showLock && <Lock className="h-3.5 w-3.5 flex-shrink-0" />}
        <span className={`whitespace-nowrap overflow-hidden text-ellipsis ${isUserLinkType ? 'user-link' : 'page-link'}`}>{displayTitle}</span>
        {byline && (
          <span className="text-xs opacity-75 whitespace-nowrap overflow-hidden text-ellipsis">
            {byline}
          </span>
        )}
    </Link>
  );
}