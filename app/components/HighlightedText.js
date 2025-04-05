"use client";

import React from 'react';

const HighlightedText = ({ text, highlight }) => {
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
          <span key={i} className="bg-yellow-300 dark:bg-yellow-700 rounded-sm px-0.5">
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
