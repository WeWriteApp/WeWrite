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
        relative
        my-1 px-3 py-1.5
        inline-block whitespace-nowrap
        bg-[#0057FF]
        text-white text-sm font-medium
        rounded-[12px]
        before:content-['']
        before:absolute before:inset-0
        before:rounded-[12px]
        before:border before:border-white/30
        before:shadow-[inset_0_0_16px_rgba(255,255,255,0.3)]
        hover:bg-[#0046CC]
        transition-colors duration-200
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