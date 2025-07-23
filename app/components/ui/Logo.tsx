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
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Ensure component is mounted before using theme
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Determine which logo to use based on resolved theme
  const logoSrc = React.useMemo(() => {
    // During SSR or before mounting, always use light logo to prevent hydration mismatch
    if (!mounted) {
      return '/images/logos/logo-light.svg';
    }

    // resolvedTheme gives us the actual theme being used (light/dark)
    // even when theme is set to "system"
    const currentTheme = resolvedTheme || theme;
    return currentTheme === 'dark'
      ? '/images/logos/logo-dark.svg'
      : '/images/logos/logo-light.svg';
  }, [theme, resolvedTheme, mounted]);

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
        'inline-flex items-center justify-center transition-all duration-200',
        styled && [
          'border border-theme-medium bg-background shadow-sm rounded-lg overflow-hidden',
          'hover:shadow-md hover:border-theme-medium',
          size === 'sm' ? 'h-5 w-5' : 'h-9 w-9'
        ],
        clickable && 'hover:opacity-80 cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <Image
        src={logoSrc}
        alt={alt}
        width={styled ? (size === 'sm' ? 20 : 36) : dimensions.width}
        height={styled ? (size === 'sm' ? 20 : 36) : dimensions.height}
        priority={priority}
        className={cn(
          'transition-opacity duration-200',
          styled && 'object-cover w-full h-full'
        )}
      />
    </div>
  );

  return logoElement;
}

export default Logo;
