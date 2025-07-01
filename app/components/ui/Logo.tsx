"use client";

import React from 'react';
import Image from 'next/image';
import { useTheme } from '../../providers/ThemeProvider';
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
}

const sizeMap = {
  sm: { width: 24, height: 24 },
  md: { width: 32, height: 32 },
  lg: { width: 40, height: 40 },
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
  priority = false
}: LogoProps) {
  const { theme, resolvedTheme } = useTheme();
  
  // Determine which logo to use based on resolved theme
  const logoSrc = React.useMemo(() => {
    // resolvedTheme gives us the actual theme being used (light/dark)
    // even when theme is set to "system"
    const currentTheme = resolvedTheme || theme;
    return currentTheme === 'dark' 
      ? '/images/logos/logo-dark.svg'
      : '/images/logos/logo-light.svg';
  }, [theme, resolvedTheme]);

  // Get dimensions
  const dimensions = React.useMemo(() => {
    if (width && height) {
      return { width, height };
    }
    return sizeMap[size];
  }, [size, width, height]);

  const logoElement = (
    <Image
      src={logoSrc}
      alt={alt}
      width={dimensions.width}
      height={dimensions.height}
      priority={priority}
      className={cn(
        'transition-opacity duration-200',
        clickable && 'hover:opacity-80 cursor-pointer',
        className
      )}
      onClick={onClick}
    />
  );

  return logoElement;
}

export default Logo;
