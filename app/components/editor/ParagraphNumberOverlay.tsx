"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useLineSettings, LINE_MODES } from '../../contexts/LineSettingsContext';

interface ParagraphNumberOverlayProps {
  editorRef: React.RefObject<HTMLDivElement>;
}

/**
 * ParagraphNumberOverlay - Renders paragraph numbers as a completely separate overlay
 * 
 * This component creates paragraph numbers that are:
 * - Completely separate from the contentEditable area
 * - Absolutely positioned to align with paragraphs
 * - Completely non-interactive (no selection, no deletion possible)
 * - Automatically updated when content changes
 */
const ParagraphNumberOverlay: React.FC<ParagraphNumberOverlayProps> = ({ editorRef }) => {
  const { lineMode } = useLineSettings();
  const [paragraphPositions, setParagraphPositions] = useState<Array<{ top: number; number: number }>>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Update paragraph positions based on editor content
  const updateParagraphPositions = () => {
    if (!editorRef.current) {
      setParagraphPositions([]);
      return;
    }

    const editorRect = editorRef.current.getBoundingClientRect();
    const paragraphs = editorRef.current.querySelectorAll('div');
    const positions: Array<{ top: number; number: number }> = [];

    paragraphs.forEach((paragraph, index) => {
      const paragraphRect = paragraph.getBoundingClientRect();
      const relativeTop = paragraphRect.top - editorRect.top;

      positions.push({
        top: relativeTop,
        number: index + 1
      });
    });

    setParagraphPositions(positions);
  };

  // Set up observers to watch for content changes
  useEffect(() => {
    if (!editorRef.current) return;

    // Initial update
    updateParagraphPositions();

    // Watch for DOM changes (content changes)
    observerRef.current = new MutationObserver((mutations) => {
      // CRITICAL FIX: Ensure editor always has at least one paragraph
      if (editorRef.current && editorRef.current.children.length === 0) {
        editorRef.current.innerHTML = '<div><br></div>';
      }

      // Debounce the update to avoid excessive recalculations
      setTimeout(updateParagraphPositions, 10);
    });

    observerRef.current.observe(editorRef.current, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // Watch for size changes (window resize, etc.)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current = new ResizeObserver(() => {
        setTimeout(updateParagraphPositions, 10);
      });
      resizeObserverRef.current.observe(editorRef.current);
    }

    // CRITICAL FIX: Add additional protection against content deletion
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editorRef.current) return;

      if ((e.key === 'Backspace' || e.key === 'Delete')) {
        const divs = editorRef.current.querySelectorAll('div');
        if (divs.length <= 1) {
          const lastDiv = divs[0];
          if (lastDiv && lastDiv.textContent?.trim() === '') {
            // Prevent deletion of the last empty paragraph
            setTimeout(() => {
              if (editorRef.current && editorRef.current.children.length === 0) {
                editorRef.current.innerHTML = '<div><br></div>';
              }
            }, 0);
          }
        }
      }
    };

    editorRef.current.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (editorRef.current) {
        editorRef.current.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [editorRef, lineMode]);

  // Update positions when line mode changes
  useEffect(() => {
    updateParagraphPositions();
  }, [lineMode]);

  // In dense mode, paragraph numbers are handled by CSS pseudo-elements
  // In normal mode, we render absolute positioned numbers
  if (lineMode === LINE_MODES.DENSE) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className="paragraph-number-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '2.5rem',
        height: '100%',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 1,
        overflow: 'hidden'
      }}
    >
      {paragraphPositions.map((position, index) => (
        <div
          key={`paragraph-${position.number}-${index}`}
          className="paragraph-number-item"
          style={{
            position: 'absolute',
            top: `${position.top + 8}px`, // Align with text baseline
            left: '0.5rem',
            width: '1rem',
            textAlign: 'right',
            color: 'var(--muted-foreground)',
            fontSize: '0.75rem',
            opacity: 0.8,
            lineHeight: 1.5,
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            cursor: 'default',
            // Additional protection
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          {position.number}
        </div>
      ))}
    </div>
  );
};

export default ParagraphNumberOverlay;
