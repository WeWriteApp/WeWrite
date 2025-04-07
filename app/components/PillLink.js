"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Lock, Loader } from "lucide-react";
import { ShimmerEffect } from "./ui/skeleton";
import { useTheme } from "next-themes";
import { useAuth } from "../providers/AuthProvider";
import { motion } from "framer-motion";
import { useAccentColor } from "../contexts/AccentColorContext";



export const PillLinkSkeleton = () => {
  return (
    <div className="my-0.5 px-2.5 py-1 inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium rounded-[8px] bg-background/40 border-[1.5px] border-[rgba(255,255,255,0.1)] h-[32px] min-w-[100px]">
      <ShimmerEffect className="h-3.5 w-3.5 rounded-full" />
      <ShimmerEffect className="h-4 w-16 rounded-md" />
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
  // Convert old URL format to new URL format
  if (href) {
    // Convert page URLs
    if (href.startsWith('/pages/')) {
      const pageId = href.replace('/pages/', '');
      if (pageId !== 'new') {
        href = `/${pageId}`;
      }
    }

    // Convert user URLs
    if (href.startsWith('/user/')) {
      const userId = href.replace('/user/', '');
      href = `/u/${userId}`;
    }

    // Convert users URLs
    if (href.startsWith('/users/')) {
      const userId = href.replace('/users/', '');
      href = `/u/${userId}`;
    }

    // Convert group URLs
    if (href.startsWith('/groups/')) {
      const groupId = href.replace('/groups/', '');
      if (groupId !== 'new') {
        href = `/g/${groupId}`;
      }
    }
  }
  const { user } = useAuth();
  // Only show lock for private pages (where isPublic is explicitly false)
  const showLock = isPublic === false;
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { accentColor, customColor } = useAccentColor();
  const [isClicked, setIsClicked] = useState(false);

  if (isLoading) {
    return <PillLinkSkeleton />;
  }

  // Determine styles based on variant
  let variantStyles = "";

  if (variant === "primary") {
    variantStyles = `
      bg-primary text-[var(--accent-text,white)]
      border-theme-light
      hover:bg-primary/80 hover:border-[rgba(255,255,255,0.3)]
    `;
  } else if (variant === "secondary") {
    variantStyles = `
      bg-accent/50 text-foreground
      border-theme-light
      hover:bg-accent/70 hover-border-medium
    `;
  }

  // Extract page ID from href to check if user is the owner
  const pageId = href.split('/').pop();
  const pageOwnerId = groupId?.split('_')[0];
  const isCurrentUserOwner = user && pageOwnerId === user.uid;

  // Determine what title to display - use label prop if provided, otherwise use children
  const displayTitle = (isPublic === false && !isCurrentUserOwner)
    ? "Private Page"
    : (label || children);

  // Handle click animation and show loading state
  const handleClick = (e) => {
    setIsClicked(true);

    // Show loading state immediately
    if (typeof window !== 'undefined') {
      // Remove any existing loading overlays first
      const existingOverlay = document.getElementById('navigation-loading-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }

      // Add a loading overlay - immediately after interaction
      const loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center';
      loadingOverlay.id = 'navigation-loading-overlay';

      const spinner = document.createElement('div');
      spinner.className = 'loader loader-md'; // Use medium size loader
      loadingOverlay.appendChild(spinner);

      // Add a message element
      const message = document.createElement('p');
      message.className = 'text-sm font-medium text-foreground mt-3';
      message.textContent = 'Loading...';
      loadingOverlay.appendChild(message);

      document.body.appendChild(loadingOverlay);

      // Set a longer timeout to remove the overlay (5 seconds) as fallback
      setTimeout(() => {
        const overlay = document.getElementById('navigation-loading-overlay');
        if (overlay) {
          overlay.remove();
        }
      }, 5000);

      // Create a MutationObserver to detect when content has loaded
      const observer = new MutationObserver((mutations) => {
        // Check if main content has loaded and has children (content)
        if (document.querySelector('main') && document.querySelector('main').children.length > 1) {
          // Wait a small amount of time to ensure content is rendered
          setTimeout(() => {
            const overlay = document.getElementById('navigation-loading-overlay');
            if (overlay) {
              // Fade out the overlay
              overlay.style.transition = 'opacity 0.3s ease-out';
              overlay.style.opacity = '0';

              // Remove after transition
              setTimeout(() => {
                if (overlay && overlay.parentNode) {
                  overlay.remove();
                }
              }, 300);
            }
            observer.disconnect();
          }, 200); // Small delay to ensure content is visible
        }
      });

      // Start observing the document with the configured parameters
      observer.observe(document.body, { childList: true, subtree: true });

      // Add event listener to remove the overlay when the page has loaded
      window.addEventListener('load', () => {
        const overlay = document.getElementById('navigation-loading-overlay');
        if (overlay) {
          overlay.style.transition = 'opacity 0.3s ease-out';
          overlay.style.opacity = '0';

          setTimeout(() => {
            if (overlay && overlay.parentNode) {
              overlay.remove();
            }
          }, 300);
        }
        observer.disconnect();
      }, { once: true });

      // Don't prevent default - let the navigation happen naturally
    }
  };

  const linkClasses = `
    my-0.5 px-2.5 py-1
    inline-flex items-center
    text-sm font-medium
    rounded-[8px]
    transition-colors duration-200
    shadow-sm
    max-w-full
    overflow-hidden
    ${variantStyles}
    ${groupId ? 'opacity-90' : ''}
    ${className || ''}
  `;

  return (
    <div className="relative">
      {/* Link with squeeze animation */}
      <motion.div
        animate={isClicked ? { scale: 0.92 } : { scale: 1 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
        <Link
          href={href}
          onClick={handleClick}
          className={linkClasses}
        >
          <div className="flex items-center gap-1.5 flex-nowrap w-full overflow-hidden">
            {showLock && <Lock className="h-3.5 w-3.5 flex-shrink-0" />}
            <div className="flex flex-col min-w-0 w-full overflow-hidden">
              <span className="leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-full block">
                {displayTitle}
              </span>
              {byline && (
                <span className="text-xs opacity-75 leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-full block">
                  {byline}
                </span>
              )}
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Pulse effect that radiates outward */}
      {isClicked && (
        <div className="absolute inset-0 pointer-events-none overflow-visible">
          {/* First pulse ring */}
          <motion.div
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`
              absolute inset-0
              rounded-[8px]
              border-2 border-solid
              border-primary
              blur-[1px]
              shadow-[0_0_10px_rgba(var(--primary-h),var(--primary-s),var(--primary-l),0.5)]
            `}
          />

          {/* Second pulse ring */}
          <motion.div
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeOut", delay: 0.1 }}
            className={`
              absolute inset-0
              rounded-[8px]
              border-2 border-solid
              border-primary
              blur-[2px]
              shadow-[0_0_15px_rgba(var(--primary-h),var(--primary-s),var(--primary-l),0.4)]
            `}
          />

          {/* Third pulse ring */}
          <motion.div
            initial={{ scale: 1, opacity: 0.4 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
            className={`
              absolute inset-0
              rounded-[8px]
              border-2 border-solid
              border-primary
              blur-[3px]
              shadow-[0_0_20px_rgba(var(--primary-h),var(--primary-s),var(--primary-l),0.3)]
            `}
          />

          {/* Reset animation state */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            onAnimationComplete={() => {
              // Reset the animation state if the user navigates back
              setTimeout(() => setIsClicked(false), 200);
            }}
          />
        </div>
      )}
    </div>
  );
};