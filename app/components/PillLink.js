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

export const PillLinkSkeleton = () => {
  return (
    <div className="my-0.5 px-[8px] py-[2px] inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium rounded-[8px] bg-background/40 border-[1.5px] border-[rgba(255,255,255,0.1)] min-w-[80px] max-w-[120px]">
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
  variant = "primary",
  label
}) => {
  const { user } = useAuth();
  // Only show lock for private pages (where isPublic is explicitly false)
  const showLock = isPublic === false;
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);

  if (isLoading) {
    return <PillLinkSkeleton />;
  }

  // Determine styles based on variant
  let variantStyles = "";

  if (variant === "primary") {
    variantStyles = `
      bg-[#0057FF] text-white
      border-[1.5px] border-[rgba(255,255,255,0.2)]
      hover:bg-[#0046CC] hover:border-[rgba(255,255,255,0.3)]
    `;
  } else if (variant === "secondary") {
    variantStyles = `
      bg-accent/50 text-foreground
      border-[1.5px] border-border/40
      hover:bg-accent/70 hover:border-border
    `;
  }

  // Extract page ID from href to check if user is the owner
  const pageId = href.split('/').pop();
  const pageOwnerId = groupId?.split('_')[0];
  const isCurrentUserOwner = user && pageOwnerId === user.uid;

  // Determine if this is a user link or page link
  const isUserLinkType = isUserLink(href);
  const isPageLinkType = isPageLink(href);
  const isExternalLinkType = isExternalLink(href);

  // Determine what title to display - use label prop if provided, otherwise use children
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

  // Use padding that properly accommodates descenders
  const paddingClass = 'py-[2px]';

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
          className={`
            my-0.5 px-[8px] ${paddingClass}
            inline-flex items-center
            text-sm font-medium
            rounded-[8px]
            transition-colors duration-200
            shadow-sm
            ${variantStyles}
            ${groupId ? 'opacity-90' : ''}
            ${className || ''}
            max-w-full
          `}
        >
          <div className="flex items-center gap-1.5 flex-nowrap max-w-full">
            {showLock && <Lock className="h-3.5 w-3.5 flex-shrink-0" />}
            <span
              className={`whitespace-nowrap overflow-hidden text-ellipsis flex items-center external-link`}
            >
              <span className="truncate inline-block max-w-full">{displayTitle}</span>
              <ExternalLink className="inline-block h-3 w-3 ml-1 flex-shrink-0" />
            </span>
            {byline && (
              <span className="text-xs opacity-75 whitespace-nowrap overflow-hidden text-ellipsis">
                {byline}
              </span>
            )}
          </div>
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
                  window.open(href, '_blank', 'noopener,noreferrer');
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
      className={`
        my-0.5 px-[8px] ${paddingClass}
        inline-flex items-center
        text-sm font-medium
        rounded-[8px]
        transition-colors duration-200
        shadow-sm
        ${variantStyles}
        ${groupId ? 'opacity-90' : ''}
        ${className || ''}
        max-w-full
      `}
    >
      <div className="flex items-center gap-1.5 flex-nowrap max-w-full">
        {showLock && <Lock className="h-3.5 w-3.5 flex-shrink-0" />}
        <span
          className={`whitespace-nowrap overflow-hidden text-ellipsis flex items-center ${isUserLinkType ? 'user-link' : 'page-link'}`}
          data-page-id={isPageLinkType ? pageId : undefined}
          data-user-id={isUserLinkType ? pageId : undefined}
        >
          <span className="truncate inline-block max-w-full">{displayTitle}</span>
        </span>
        {byline && (
          <span className="text-xs opacity-75 whitespace-nowrap overflow-hidden text-ellipsis">
            {byline}
          </span>
        )}
      </div>
    </Link>
  );
}