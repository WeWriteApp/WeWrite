"use client";
import React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

export const PillLink = ({ children, href, isPublic, groupId, className, isOwned }) => {
  // Only show lock for private pages (where isPublic is explicitly false)
  const showLock = isPublic === false;
  
  return (
    <Link 
      href={href} 
      className={`
        my-1 px-3 py-1.5
        inline-block whitespace-nowrap
        text-sm font-medium
        rounded-[12px]
        transition-colors duration-200
        bg-[#0057FF]
        border-[1.5px] border-[rgba(255,255,255,0.3)]
        text-white
        shadow-sm
        hover:bg-[#0046CC]
        hover:border-[rgba(255,255,255,0.5)]
        ${groupId ? 'opacity-90' : ''}
        ${className || ''}
      `}
    >
      <div className="flex items-center gap-2">
        {showLock && <Lock className="h-3 w-3" />}
        {children}
      </div>
    </Link>
  );
}