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

    // Dense mode removed - always update positions in normal mode

    const editorRect = editorRef.current.getBoundingClientRect();
    const paragraphs = editorRef.current.querySelectorAll('div');
    const positions: Array<{ top: number; number: number }> = [];

    paragraphs.forEach((paragraph, index) => {
      // Skip if paragraph is not visible or has no content
      if (paragraph.offsetHeight === 0) return;

      const paragraphRect = paragraph.getBoundingClientRect();
      const relativeTop = paragraphRect.top - editorRect.top;

      // Adjust for paragraph padding to align with text baseline - improved alignment
      // Calculate the proper baseline offset for better visual alignment
      const baselineOffset = 12; // Adjusted to center with first line baseline
      positions.push({
        top: relativeTop + baselineOffset, // Better alignment with text baseline
        number: index + 1
      });
    });

    setParagraphPositions(positions);
  };

  // Set up observers to watch for content changes
  useEffect(() => {
    if (!editorRef.current) return;

    // Delay initial update to prevent flicker
    const initialTimeout = setTimeout(() => {
      updateParagraphPositions();
    }, 50);

    // Watch for DOM changes (content changes)
    observerRef.current = new MutationObserver((mutations) => {
      // CRITICAL FIX: Ensure editor always has at least one paragraph
      if (editorRef.current && editorRef.current.children.length === 0) {
        editorRef.current.innerHTML = '<div><br></div>';
      }

      // Check if this is a paragraph merge operation (paragraph removal)
      let isParagraphMerge = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'DIV') {
              isParagraphMerge = true;
            }
          });
        }
      });

      // Use shorter delay for paragraph merges to reduce flickering
      const delay = isParagraphMerge ? 5 : 10;
      setTimeout(updateParagraphPositions, delay);
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
      clearTimeout(initialTimeout);
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
  }, [editorRef]);

  // Update positions when line mode changes with a delay to allow DOM to settle
  useEffect(() => {
    // Add a small delay to allow CSS transitions and DOM changes to complete
    const timeoutId = setTimeout(() => {
      updateParagraphPositions();
    }, 300); // Wait for CSS transition to complete

    return () => clearTimeout(timeoutId);
  }, [lineMode]);

  // Inject paragraph numbers as first child and apply layout styling
  useEffect(() => {
    if (!editorRef.current) return;

    // Dense mode removed - always inject paragraph numbers in normal mode

    const paragraphs = editorRef.current.querySelectorAll('div');

    // Use requestAnimationFrame to batch DOM updates and reduce flickering
    requestAnimationFrame(() => {
      paragraphs.forEach((paragraph, index) => {
        // Check if paragraph number already exists and is correct
        const existingNumber = paragraph.querySelector('.unified-paragraph-number, .dense-paragraph-number');
        if (existingNumber && existingNumber.textContent === `${index + 1}`) {
          // Number is already correct, skip this paragraph
          return;
        }

        // Remove any existing paragraph numbers
        const existingNumbers = paragraph.querySelectorAll('.unified-paragraph-number, .dense-paragraph-number');
        existingNumbers.forEach(number => number.remove());

        // Create paragraph number as first child - NO absolute positioning
        const numberSpan = document.createElement('span');
        numberSpan.textContent = `${index + 1}`;

        // SIMPLIFIED: Use margin-based approach like view mode without complex wrappers
        numberSpan.className = 'unified-paragraph-number';
        numberSpan.contentEditable = 'false';

        // Reset paragraph to normal block layout - no flex
        paragraph.style.display = 'block';
        paragraph.style.alignItems = '';
        paragraph.style.flexWrap = '';
        paragraph.style.marginLeft = '2rem'; // Create space for paragraph number
        paragraph.style.textIndent = '0';
        paragraph.style.marginRight = '0';
        paragraph.style.paddingLeft = '0';
        paragraph.style.position = 'relative'; // For absolute positioning of number

        // Position paragraph number absolutely to avoid interfering with content flow
        numberSpan.style.position = 'absolute';
        numberSpan.style.left = '0.5rem';
        numberSpan.style.top = '0.25rem'; // Align with paragraph padding
        numberSpan.style.width = '1.5rem';
        numberSpan.style.textAlign = 'right';
        numberSpan.style.pointerEvents = 'none';
        numberSpan.style.userSelect = 'none';

        // Insert as first child - positioned absolutely so it doesn't affect content flow
        paragraph.insertBefore(numberSpan, paragraph.firstChild);

      // SIMPLIFIED: Ensure there's content for typing and cursor isn't in paragraph number
      let hasContentNode = false;
      let nextNode = numberSpan.nextSibling;

      while (nextNode) {
        if (nextNode.nodeType === Node.TEXT_NODE && nextNode.textContent && nextNode.textContent.length > 0) {
          hasContentNode = true;
          break;
        } else if (nextNode.nodeType === Node.ELEMENT_NODE && (nextNode as Element).tagName !== 'BR') {
          hasContentNode = true;
          break;
        }
        nextNode = nextNode.nextSibling;
      }

      // If no content node exists, create one for typing
      if (!hasContentNode) {
        // Remove any BR elements that might interfere
        const brElements = paragraph.querySelectorAll('br');
        brElements.forEach(br => br.remove());

        // Create a text node for content
        const contentTextNode = document.createTextNode('');
        paragraph.appendChild(contentTextNode);

        // If cursor is in paragraph number, move it to content area
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const currentContainer = range.startContainer;

          // If cursor is in paragraph number, move it to content
          if (currentContainer === numberSpan ||
              (currentContainer.nodeType === Node.TEXT_NODE && currentContainer.parentElement === numberSpan)) {
            try {
              const newRange = document.createRange();
              newRange.setStart(contentTextNode, 0);
              newRange.collapse(true);

              selection.removeAllRanges();
              selection.addRange(newRange);
            } catch (error) {
              console.error('Error positioning cursor in content area:', error);
            }
          }
        }
      }
    });
    });
  }, [lineMode, paragraphPositions]);

  // No overlay needed - paragraph numbers are injected as first child of each paragraph
  return null;
};

export default ParagraphNumberOverlay;
