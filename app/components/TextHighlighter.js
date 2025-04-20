"use client";

import React, { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';

const TextHighlighter = ({ contentRef }) => {
  const [highlightedText, setHighlightedText] = useState('');
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [highlighterUsername, setHighlighterUsername] = useState(null);
  const highlightContainerRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    // Check if there's a highlight parameter in the URL
    if (typeof window !== 'undefined' && contentRef.current) {
      // Use a longer delay to ensure content is fully rendered
      const checkForHighlight = setTimeout(() => {
        const hash = window.location.hash;
        if (hash && hash.includes('highlight=')) {
          const highlightId = hash.split('highlight=')[1];

          // Get the highlighted text from localStorage
          const storedHighlightData = localStorage.getItem(`highlight_${highlightId}`);

          if (storedHighlightData) {
            try {
              // Parse the stored highlight data
              const highlightInfo = JSON.parse(storedHighlightData);
              console.log('Found highlight in localStorage:', highlightInfo);

              if (highlightInfo && highlightInfo.text) {
                setHighlightedText(highlightInfo.text);
                setIsHighlighting(true);

                // Set the username if available
                if (highlightInfo.username) {
                  setHighlighterUsername(highlightInfo.username);
                }

                // Highlight the text in the content
                highlightTextInContent(highlightInfo.text);
              } else {
                console.log('Invalid highlight data format');
              }
            } catch (err) {
              // Handle legacy format (plain text)
              console.log('Using legacy highlight format');
              setHighlightedText(storedHighlightData);
              setIsHighlighting(true);
              highlightTextInContent(storedHighlightData);
            }
          } else {
            console.log('No highlight found in localStorage for ID:', highlightId);
          }
        }
      }, 1500); // Longer delay to ensure content is fully loaded

      return () => clearTimeout(checkForHighlight);
    }
  }, [contentRef]);

  // Add scroll event listener to update highlight positions
  useEffect(() => {
    if (!isHighlighting) return;

    const handleScroll = () => {
      // Update highlight positions when scrolling
      if (window.customHighlightContainer) {
        updateHighlightPositions();
      }

      // Position the notification above the pledge bar
      positionNotification();
    };

    // Update positions on resize as well
    const handleResize = () => {
      if (window.customHighlightContainer) {
        updateHighlightPositions();
      }
      positionNotification();
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);

    // Initial positioning
    positionNotification();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [isHighlighting]);

  // Function to position the notification above the pledge bar
  const positionNotification = () => {
    if (!notificationRef.current) return;

    // Check if pledge bar exists
    const pledgeBar = document.querySelector('[data-pledge-bar]');
    const pledgeBarHeight = pledgeBar ? pledgeBar.offsetHeight : 0;
    const pledgeBarVisible = pledgeBar ? window.getComputedStyle(pledgeBar).display !== 'none' : false;

    // Position the notification above the pledge bar if visible
    if (pledgeBarVisible) {
      notificationRef.current.style.bottom = `${pledgeBarHeight + 16}px`;
    } else {
      notificationRef.current.style.bottom = '16px';
    }
  };

  // Function to update highlight positions
  const updateHighlightPositions = () => {
    if (!contentRef.current || !highlightedText || !window.customHighlightContainer) return;

    // Re-highlight the text to update positions
    highlightTextInContent(highlightedText, true);
  };

  const highlightTextInContent = (text, isUpdate = false) => {
    if (!contentRef.current || !text) return;

    // Remove any existing highlights first
    if (typeof window !== 'undefined' && window.customHighlightContainer) {
      window.customHighlightContainer.remove();
      window.customHighlightContainer = null;
    }

    // Wait for content to be fully rendered
    setTimeout(() => {
      const contentElement = contentRef.current;
      if (!contentElement) return;

      const contentText = contentElement.textContent;
      console.log('Content length:', contentText.length, 'Search text length:', text.length);

      // Find the text in the content
      const textIndex = contentText.indexOf(text);
      console.log('Text index:', textIndex);

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

        console.log('Found text nodes:', textNodes.length);

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
            console.log('Found start node at index:', currentIndex, 'offset:', startOffset);
          }

          // Check if this node contains the end of the text
          const textEnd = textIndex + text.length - 1;
          if (startNode && !endNode && textEnd >= currentIndex && textEnd < currentIndex + nodeLength) {
            endNode = node;
            endOffset = (textEnd - currentIndex) + 1;
            console.log('Found end node at index:', currentIndex, 'offset:', endOffset);
            break;
          }

          currentIndex += nodeLength;
        }

        // If we found the text, highlight it
        if (startNode && endNode) {
          console.log('Setting range from', startNode, startOffset, 'to', endNode, endOffset);
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);

          // Create custom highlight instead of using browser selection
          const rects = range.getClientRects();
          console.log('Found', rects.length, 'rects to highlight');

          // Create a container for all highlights
          const highlightContainer = document.createElement('div');
          highlightContainer.id = 'custom-text-highlights-container';
          highlightContainer.style.position = 'fixed';
          highlightContainer.style.top = '0';
          highlightContainer.style.left = '0';
          highlightContainer.style.width = '100%';
          highlightContainer.style.height = '100%';
          highlightContainer.style.pointerEvents = 'none';
          highlightContainer.style.zIndex = '10';
          document.body.appendChild(highlightContainer);

          // Store reference to the container
          highlightContainerRef.current = highlightContainer;

          // Create highlight elements for each rect in the range
          for (let i = 0; i < rects.length; i++) {
            const rect = rects[i];
            const highlightEl = document.createElement('div');
            highlightEl.className = 'custom-text-highlight';
            highlightEl.style.position = 'fixed';
            highlightEl.style.top = `${rect.top}px`;
            highlightEl.style.left = `${rect.left}px`;
            highlightEl.style.width = `${rect.width}px`;
            highlightEl.style.height = `${rect.height}px`;
            highlightEl.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
            highlightEl.style.borderRadius = '3px';
            highlightEl.style.boxShadow = '0 0 0 1px rgba(59, 130, 246, 0.05)';
            highlightEl.style.pointerEvents = 'none';
            highlightContainer.appendChild(highlightEl);
          }

          // Store the highlight container reference for later removal
          window.customHighlightContainer = highlightContainer;

          // Scroll to the highlighted text
          if (rects.length > 0) {
            const firstRect = rects[0];
            window.scrollTo({
              top: firstRect.top + window.scrollY - 100,
              behavior: 'smooth'
            });
          }
        } else {
          console.log('Could not find start or end node for the text');
        }
      } else {
        console.log('Text not found in content');
      }
    }, 1500); // Longer delay to ensure content is fully loaded
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
    <div
      ref={notificationRef}
      className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-background border border-border px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300"
      style={{ bottom: '16px' }} // Initial position, will be updated by positionNotification
    >
      <span className="text-sm font-medium">
        Text highlighted {highlighterUsername ? `by ${highlighterUsername}` : 'by logged out user'}
      </span>
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
