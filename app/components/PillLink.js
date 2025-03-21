"use client";
import React from "react";
import Link from "next/link";
import { Lock, Loader } from "lucide-react";
import { ShimmerEffect } from "./ui/skeleton";
import { useTheme } from "next-themes";
import { useAuth } from "../providers/AuthProvider";
import { motion } from "framer-motion";

export const PillLinkSkeleton = () => {
  return (
    <div className="my-0.5 px-2 py-0.5 inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium rounded-[8px] bg-background/40 border-[1.5px] border-[rgba(255,255,255,0.1)] h-[28px]">
      <Loader className="h-3 w-3 animate-spin text-primary" />
      <span className="text-muted-foreground text-xs">Loading...</span>
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
  variant = "primary"
}) => {
  const { user } = useAuth();
  // Only show lock for private pages (where isPublic is explicitly false)
  const showLock = isPublic === false;
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
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
  
  // Determine what title to display
  const displayTitle = (isPublic === false && !isCurrentUserOwner) ? "Private Page" : children;
  
  return (
    <Link 
      href={href} 
      className={`
        my-0.5 px-2 py-0.5
        inline-flex items-center
        text-sm font-medium
        rounded-[8px]
        transition-colors duration-200
        shadow-sm
        ${variantStyles}
        ${groupId ? 'opacity-90' : ''}
        ${className || ''}
      `}
    >
      <motion.div 
        className="flex items-center gap-1 flex-nowrap"
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {showLock && <Lock className="h-3 w-3 flex-shrink-0" />}
        <motion.div 
          className="flex flex-col min-w-0"
          layout
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <motion.span 
            className="leading-tight whitespace-normal break-words"
            layout
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {displayTitle}
          </motion.span>
          {byline && (
            <motion.span 
              className="text-xs opacity-75 leading-tight break-words"
              layout
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {byline}
            </motion.span>
          )}
        </motion.div>
      </motion.div>
    </Link>
  );
}