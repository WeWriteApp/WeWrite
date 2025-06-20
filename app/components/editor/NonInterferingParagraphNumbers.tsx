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
        // Show paragraph 1 at the top when no content exists - improved alignment
        positions.push({
          top: 12, // Improved baseline alignment for empty content
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

          // Position numbers to align with text baseline - improved alignment
          // Calculate the proper baseline offset for better visual alignment
          const baselineOffset = 12; // Adjusted to center with first line baseline
          positions.push({
            top: relativeTop + baselineOffset, // Better alignment with text baseline
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
          className="absolute select-none"
          style={{
            top: position.top,
            left: '0.5rem', // FIXED: Position close to content, not way off to the left
            width: '1.5rem', // Compact width for paragraph numbers
            textAlign: 'right',
            paddingRight: '0.25rem', // Small padding from the editor content
            pointerEvents: 'none',
            userSelect: 'none',
            lineHeight: '1.5',
            /* Consistent styling with view mode paragraph numbers */
            color: 'hsl(var(--muted-foreground))',
            fontSize: '0.85em', // Consistent sizing: 85% of main text size
            opacity: 'var(--paragraph-number-opacity, 0.7)', // Accessible opacity: 70% for better contrast
            fontWeight: 400, // Normal weight for subtle appearance
            transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            // Prevent layout shifts by maintaining stable dimensions
            boxSizing: 'border-box',
            contain: 'layout style',
            // Improved baseline alignment
            transform: 'translateY(-1px)' // Fine-tune vertical alignment with text baseline
          }}
        >
          {position.number}
        </div>
      ))}
    </div>
  );
};

export default NonInterferingParagraphNumbers;
