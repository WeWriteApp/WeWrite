"use client";

import React, { useEffect, useState, useRef } from 'react';

interface NonInterferingParagraphNumbersProps {
  editorRef: React.RefObject<HTMLDivElement>;
}

/**
 * NonInterferingParagraphNumbers - Pure overlay that never touches the contenteditable DOM
 * 
 * This component:
 * - Creates a completely separate overlay positioned above the editor
 * - Never modifies the contenteditable DOM in any way
 * - Never adds event listeners to the editor
 * - Never manipulates cursor position
 * - Only reads DOM positions to align numbers with paragraphs
 */
const NonInterferingParagraphNumbers: React.FC<NonInterferingParagraphNumbersProps> = ({ editorRef }) => {
  const [paragraphPositions, setParagraphPositions] = useState<Array<{ top: number; number: number }>>([]);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update paragraph positions by reading DOM (never modifying)
  const updateParagraphPositions = () => {
    if (!editorRef.current) {
      setParagraphPositions([]);
      return;
    }

    try {
      const editorRect = editorRef.current.getBoundingClientRect();
      const paragraphs = editorRef.current.querySelectorAll('div');
      const positions: Array<{ top: number; number: number }> = [];

      // CRITICAL FIX: Always show at least paragraph 1, even if no content
      if (paragraphs.length === 0) {
        // Show paragraph 1 at the top when no content exists
        positions.push({
          top: 8, // Standard padding from top
          number: 1
        });
      } else {
        // Count all paragraphs, including empty ones
        let visibleParagraphCount = 0;
        paragraphs.forEach((paragraph, index) => {
          const paragraphRect = paragraph.getBoundingClientRect();
          const relativeTop = paragraphRect.top - editorRect.top;

          // Count this as a visible paragraph
          visibleParagraphCount++;

          // Position numbers to align with text baseline
          positions.push({
            top: relativeTop + 8, // Adjust for padding to align with text
            number: visibleParagraphCount
          });
        });
      }

      setParagraphPositions(positions);
    } catch (error) {
      console.error('Error updating paragraph positions:', error);
    }
  };

  // Debounced update function to avoid excessive re-renders
  const debouncedUpdate = () => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(updateParagraphPositions, 10);
  };

  // Set up observers to watch for content changes (read-only)
  useEffect(() => {
    if (!editorRef.current) return;

    // Initial update
    updateParagraphPositions();

    // Watch for DOM changes (read-only observation)
    const observer = new MutationObserver(debouncedUpdate);
    observer.observe(editorRef.current, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // Watch for size changes
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(debouncedUpdate);
      resizeObserver.observe(editorRef.current);
    }

    // Watch for scroll changes
    const handleScroll = debouncedUpdate;
    editorRef.current.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      observer.disconnect();
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (editorRef.current) {
        editorRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, [editorRef]);

  // Render pure overlay (never touches contenteditable)
  return (
    <div
      className="absolute inset-0 pointer-events-none z-10"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        userSelect: 'none'
      }}
    >
      {paragraphPositions.map((position) => (
        <div
          key={`para-${position.number}-${position.top}`}
          className="absolute text-muted-foreground text-sm font-mono select-none"
          style={{
            top: position.top,
            left: '-3rem', // Position further left with padding from screen edge
            width: '2.5rem', // Wider to accommodate padding
            textAlign: 'right',
            paddingRight: '0.5rem', // Add padding from the editor content
            pointerEvents: 'none',
            userSelect: 'none',
            lineHeight: '1.5'
          }}
        >
          {position.number}
        </div>
      ))}
    </div>
  );
};

export default NonInterferingParagraphNumbers;
