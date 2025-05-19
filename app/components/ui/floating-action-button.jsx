"use client";

import React from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAccentColor } from '../../contexts/AccentColorContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

// Simple utility function to combine class names
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

export function FloatingActionButton({
  onClick,
  href,
  icon = <Plus className="h-6 w-6 text-white" />,
  className,
  ...props
}) {
  const router = useRouter();
  const { accentColor } = useAccentColor();

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    } else if (href) {
      router.push(href);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_4px_14px_rgba(var(--accent-h),var(--accent-s),var(--accent-l),0.39)] hover:bg-primary/90 hover:shadow-[0_6px_20px_rgba(var(--accent-h),var(--accent-s),var(--accent-l),0.23)] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200",
              className
            )}
            onClick={handleClick}
            aria-label="Create new page"
            {...props}
          >
            {icon}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-primary text-primary-foreground font-medium"
          sideOffset={8}
        >
          Create New Page
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
