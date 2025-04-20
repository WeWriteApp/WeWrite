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
      }, 300); // Shorter delay for better user experience

      return () => clearTimeout(checkForHighlight);
    }
  }, [contentRef]);

  // Add scroll event listener to update highlight positions
  useEffect(() => {
    if (!isHighlighting) return;

    // Use requestAnimationFrame for smooth scrolling updates
    let ticking = false;
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      lastScrollY = window.scrollY;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Update highlight positions when scrolling
          if (window.customHighlightContainer) {
            // Instead of recreating all highlights, just update their positions
            updateHighlightPositionsOnScroll(lastScrollY);
          }
          ticking = false;
        });

        ticking = true;
      }
    };

    // Update positions on resize as well
    const handleResize = () => {
      if (window.customHighlightContainer) {
        // On resize, we need to completely recalculate
        updateHighlightPositions();
      }
    };

    // Handle page navigation/unload to clean up highlights
    const handleBeforeUnload = () => {
      dismissHighlight();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Clean up highlights when component unmounts
      if (window.customHighlightContainer) {
        window.customHighlightContainer.remove();
        window.customHighlightContainer = null;
      }
    };
  }, [isHighlighting]);

  // Function to adjust notification position if needed
  const positionNotification = () => {
    // No need to adjust position as it's now fixed at the top
    // This function is kept for compatibility with existing code
  };

  // Function to update highlight positions by recalculating everything
  const updateHighlightPositions = () => {
    if (!contentRef.current || !highlightedText || !window.customHighlightContainer) return;

    // Re-highlight the text to update positions
    highlightTextInContent(highlightedText, true);
  };

  // Function to efficiently update highlight positions during scrolling
  const updateHighlightPositionsOnScroll = (scrollY) => {
    if (!window.customHighlightContainer) return;

    // Get all highlight elements
    const highlights = window.customHighlightContainer.querySelectorAll('.custom-text-highlight');

    // Get the current scroll position
    const currentScrollY = scrollY;

    // If we have stored the original positions, use them to update
    if (window.highlightOriginalPositions && window.highlightOriginalPositions.length === highlights.length) {
      highlights.forEach((highlight, index) => {
        const originalTop = window.highlightOriginalPositions[index].top;
        // Update the position based on scroll
        highlight.style.top = `${originalTop - currentScrollY}px`;
      });
    } else {
      // If we don't have original positions, recalculate everything
      updateHighlightPositions();
    }
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
          highlightContainer.className = 'custom-text-highlights';
          highlightContainer.style.position = 'fixed';
          highlightContainer.style.top = '0';
          highlightContainer.style.left = '0';
          highlightContainer.style.width = '100%';
          highlightContainer.style.height = '100%';
          highlightContainer.style.pointerEvents = 'none';
          highlightContainer.style.zIndex = '40'; // Lower than the notification (z-50)
          // Add darkening overlay effect
          const isDarkMode = document.documentElement.classList.contains('dark');
          highlightContainer.style.backgroundColor = isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)';
          document.body.appendChild(highlightContainer);

          // Store reference to the container
          highlightContainerRef.current = highlightContainer;

          // Store original positions for efficient scrolling updates
          window.highlightOriginalPositions = [];

          // Create highlight elements for each rect in the range
          for (let i = 0; i < rects.length; i++) {
            const rect = rects[i];
            const highlightEl = document.createElement('div');
            highlightEl.className = 'custom-text-highlight';
            highlightEl.style.position = 'fixed';

            // Calculate position relative to viewport
            const top = rect.top + window.scrollY;
            const left = rect.left + window.scrollX;

            // Store original position for scroll updates
            window.highlightOriginalPositions.push({ top, left });

            // Set initial position
            highlightEl.style.top = `${top - window.scrollY}px`;
            highlightEl.style.left = `${left - window.scrollX}px`;
            highlightEl.style.width = `${rect.width}px`;
            highlightEl.style.height = `${rect.height}px`;

            // Use mix-blend-mode: difference for the punched-out effect
            // This creates a "hole" in the overlay where text is visible
            highlightEl.style.backgroundColor = 'white';
            highlightEl.style.borderRadius = '3px';
            highlightEl.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5)';
            highlightEl.style.mixBlendMode = 'difference';
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
    }, 300); // Shorter delay for better user experience
  };

  const dismissHighlight = () => {
    // Clear any browser selection
    window.getSelection().removeAllRanges();

    // Remove custom highlight elements
    if (typeof window !== 'undefined' && window.customHighlightContainer) {
      window.customHighlightContainer.remove();
      window.customHighlightContainer = null;
    }

    // Remove notification element
    if (notificationRef.current) {
      notificationRef.current.remove();
      notificationRef.current = null;
    }

    // Clean up stored positions
    if (window.highlightOriginalPositions) {
      window.highlightOriginalPositions = null;
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

  // Create a portal for the notification to be rendered at the top of the document
  useEffect(() => {
    if (!isHighlighting) return;

    // Create notification element
    const notificationEl = document.createElement('div');
    notificationEl.id = 'highlight-notification';
    notificationEl.className = 'fixed top-0 left-0 right-0 z-50 bg-background border-b border-border px-4 py-2 shadow-md flex items-center justify-between animate-in fade-in slide-in-from-top-5 duration-300';
    notificationEl.style.zIndex = '100'; // Higher than everything else

    // Create text span
    const textSpan = document.createElement('span');
    textSpan.className = 'text-sm font-medium';
    textSpan.textContent = `Text highlighted ${highlighterUsername ? `by ${highlighterUsername}` : 'by logged out user'}`;
    notificationEl.appendChild(textSpan);

    // Create dismiss button
    const dismissButton = document.createElement('button');
    dismissButton.className = 'px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors text-sm flex items-center gap-1.5';
    dismissButton.setAttribute('aria-label', 'Dismiss highlight');
    dismissButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span>Dismiss</span>`;
    dismissButton.addEventListener('click', dismissHighlight);
    notificationEl.appendChild(dismissButton);

    // Insert at the beginning of the body, before any other elements
    document.body.insertBefore(notificationEl, document.body.firstChild);

    // Store reference
    notificationRef.current = notificationEl;

    return () => {
      // Clean up
      if (notificationRef.current) {
        notificationRef.current.remove();
      }
    };
  }, [isHighlighting, highlighterUsername]);

  // Return null since we're using a portal
  return null;
};

export default TextHighlighter;
