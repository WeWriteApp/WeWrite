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
  
  // Determine what title to display - use label prop if provided, otherwise use children
  const displayTitle = (isPublic === false && !isCurrentUserOwner) 
    ? "Private Page" 
    : (label || children);
  
  return (
    <Link 
      href={href} 
      className={`
        my-0.5 px-2.5 py-1
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
      <div className="flex items-center gap-1.5 flex-nowrap">
        {showLock && <Lock className="h-3.5 w-3.5 flex-shrink-0" />}
        <div className="flex flex-col min-w-0 max-w-full">
          <span className="leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
            {displayTitle}
          </span>
          {byline && (
            <span className="text-xs opacity-75 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
              {byline}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}