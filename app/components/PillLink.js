"use client";

import React, { useState, forwardRef } from "react";
import Link from "next/link";
import { Lock, ExternalLink, Trash2 } from "lucide-react";
import { ShimmerEffect } from "./ui/skeleton";
import { useAuth } from "../providers/AuthProvider";
import { formatPageTitle, formatUsername, isUserLink, isPageLink, isExternalLink } from "../utils/linkFormatters";
import Modal from "./ui/modal";
import { Button } from "./ui/button";
import { usePillStyle } from "../contexts/PillStyleContext";

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
  deleted = false
}, ref) => {
  // Hooks
  const { user } = useAuth();
  const { getPillStyleClasses } = usePillStyle();
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);

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
  const isPageLinkType = isPageLink(href);
  const isExternalLinkType = isExternalLink(href);
  const pageId = href.split('/').pop();

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

  // Get pill style
  const { pillStyle } = usePillStyle();
  // No inline style needed, we'll use CSS classes from getPillStyleClasses()

  // Base styles for all pill links
  // IMPORTANT: This must match the styles in SlateEditor.js LinkComponent to ensure consistent appearance
  // between view mode and edit mode. Any changes here should also be made in SlateEditor.js.
  const classicPadding = pillStyle === 'classic' ? '' : 'px-2 py-0.5';
  // Add whitespace-nowrap and truncate for filled and outline modes, but allow wrapping for classic mode
  const textWrapStyle = pillStyle === 'classic' ? 'break-words' : 'whitespace-nowrap truncate';
  const baseStyles = `
    inline-flex items-center
    my-0.5
    text-sm font-medium
    rounded-lg
    transition-colors
    max-w-full
    ${textWrapStyle}
    ${classicPadding}
    ${getPillStyleClasses()}
    ${groupId ? 'opacity-90' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  // External link with confirmation modal
  if (isExternalLinkType) {
    return (
      <>
        <a
          ref={ref}
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setShowExternalLinkModal(true);
          }}
          className={baseStyles}
          data-pill-style={pillStyle}
          tabIndex={0}
        >
          {showLock && <Lock size={14} className="mr-1 flex-shrink-0" />}
          <span className={`pill-text overflow-hidden ${pillStyle === 'classic' ? 'break-words' : 'truncate'}`}>{displayTitle}</span>
          <ExternalLink size={14} className="ml-1 flex-shrink-0" />
          {byline && <span className="ml-1 text-xs opacity-75 flex-shrink-0">{byline}</span>}
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

  // Internal link (user or page)
  return (
    <a
      ref={ref}
      href={safeHref}
      className={baseStyles}
      tabIndex={0}
      data-pill-style={pillStyle}
      data-page-id={isPageLinkType ? pageId : undefined}
      data-user-id={isUserLinkType ? pageId : undefined}
      onClick={(e) => {
        // Only prevent default and navigate if we have a valid href
        if (href && href !== '#') {
          e.preventDefault(); // Prevent default to handle navigation manually

          console.log('PillLink clicked:', {
            href,
            isPageLink: isPageLinkType,
            isUserLink: isUserLinkType,
            pageId: isPageLinkType ? pageId : undefined
          });

          // Force a hard navigation using window.location.href
          // This bypasses any router issues and ensures the navigation works
          window.location.href = href;
        }
      }}
    >
      {showLock && <Lock size={14} className="mr-1 flex-shrink-0" />}
      <span className={`pill-text overflow-hidden ${pillStyle === 'classic' ? 'break-words' : 'truncate'}`}>{displayTitle}</span>
      {byline && <span className="ml-1 text-xs opacity-75 flex-shrink-0">{byline}</span>}
    </a>
  );
});

export default PillLink;
