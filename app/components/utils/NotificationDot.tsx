"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { cn } from '../../lib/utils';

/**
 * NotificationDot Component
 *
 * Displays a dot indicator for unread notifications
 * Shows a black dot in light mode and a white dot in dark mode
 */
interface NotificationDotProps {
  className?: string;
}

export default function NotificationDot({ className }: NotificationDotProps) {
  const { unreadCount } = useNotifications();
  const { theme } = useTheme();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Detect dark mode only after hydration
  useEffect(() => {
    setIsHydrated(true);

    // Check if we're in dark mode based on the resolved theme
    setIsDarkMode(resolvedTheme === 'dark');

    // Also listen for theme changes in the DOM for immediate updates
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          setIsDarkMode(isDark);
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, [resolvedTheme]);

  if (unreadCount <= 0) {
    return null;
  }

  // Prevent hydration mismatch by using a neutral color until hydrated
  if (!isHydrated) {
    return (
      <div
        className={cn(
          "absolute top-0 right-0 w-2 h-2 rounded-full bg-gray-500",
          className
        )}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={cn(
        "absolute top-0 right-0 w-2 h-2 rounded-full",
        isDarkMode ? "bg-white" : "bg-black",
        className
      )}
      aria-hidden="true"
    />
  );
}