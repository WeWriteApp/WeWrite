"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from './Logo';
import { cn } from '../../lib/utils';

export interface WeWriteLogoProps {
  /** Size variant for the logo and text */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the logo in a styled container */
  styled?: boolean;
  /** Whether the component is clickable */
  clickable?: boolean;
  /** Custom click handler */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the text next to the logo */
  showText?: boolean;
  /** Custom text to display (defaults to "WeWrite") */
  text?: string;
  /** Priority loading for above-the-fold logos */
  priority?: boolean;
}

const sizeConfig = {
  sm: {
    logoSize: 'sm' as const,
    textClass: 'text-lg font-bold',
    gap: 'gap-2'
  },
  md: {
    logoSize: 'md' as const,
    textClass: 'text-xl font-bold',
    gap: 'gap-2'
  },
  lg: {
    logoSize: 'lg' as const,
    textClass: 'text-2xl font-bold',
    gap: 'gap-3'
  }
};

/**
 * WeWriteLogo Component
 * 
 * A reusable component that combines the WeWrite logo with text.
 * Used consistently across logged-in and logged-out headers.
 * 
 * Features:
 * - Theme-aware logo that switches between light/dark versions
 * - Consistent rounded container styling when styled=true
 * - Configurable sizes and text display
 * - Clickable navigation to homepage
 */
export function WeWriteLogo({
  size = 'md',
  styled = false,
  clickable = true,
  onClick,
  className,
  showText = true,
  text = 'WeWrite',
  priority = false
}: WeWriteLogoProps) {
  const router = useRouter();
  const config = sizeConfig[size];

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (clickable) {
      router.push('/');
    }
  };

  return (
    <div
      className={cn(
        'flex items-center',
        config.gap,
        clickable && 'cursor-pointer transition-transform hover:scale-105',
        className
      )}
      onClick={handleClick}
    >
      {/* Logo */}
      <Logo
        size={config.logoSize}
        styled={styled}
        clickable={false} // Handle click at parent level
        priority={priority}
      />

      {/* Text */}
      {showText && (
        <span
          className={cn(
            config.textClass,
            'text-foreground transition-colors'
          )}
        >
          {text}
        </span>
      )}
    </div>
  );
}

export default WeWriteLogo;
