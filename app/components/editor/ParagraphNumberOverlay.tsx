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

    // Only update positions in normal mode
    if (lineMode === LINE_MODES.DENSE) {
      setParagraphPositions([]);
      return;
    }

    const editorRect = editorRef.current.getBoundingClientRect();
    const paragraphs = editorRef.current.querySelectorAll('div');
    const positions: Array<{ top: number; number: number }> = [];

    paragraphs.forEach((paragraph, index) => {
      // Skip if paragraph is not visible or has no content
      if (paragraph.offsetHeight === 0) return;

      const paragraphRect = paragraph.getBoundingClientRect();
      const relativeTop = paragraphRect.top - editorRect.top;

      // Adjust for paragraph padding to align with text baseline
      // The paragraph has 0.5rem (8px) padding-top, so we add that to align properly
      positions.push({
        top: relativeTop + 8, // Add padding offset to align with text
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

      if (lineMode === LINE_MODES.DENSE) {
        // Dense mode: inline layout
        numberSpan.className = 'dense-paragraph-number';
        numberSpan.contentEditable = 'false'; // Make completely non-editable
        numberSpan.style.cssText = `
          display: inline;
          color: var(--muted-foreground);
          font-size: 0.75rem;
          opacity: 0.8;
          margin-right: 0.25rem;
          user-select: none;
          pointer-events: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        `;
        paragraph.style.display = 'inline';
        paragraph.style.marginLeft = '0';
        paragraph.style.textIndent = '0';
        paragraph.style.marginRight = '0.5rem';
      } else {
        // Normal mode: first child in hanging indent layout
        numberSpan.className = 'unified-paragraph-number';
        numberSpan.contentEditable = 'false'; // Make completely non-editable
        numberSpan.style.cssText = `
          display: inline-block;
          width: 1.5rem;
          text-align: right;
          color: var(--muted-foreground);
          font-size: 0.75rem;
          opacity: 0.8;
          margin-right: 0.5rem;
          user-select: none;
          pointer-events: none;
          line-height: 1.5;
          vertical-align: top;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        `;
        paragraph.style.display = 'block';
        paragraph.style.marginLeft = '0'; // No margin needed
        paragraph.style.textIndent = '0'; // No text indent needed
        paragraph.style.marginRight = '0';
      }

      // Insert as first child
      paragraph.insertBefore(numberSpan, paragraph.firstChild);

      // CRITICAL FIX: Ensure there's always a text node for content after the paragraph number
      // This prevents cursor from getting stuck in the paragraph number area
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

        // If this paragraph currently has focus, position cursor in the content area
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const currentContainer = range.startContainer;

          // Check if cursor is currently in this paragraph
          let isInThisParagraph = false;
          let checkNode = currentContainer;
          while (checkNode && checkNode !== document.body) {
            if (checkNode === paragraph) {
              isInThisParagraph = true;
              break;
            }
            checkNode = checkNode.parentNode;
          }

          // If cursor is in this paragraph and in a bad position, move it to content area
          if (isInThisParagraph &&
              (currentContainer === paragraph ||
               currentContainer === numberSpan ||
               (currentContainer.nodeType === Node.TEXT_NODE && currentContainer.parentElement === numberSpan))) {

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
