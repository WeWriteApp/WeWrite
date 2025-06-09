"use client";

import React, { useEffect, useState } from 'react';

const HighlightedText = ({ text, highlight }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
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
    return <span>{text}</span>;
  }

  // Escape special characters in the highlight string for regex
  const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Create a regex pattern that's case insensitive
  const regex = new RegExp(`(${escapedHighlight})`, 'gi');

  // Split the text by the regex pattern
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="highlight-text rounded-sm px-0.5" style={{
            backgroundColor: `rgba(var(--accent-color-rgb, 23, 104, 255), ${isDarkMode ? '0.3' : '0.2'})`,
            color: isDarkMode ? 'white' : 'inherit'
          }}>
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
