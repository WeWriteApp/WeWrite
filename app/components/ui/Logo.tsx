"use client";

import React from 'react';
import Image from 'next/image';
import { cn } from '../../lib/utils';

export interface LogoProps {
  /** Size variant for the logo */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Custom width override */
  width?: number;
  /** Custom height override */
  height?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show as a clickable link */
  clickable?: boolean;
  /** Click handler if not using default navigation */
  onClick?: () => void;
  /** Alt text for accessibility */
  alt?: string;
  /** Priority loading for above-the-fold logos */
  priority?: boolean;
  /** Whether to apply button-style border and shadow */
  styled?: boolean;
}

const sizeMap = {
  sm: { width: 16, height: 16 }, // Much smaller for collapsed headers
  md: { width: 36, height: 36 }, // Match button size (h-9 w-9)
  lg: { width: 36, height: 36 }, // Match button size (h-9 w-9)
  xl: { width: 48, height: 48 }
};

/**
 * Logo component that automatically switches between light and dark versions
 * based on the current theme. Uses the theme-aware logo files.
 */
export function Logo({
  size = 'md',
  width,
  height,
  className,
  clickable = false,
  onClick,
  alt = 'WeWrite Logo',
  priority = false,
  styled = false
}: LogoProps) {
  // Get dimensions
  const dimensions = React.useMemo(() => {
    if (width && height) {
      return { width, height };
    }
    return sizeMap[size];
  }, [size, width, height]);

  const logoElement = (
    <div
      className={cn(
        'inline-flex items-center justify-center relative',
        styled && [
          'border border-neutral-alpha-3 bg-background shadow-sm rounded-lg overflow-hidden',
          'hover:shadow-md hover:border-neutral-alpha-5',
          size === 'sm' ? 'h-5 w-5' : 'h-9 w-9'
        ],
        clickable && 'hover:opacity-80 cursor-pointer transition-opacity duration-200',
        className
      )}
      onClick={onClick}
    >
      {/* Light theme logo */}
      <Image
        src="/images/logos/logo-light.svg"
        alt={alt}
        width={styled ? (size === 'sm' ? 20 : 36) : dimensions.width}
        height={styled ? (size === 'sm' ? 20 : 36) : dimensions.height}
        priority={priority}
        className={cn(
          'transition-opacity duration-150 ease-in-out dark:opacity-0',
          styled && 'object-cover w-full h-full'
        )}
      />

      {/* Dark theme logo */}
      <Image
        src="/images/logos/logo-dark.svg"
        alt={alt}
        width={styled ? (size === 'sm' ? 20 : 36) : dimensions.width}
        height={styled ? (size === 'sm' ? 20 : 36) : dimensions.height}
        priority={priority}
        className={cn(
          'absolute inset-0 transition-opacity duration-150 ease-in-out opacity-0 dark:opacity-100',
          styled && 'object-cover w-full h-full'
        )}
      />
    </div>
  );

  return logoElement;
}

export default Logo;
