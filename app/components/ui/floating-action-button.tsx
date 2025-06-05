"use client";

import React from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAccentColor } from '../../contexts/AccentColorContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';

interface FloatingActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  href?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function FloatingActionButton({
  onClick,
  href,
  icon = <Plus className="h-6 w-6 text-white" />,
  className,
  ...props
}: FloatingActionButtonProps) {
  const router = useRouter();
  const { accentColor } = useAccentColor();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (onClick) {
      onClick(e);
    } else if (href) {
      // Add source parameter when navigating to /new to trigger slide-up animation
      const targetUrl = href === '/new' ? '/new?source=fab' : href;
      router.push(targetUrl);
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
