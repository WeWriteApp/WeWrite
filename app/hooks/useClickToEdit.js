"use client";

import { useEffect, useRef } from 'react';
import { ReactEditor } from 'slate-react';
import { Transforms, Editor, Range, Point } from 'slate';

/**
 * Hook to handle click-to-edit functionality with cursor positioning
 * @param {Object} editor - Slate editor instance
 * @param {Object} clickPosition - Position where user clicked to enter edit mode
 * @param {boolean} isEditing - Whether currently in edit mode
 * @param {Array} content - Editor content for calculating cursor position
 */
export const useClickToEdit = (editor, clickPosition, isEditing, content) => {
  const positionedRef = useRef(false);

  useEffect(() => {
    if (!editor || !clickPosition || !isEditing || positionedRef.current) {
      return;
    }

    // Mark as positioned to prevent multiple attempts
    positionedRef.current = true;

    // Use a timeout to ensure the editor is fully rendered
    const timer = setTimeout(() => {
      try {
        // Focus the editor first
        ReactEditor.focus(editor);

        // Try to position cursor based on click position
        if (clickPosition.y && content && Array.isArray(content)) {
          // Estimate which paragraph was clicked based on Y position
          // This is a rough approximation - in a real implementation you'd want
          // more precise positioning based on actual DOM measurements
          const estimatedParagraphHeight = 60; // Approximate height per paragraph
          const paragraphIndex = Math.floor(clickPosition.y / estimatedParagraphHeight);

          // Ensure we don't exceed the content bounds
          const clampedParagraph = Math.min(paragraphIndex, content.length - 1);
          const targetParagraph = Math.max(0, clampedParagraph);

          // Position cursor at the beginning of the target paragraph
          const point = { path: [targetParagraph, 0], offset: 0 };

          // Validate the point exists in the editor
          if (Editor.hasPath(editor, point.path)) {
            Transforms.select(editor, point);
          } else {
            // Fallback to end of document
            Transforms.select(editor, Editor.end(editor, []));
          }
        } else {
          // Fallback: position at the end of the document
          Transforms.select(editor, Editor.end(editor, []));
        }
      } catch (error) {
        console.error('Error positioning cursor in edit mode:', error);
        // Fallback: just focus the editor
        try {
          ReactEditor.focus(editor);
        } catch (focusError) {
          console.error('Error focusing editor:', focusError);
        }
      }
    }, 100); // Short delay to ensure editor is ready

    return () => {
      clearTimeout(timer);
    };
  }, [editor, clickPosition, isEditing, content]);

  // Reset positioned flag when exiting edit mode
  useEffect(() => {
    if (!isEditing) {
      positionedRef.current = false;
    }
  }, [isEditing]);
};

/**
 * Helper function to calculate approximate cursor position from click coordinates
 * @param {Object} clickPosition - Click coordinates
 * @param {Array} content - Editor content
 * @returns {Object} Estimated cursor position
 */
export const calculateCursorPosition = (clickPosition, content) => {
  if (!clickPosition || !content || !Array.isArray(content)) {
    return { path: [0, 0], offset: 0 };
  }

  // Rough estimation based on typical paragraph heights
  const estimatedParagraphHeight = 60;
  const paragraphIndex = Math.floor(clickPosition.y / estimatedParagraphHeight);

  // Clamp to valid range
  const targetParagraph = Math.max(0, Math.min(paragraphIndex, content.length - 1));

  // For now, position at the beginning of the paragraph
  // In a more sophisticated implementation, you could estimate character position
  // based on clickPosition.x and font metrics
  return { path: [targetParagraph, 0], offset: 0 };
};

/**
 * Helper function to safely focus and position cursor in editor
 * @param {Object} editor - Slate editor instance
 * @param {Object} position - Target cursor position
 */
export const safeFocusAndPosition = (editor, position) => {
  try {
    if (!editor || !ReactEditor) return false;

    // Focus the editor
    ReactEditor.focus(editor);

    // Position cursor if position is provided
    if (position && Editor.hasPath(editor, position.path)) {
      Transforms.select(editor, position);
      return true;
    }
  } catch (error) {
    console.error('Error in safeFocusAndPosition:', error);
  }

  return false;
};
