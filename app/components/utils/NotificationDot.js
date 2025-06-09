"use client";

import React, { useContext, useEffect, useState } from 'react';
import { NotificationContext } from '../../providers/NotificationProvider';
import { useTheme } from '../../providers/ThemeProvider';
import { cn } from '../../lib/utils';

/**
 * NotificationDot Component
 *
 * Displays a dot indicator for unread notifications
 * Shows a black dot in light mode and a white dot in dark mode
 *
 * @param {Object} props
 * @param {string} props.className - Additional CSS classes
 */
export default function NotificationDot({ className }) {
  const { unreadCount } = useContext(NotificationContext);
  const { theme, resolvedTheme } = useTheme();
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
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
