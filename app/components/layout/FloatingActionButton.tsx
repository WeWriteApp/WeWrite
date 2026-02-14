"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useAuth } from '../../providers/AuthProvider';
import { isPWA } from '../../utils/pwa-detection';
import { MOBILE_BREAKPOINT } from '../../constants/layout';
import { usePageVisibility } from '../../hooks/usePageVisibility';
import { buildNewPageUrl } from '../../utils/pageId';

// Helper function to check if device is iOS
const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
};

/**
 * FloatingActionButton Component
 *
 * A floating action button for creating new pages on both mobile and desktop.
 * Features:
 * - Shows on NavPages, settings pages, and user's own pages
 * - Hides on other people's pages (where pledge bar is visible)
 * - Uses accent color styling
 * - Responsive positioning for mobile and desktop
 * - Simplified and reliable behavior
 */
import FixedPortal from "../utils/FixedPortal";

export default function FloatingActionButton() {
  const router = useRouter();
  const { user } = useAuth();
  const { shouldShowFAB, shouldShowMobileNav } = usePageVisibility();

  // PWA mode detection for mobile positioning
  const [isPWAMode, setIsPWAMode] = useState(false);

  // Check PWA mode on mount and window resize
  useEffect(() => {
    const checkPWAMode = () => {
      setIsPWAMode(isPWA());
    };

    checkPWAMode();

    // Listen for display mode changes
    const mediaQueries = [
      '(display-mode: standalone)',
      '(display-mode: fullscreen)',
      '(display-mode: minimal-ui)',
      '(display-mode: window-controls-overlay)'
    ];

    const listeners: (() => void)[] = [];

    mediaQueries.forEach(query => {
      const mediaQuery = window.matchMedia(query);
      const listener = () => setTimeout(checkPWAMode, 100);
      mediaQuery.addEventListener('change', listener);
      listeners.push(() => mediaQuery.removeEventListener('change', listener));
    });

    window.addEventListener('resize', checkPWAMode);

    return () => {
      window.removeEventListener('resize', checkPWAMode);
      listeners.forEach(cleanup => cleanup());
    };
  }, []);

  const handleNewPageClick = () => {
    // Scroll to top before navigation to prevent flash of previous page's scroll position
    window.scrollTo(0, 0);
    router.push(buildNewPageUrl());
  };

// Track window width for responsive positioning
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate bottom position based on screen size and mobile nav visibility
  const bottomPosition = React.useMemo(() => {
    // On desktop, use fixed bottom position
    if (!isMobile) {
      return 'calc(var(--fixed-safe-bottom) + 16px)'; // Use fixed-layer system + extra spacing
    }

    // On mobile, position above floating mobile nav when visible
    if (shouldShowMobileNav) {
      const navHeight = 80; // Height of mobile nav content
      const toolbarMargin = 16; // Match the toolbar's margin from bottom edge
      // Position FAB with same margin from toolbar as toolbar has from bottom edge
      return `calc(var(--fixed-safe-bottom) + ${navHeight + toolbarMargin}px)`;
    }

    // When mobile nav is hidden, use fixed-layer system with toolbar margin
    return 'calc(var(--fixed-safe-bottom) + 16px)';
  }, [shouldShowMobileNav, isMobile]);

  // Don't render if conditions not met
  if (!shouldShowFAB) {
    return null;
  }

  return (
    <FixedPortal>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed pointer-events-auto"
        style={{
          right: '1rem',
          bottom: bottomPosition,
          zIndex: 90,
          transition: 'bottom 300ms ease-in-out'
        }}
      >
        <Button
          onClick={handleNewPageClick}
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full shadow-lg pointer-events-auto",
            "bg-primary hover:bg-primary/90 text-primary-foreground",
            "flex items-center justify-center"
          )}
          aria-label="Create new page"
          id="floating-action-button"
        >
          <Icon name="Plus" size={24} />
        </Button>
      </motion.div>
    </FixedPortal>
  );
}

// Export with old name for backward compatibility
export { FloatingActionButton as MobileFloatingActionButton };
