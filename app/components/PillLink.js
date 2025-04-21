"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Lock, ExternalLink } from "lucide-react";
import { ShimmerEffect } from "./ui/skeleton";
import { useAuth } from "../providers/AuthProvider";
import { formatPageTitle, formatUsername, isUserLink, isPageLink, isExternalLink } from "../utils/linkFormatters";
import Modal from "./ui/modal";
import { Button } from "./ui/button";
import { usePillStyle } from "../contexts/PillStyleContext";

// Simple skeleton loader
const PillLinkSkeleton = () => (
  <div className="inline-flex items-center my-0.5 px-2 py-0.5 rounded-lg shadow-sm bg-muted/40">
    <ShimmerEffect className="h-4 w-20 rounded-md" />
  </div>
);

export const PillLink = ({
  children,
  href,
  isPublic,
  groupId,
  className = "",
  isOwned,
  byline,
  isLoading
}) => {
  // Hooks
  const { user } = useAuth();
  const { getPillStyleClasses } = usePillStyle();
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);

  // Show loading state if needed
  if (isLoading) return <PillLinkSkeleton />;

  // Determine link properties
  const showLock = isPublic === false;
  const isUserLinkType = isUserLink(href);
  const isPageLinkType = isPageLink(href);
  const isExternalLinkType = isExternalLink(href);
  const pageId = href.split('/').pop();

  // Format display title
  let displayTitle = children;
  if (typeof children === 'string') {
    if (isUserLinkType) {
      displayTitle = formatUsername(children);
    } else if (isPageLinkType) {
      displayTitle = formatPageTitle(children);
    }
  }

  // Base styles for all pill links
  const baseStyles = `
    inline-flex items-center
    my-0.5 px-2 py-0.5
    text-sm font-medium
    rounded-lg
    transition-colors
    shadow-sm
    whitespace-nowrap
    max-w-full
    ${getPillStyleClasses()}
    ${groupId ? 'opacity-90' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  // External link with confirmation modal
  if (isExternalLinkType) {
    return (
      <>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setShowExternalLinkModal(true);
          }}
          className={baseStyles}
          tabIndex={0}

        >
          {showLock && <Lock size={14} className="mr-1 flex-shrink-0" />}
          <span className="pill-text">{displayTitle}</span>
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
    <Link
      href={href}
      className={baseStyles}
      tabIndex={0}
      data-page-id={isPageLinkType ? pageId : undefined}
      data-user-id={isUserLinkType ? pageId : undefined}

    >
      {showLock && <Lock size={14} className="mr-1 flex-shrink-0" />}
      <span className="pill-text">{displayTitle}</span>
      {byline && <span className="ml-1 text-xs opacity-75 flex-shrink-0">{byline}</span>}
    </Link>
  );
};

export default PillLink;
