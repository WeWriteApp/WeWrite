"use client";

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const TextHighlighter = ({ contentRef }) => {
  const [highlightedText, setHighlightedText] = useState('');
  const [isHighlighting, setIsHighlighting] = useState(false);

  useEffect(() => {
    // Check if there's a highlight parameter in the URL
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.includes('highlight=')) {
        const highlightId = hash.split('highlight=')[1];

        // Get the highlighted text from localStorage
        const storedHighlight = localStorage.getItem(`highlight_${highlightId}`);

        if (storedHighlight) {
          setHighlightedText(storedHighlight);
          setIsHighlighting(true);

          // Highlight the text in the content
          highlightTextInContent(storedHighlight);
        }
      }
    }
  }, [contentRef]);

  const highlightTextInContent = (text) => {
    if (!contentRef.current || !text) return;

    // Wait for content to be fully rendered
    setTimeout(() => {
      const contentElement = contentRef.current;
      const contentText = contentElement.textContent;

      // Find the text in the content
      const textIndex = contentText.indexOf(text);

      if (textIndex !== -1) {
        // Create a range for the text
        const range = document.createRange();
        const textNodes = [];

        // Get all text nodes in the content
        const walker = document.createTreeWalker(
          contentElement,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        let node;
        while (node = walker.nextNode()) {
          textNodes.push(node);
        }

        // Find the node(s) containing the text
        let currentIndex = 0;
        let startNode = null;
        let startOffset = 0;
        let endNode = null;
        let endOffset = 0;

        for (const node of textNodes) {
          const nodeText = node.textContent;
          const nodeLength = nodeText.length;

          // Check if this node contains the start of the text
          if (!startNode && textIndex >= currentIndex && textIndex < currentIndex + nodeLength) {
            startNode = node;
            startOffset = textIndex - currentIndex;
          }

          // Check if this node contains the end of the text
          const textEnd = textIndex + text.length - 1;
          if (startNode && !endNode && textEnd >= currentIndex && textEnd < currentIndex + nodeLength) {
            endNode = node;
            endOffset = (textEnd - currentIndex) + 1;
            break;
          }

          currentIndex += nodeLength;
        }

        // If we found the text, highlight it
        if (startNode && endNode) {
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);

          // Create custom highlight instead of using browser selection
          const rects = range.getClientRects();
          const highlightContainer = document.createElement('div');
          highlightContainer.className = 'custom-text-highlights';
          highlightContainer.style.position = 'absolute';
          highlightContainer.style.pointerEvents = 'none';
          highlightContainer.style.zIndex = '10';
          document.body.appendChild(highlightContainer);

          // Create highlight elements for each rect in the range
          for (let i = 0; i < rects.length; i++) {
            const rect = rects[i];
            const highlightEl = document.createElement('div');
            highlightEl.className = 'custom-text-highlight';
            highlightEl.style.position = 'absolute';
            highlightEl.style.top = `${rect.top + window.scrollY}px`;
            highlightEl.style.left = `${rect.left + window.scrollX}px`;
            highlightEl.style.width = `${rect.width}px`;
            highlightEl.style.height = `${rect.height}px`;
            highlightEl.style.backgroundColor = 'rgba(var(--accent), 0.1)';
            highlightEl.style.borderRadius = '3px';
            highlightEl.style.pointerEvents = 'none';
            highlightContainer.appendChild(highlightEl);
          }

          // Store the highlight container reference for later removal
          window.customHighlightContainer = highlightContainer;

          // Scroll to the highlighted text
          const firstRect = rects[0];
          window.scrollTo({
            top: firstRect.top + window.scrollY - 100,
            behavior: 'smooth'
          });
        }
      }
    }, 500);
  };

  const dismissHighlight = () => {
    // Clear any browser selection
    window.getSelection().removeAllRanges();

    // Remove custom highlight elements
    if (typeof window !== 'undefined' && window.customHighlightContainer) {
      window.customHighlightContainer.remove();
      window.customHighlightContainer = null;
    }

    // Remove the highlight parameter from the URL
    if (typeof window !== 'undefined') {
      const url = window.location.href.split('#')[0];
      window.history.replaceState({}, document.title, url);
    }

    setIsHighlighting(false);
    setHighlightedText('');
  };

  if (!isHighlighting) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-background border border-border px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <span className="text-sm font-medium">Text highlighted</span>
      <button
        onClick={dismissHighlight}
        className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors text-sm flex items-center gap-1.5"
        aria-label="Dismiss highlight"
      >
        <X className="h-3.5 w-3.5" />
        <span>Dismiss</span>
      </button>
    </div>
  );
};

export default TextHighlighter;
