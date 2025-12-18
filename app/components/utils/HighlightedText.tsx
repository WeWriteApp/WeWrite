"use client";

import React, { useEffect, useState } from 'react';
import { escapeRegexChars } from '../../utils/textHighlighting';

interface HighlightedTextProps {
  text: string;
  highlight?: string;
  className?: string;
  highlightClassName?: string;
  caseSensitive?: boolean;
}

const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  highlight,
  className = '',
  highlightClassName = '',
  caseSensitive = false
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Detect dark mode only after hydration
  useEffect(() => {
    setIsHydrated(true);

    // Check if dark mode is enabled
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);

    // Listen for theme changes
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
  }, []);

  if (!highlight || !text) {
    return <span className={className}>{text}</span>;
  }

  // Escape special characters in the highlight string for regex
  const escapedHighlight = escapeRegexChars(highlight);

  // Create a regex pattern
  const flags = caseSensitive ? 'g' : 'gi';
  const regex = new RegExp(`(${escapedHighlight})`, flags);

  // Split the text by the regex pattern
  const parts = text.split(regex);

  const defaultHighlightStyle = {
    backgroundColor: `rgba(var(--accent-color-rgb, 23, 104, 255), ${isDarkMode ? '0.3' : '0.2'})`,
    color: isDarkMode ? 'white' : 'inherit'
  };

  return (
    <span className={className}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span
            key={i}
            className={`highlight-text rounded-sm px-0.5 ${highlightClassName}`}
            style={highlightClassName ? undefined : defaultHighlightStyle}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

export default HighlightedText;