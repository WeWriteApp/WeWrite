"use client";
import React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { ShimmerEffect } from "./ui/skeleton";
import { Loader } from "lucide-react";
import { useTheme } from "next-themes";

export const PillLinkSkeleton = () => {
  return (
    <div className="my-1 px-3 py-1.5 inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium rounded-[12px] bg-background/40 border-[1.5px] border-[rgba(255,255,255,0.1)] h-[38px]">
      <Loader className="h-3 w-3 animate-spin text-primary" />
      <span className="text-muted-foreground">Loading...</span>
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
  isLoading
}) => {
  // Only show lock for private pages (where isPublic is explicitly false)
  const showLock = isPublic === false;
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  if (isLoading) {
    return <PillLinkSkeleton />;
  }
  
  return (
    <Link 
      href={href} 
      className={`
        my-1 px-3 py-1
        inline-block whitespace-nowrap
        text-sm font-medium
        rounded-[12px]
        transition-colors duration-200
        bg-[#0057FF] text-white
        border-[1.5px] border-[rgba(255,255,255,0.2)]
        hover:bg-[#0046CC] hover:border-[rgba(255,255,255,0.3)]
        shadow-sm
        ${groupId ? 'opacity-90' : ''}
        ${className || ''}
      `}
    >
      <div className="flex items-center gap-1.5">
        {showLock && <Lock className="h-3 w-3" />}
        <div className="flex flex-col">
          <span className="leading-tight">{children}</span>
          {byline && <span className="text-xs opacity-75 leading-tight">{byline}</span>}
        </div>
      </div>
    </Link>
  );
}