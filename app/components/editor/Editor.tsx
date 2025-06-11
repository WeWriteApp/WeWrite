"use client";

import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  createEditor,
  Transforms,
  Editor,
  Element as SlateElement,
  Range,
  Node,
  Path,
  Point,
  BaseEditor,
  Descendant
} from "slate";
import { Editable, withReact, useSlate, Slate, ReactEditor } from "slate-react";
import { withHistory, HistoryEditor } from "slate-history";
import { ExternalLink, Link as LinkIcon, Info, X, AlertTriangle } from "lucide-react";
import { useLineSettings } from '../../contexts/LineSettingsContext';
import { usePillStyle } from '../../contexts/PillStyleContext';
import { useFeatureFlag } from '../../utils/feature-flags';
import { useAuth } from '../../providers/AuthProvider';
import { useAccentColor } from '../../contexts/AccentColorContext';
import Modal from '../ui/modal';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import type { EditorProps, EditorRef, LinkData } from "../../types/components";
import type { SlateContent, SlateNode, SlateChild } from "../../types/database";
import DisabledLinkModal from "../utils/DisabledLinkModal";
import { updateParagraphIndices, getParagraphIndex } from "../../utils/slate-path-fix";
import { validateLink } from '../../utils/linkValidator';
import { formatPageTitle, formatUsername, isUserLink, isPageLink, isExternalLink } from "../../utils/linkFormatters";
import { Switch } from "../ui/switch";

// Extend Slate types for TypeScript
type CustomEditor = BaseEditor & ReactEditor & HistoryEditor;

type ParagraphElement = {
  type: 'paragraph';
  children: CustomText[];
};

type LinkElement = {
  type: 'link';
  url: string;
  isExternal?: boolean;
  pageId?: string;
  showAuthor?: boolean;
  children: CustomText[];
};

type CustomElement = ParagraphElement | LinkElement;

type FormattedText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
};

type CustomText = FormattedText;

declare module 'slate' {
  interface CustomTypes {
    Editor: CustomEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}
import SearchResults from "../search/SearchResults";
import FilteredSearchResults from "../search/FilteredSearchResults";
// Import slate patches to handle DOM node resolution errors
import "../../utils/slate-patch";

// Safely check if ReactEditor methods exist before using them
const safeReactEditor = {
  focus: (editor) => {
    try {
      if (ReactEditor && typeof ReactEditor.focus === 'function') {
        ReactEditor.focus(editor);
        return true;
      }
    } catch (error) {
      console.error('Error in safeReactEditor.focus:', error);
    }
    return false;
  },
  toDOMRange: (editor, selection) => {
    try {
      if (ReactEditor && typeof ReactEditor.toDOMRange === 'function') {
        return ReactEditor.toDOMRange(editor, selection);
      }
    } catch (error) {
      console.error('Error in safeReactEditor.toDOMRange:', error);
    }
    return null;
  },
  toDOMNode: (editor, node) => {
    try {
      if (ReactEditor && typeof ReactEditor.toDOMNode === 'function') {
        return ReactEditor.toDOMNode(editor, node);
      }
    } catch (error) {
      console.error('Error in safeReactEditor.toDOMNode:', error);
      // Try to find the DOM node by other means as a fallback
      try {
        if (node && typeof node === 'object' && 'text' in node) {
          const textNodes = document.querySelectorAll('[data-slate-leaf]');
          for (const textNode of textNodes) {
            if (textNode.textContent === node.text) {
              return textNode;
            }
          }
        }
      } catch (fallbackError) {
        console.error('Error in toDOMNode fallback:', fallbackError);
      }
    }
    return null;
  },
  isFocused: (editor) => {
    try {
      if (ReactEditor && typeof ReactEditor.isFocused === 'function') {
        return ReactEditor.isFocused(editor);
      }
    } catch (error) {
      console.error('Error in safeReactEditor.isFocused:', error);
    }
    return false;
  },
  findPath: (editor, node) => {
    try {
      if (ReactEditor && typeof ReactEditor.findPath === 'function') {
        return ReactEditor.findPath(editor, node);
      }
    } catch (error) {
      console.error('Error in safeReactEditor.findPath:', error);
    }
    return [0];
  },
  // Add safe wrappers for DOM point conversion
  toDOMPoint: (editor, point) => {
    try {
      if (ReactEditor && typeof ReactEditor.toDOMPoint === 'function') {
        // Validate point before calling the function
        if (!point || !point.path || !Array.isArray(point.path) || typeof point.offset !== 'number') {
          console.warn('Invalid point structure in safeReactEditor.toDOMPoint:', point);
          // Try to find a safe fallback
          const firstTextNode = document.querySelector('[data-slate-leaf]');
          if (firstTextNode) {
            return [firstTextNode, 0];
          }
          return null;
        }

        return ReactEditor.toDOMPoint(editor, point);
      }
    } catch (error) {
      console.error('Error in safeReactEditor.toDOMPoint:', error, 'Point:', point);

      // Enhanced fallback for toDOMPoint errors
      try {
        const textNodes = document.querySelectorAll('[data-slate-leaf]');
        if (textNodes.length > 0) {
          // Try to find the appropriate text node based on the point path
          if (point && point.path && Array.isArray(point.path)) {
            const pathIndex = point.path[0] || 0;
            if (pathIndex < textNodes.length) {
              const targetNode = textNodes[pathIndex];
              const safeOffset = Math.min(point.offset || 0, targetNode.textContent?.length || 0);
              return [targetNode, safeOffset];
            }
          }

          // Fallback to first text node
          return [textNodes[0], 0];
        }
      } catch (fallbackError) {
        console.error('Error in toDOMPoint fallback:', fallbackError);
      }
    }
    return null;
  },
  toSlatePoint: (editor, domPoint) => {
    try {
      if (ReactEditor && typeof ReactEditor.toSlatePoint === 'function') {
        return ReactEditor.toSlatePoint(editor, domPoint, { exactMatch: false, suppressThrow: true });
      }
    } catch (error) {
      console.error('Error in safeReactEditor.toSlatePoint:', error);
    }
    return null;
  }
};

// Helper to create a default paragraph
const createDefaultParagraph = () => ({
  type: 'paragraph',
  children: [{ text: '' }]
});

// Helper to ensure valid editor content
const ensureValidContent = (content) => {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return [createDefaultParagraph()];
  }
  return content;
};

// Helper function to check if selection is at or contains a link
(Editor as any).isSelectionAtLink = (editor, linkPath) => {
  try {
    if (!editor.selection) return false;

    // Get the range of the link node
    const linkStart = Editor.start(editor, linkPath);
    const linkEnd = Editor.end(editor, linkPath);
    const linkRange = { anchor: linkStart, focus: linkEnd };

    // Check if the current selection overlaps with the link range
    return Range.includes(linkRange, editor.selection.anchor) ||
           Range.includes(linkRange, editor.selection.focus) ||
           Range.includes(editor.selection, linkStart) ||
           Range.includes(editor.selection, linkEnd);
  } catch (error) {
    console.error('Error in isSelectionAtLink:', error);
    return false;
  }
};

// Helper function to check if a link is fully selected (entire link is selected)
(Editor as any).isLinkFullySelected = (editor, linkPath) => {
  try {
    if (!editor.selection) return false;

    // Get the range of the link node
    const linkStart = Editor.start(editor, linkPath);
    const linkEnd = Editor.end(editor, linkPath);

    // Check if the selection exactly matches the link range
    return Point.equals(editor.selection.anchor, linkStart) &&
           Point.equals(editor.selection.focus, linkEnd) ||
           Point.equals(editor.selection.anchor, linkEnd) &&
           Point.equals(editor.selection.focus, linkStart);
  } catch (error) {
    console.error('Error in isLinkFullySelected:', error);
    return false;
  }
};

// Helper function to find the currently selected link (if any)
(Editor as any).getSelectedLink = (editor) => {
  try {
    if (!editor.selection) return null;

    // Try to find a link node that contains or is contained by the current selection
    const linkEntry = Editor.above(editor, {
      at: editor.selection,
      match: n => (n as any).type === 'link',
    });

    return linkEntry;
  } catch (error) {
    console.error('Error in getSelectedLink:', error);
    return null;
  }
};

/**
 * EditorComponent
 *
 * The main rich text editor component that provides a consistent editing experience
 * across different content types (wiki pages, group about pages, user bios).
 */
const EditorComponent = forwardRef<EditorRef, EditorProps>((props, ref) => {
  const {
    initialContent = [createDefaultParagraph()],
    onChange,
    placeholder = "Start typing...",
    contentType = "wiki",
    onKeyDown,
    onEmptyLinesChange
  } = props;

  // Get user context for feature flags
  const { user } = useAuth();

  // Check if link functionality is enabled
  const linkFunctionalityEnabled = useFeatureFlag('link_functionality', user?.email);

  // State for disabled link modal
  const [showDisabledLinkModal, setShowDisabledLinkModal] = useState(false);

  // State to track if editor is properly hydrated
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Create editor instance with custom normalizer
  const [editor] = useState(() => {
    // Create the base editor
    const baseEditor = withHistory(withReact(createEditor()));

    // CRITICAL FIX: Enhanced DOM node resolution with better error handling
    // Override ReactEditor methods to prevent DOM resolution errors
    const originalToDOMNode = ReactEditor.toDOMNode;
    ReactEditor.toDOMNode = (editor, node) => {
      try {
        // Check if DOM is ready and editor is properly initialized
        if (typeof window === 'undefined' || !document || document.readyState === 'loading') {
          console.warn('DOM not ready for toDOMNode operation');
          return document.createElement('div');
        }

        // Check if we have Slate elements in the DOM
        const slateElements = document.querySelectorAll('[data-slate-editor], [data-slate-node], [data-slate-leaf]');
        if (slateElements.length === 0) {
          console.warn('No Slate elements found in DOM');
          return document.createElement('div');
        }

        const result = originalToDOMNode(editor, node);
        return result || document.createElement('div');
      } catch (error) {
        console.warn('toDOMNode error handled:', error);

        // Enhanced fallback for text nodes
        if (node && typeof node === 'object' && 'text' in node) {
          const textNodes = document.querySelectorAll('[data-slate-leaf]');
          for (const textNode of textNodes) {
            if (textNode.textContent === (node as any).text) {
              return textNode as HTMLElement;
            }
          }
          // Return first available text node as fallback
          if (textNodes.length > 0) {
            return textNodes[0] as HTMLElement;
          }
        }

        return document.createElement('div');
      }
    };

    // CRITICAL FIX: Configure links as inline elements
    const { isInline } = baseEditor;
    baseEditor.isInline = element => {
      return element.type === 'link' ? true : isInline(element);
    };

    // Store the original normalizeNode function
    const originalNormalizeNode = baseEditor.normalizeNode;

    // Add custom normalizer that preserves links and updates paragraph indices safely
    baseEditor.normalizeNode = entry => {
      try {
        const [node, path] = entry;

        // CRITICAL FIX: Handle link nodes specially to prevent deletion
        if (SlateElement.isElement(node) && node.type === 'link') {
          console.log('LINK_PRESERVATION: Processing link node in normalizer:', {
            url: node.url,
            children: node.children,
            path: path
          });

          // Ensure link has required properties but don't modify structure
          if (!(node as any).url) {
            console.log('LINK_PRESERVATION: Link missing URL, attempting to fix or remove');
            // If no URL, convert to normal text
            if ((node as any).href) {
              // Handle legacy href attribute
              console.log('LINK_PRESERVATION: Converting href to url');
              Transforms.setNodes(
                baseEditor,
                { url: (node as any).href },
                { at: path }
              );
            } else {
              // Remove the link formatting if no URL available
              console.log('LINK_PRESERVATION: Removing invalid link');
              Transforms.unwrapNodes(baseEditor, { at: path });
            }
            return; // Return early as we've handled this node
          }
          // Link is valid, let original normalizer handle it
          console.log('LINK_PRESERVATION: Link is valid, preserving');
        }

        // Run the original normalizer for all other cases
        originalNormalizeNode(entry);

        // CRITICAL FIX: Only update paragraph indices at the root level
        // and only when we're not in the middle of other operations
        if (path.length === 0 && baseEditor.children) {
          // Use a timeout to avoid interfering with ongoing operations
          setTimeout(() => {
            try {
              if (baseEditor.children) {
                const updatedChildren = updateParagraphIndices(baseEditor.children);
                // Only update if there are actual changes and we're not destroying content
                if (updatedChildren !== baseEditor.children &&
                    updatedChildren.length === baseEditor.children.length) {
                  baseEditor.children = updatedChildren;
                }
              }
            } catch (error) {
              console.error("Error updating paragraph indices in timeout:", error);
            }
          }, 0);
        }
      } catch (error) {
        console.error('Error in custom normalizeNode:', error);
        // Try to continue with original normalizeNode
        try {
          originalNormalizeNode(entry);
        } catch (fallbackError) {
          console.error('Error in fallback normalizeNode:', fallbackError);
        }
      }
    };

    return baseEditor;
  });

  const [editorValue, setEditorValue] = useState(ensureValidContent(initialContent));
  const [selection, setSelection] = useState<Range | null>(null);
  const editableRef = useRef<HTMLDivElement | null>(null);
  const lastSelectionRef = useRef<Range | null>(null);

  // CRITICAL FIX: Add missing state variables for link editor
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkEditorPosition, setLinkEditorPosition] = useState({ top: 0, left: 0 });
  const [initialLinkValues, setInitialLinkValues] = useState<{
    text?: string;
    pageId?: string | null;
    pageTitle?: string;
    initialTab?: string;
    showAuthor?: boolean;
    authorUsername?: string | null;
  }>({});

  // State to track if component is mounted (for portal rendering)
  const [isMounted, setIsMounted] = useState(false);

  // State for empty line guidance modal
  const [showEmptyLineModal, setShowEmptyLineModal] = useState(false);

  // State for empty lines warning alert
  const [showEmptyLinesAlert, setShowEmptyLinesAlert] = useState(false);
  const [emptyLinesCount, setEmptyLinesCount] = useState(0);

  // Utility function to detect if a paragraph contains only whitespace
  const isEmptyLine = useCallback((element: any) => {
    if (element.type !== 'paragraph') return false;

    // Check if all children are empty or contain only whitespace
    return element.children.every((child: any) => {
      if (child.text) {
        // Check if text contains only whitespace characters
        return /^\s*$/.test(child.text);
      }
      // FIX: Links and other non-text nodes should be considered as content
      // Only return true (empty) for truly empty nodes, not links
      if (child.type === 'link') {
        return false; // Links are valid content, not empty
      }
      return true; // Other non-text nodes are considered empty for this purpose
    });
  }, []);

  // Smart function to determine if an empty line should be highlighted
  const shouldHighlightEmptyLine = useCallback((element: any, index: number, allChildren: any[]) => {
    // First check if it's actually an empty line
    if (!isEmptyLine(element)) return false;

    const totalLines = allChildren.length;

    // Rule 1: Never highlight the final empty line
    if (index === totalLines - 1) return false;

    // Count consecutive empty lines from the end
    let trailingEmptyCount = 0;
    for (let i = totalLines - 1; i >= 0; i--) {
      if (isEmptyLine(allChildren[i])) {
        trailingEmptyCount++;
      } else {
        break;
      }
    }

    // Rule 3: Smart handling of multiple trailing empty lines
    if (index >= totalLines - trailingEmptyCount) {
      // This is a trailing empty line
      const positionFromEnd = totalLines - 1 - index;

      // Always leave the last 2 empty lines unhighlighted
      if (positionFromEnd < 2) return false;

      // Only highlight if there are more than 2 trailing empty lines
      return trailingEmptyCount > 2;
    }

    // Rule 2: Only highlight "orphaned" empty lines (surrounded by content)
    // Check if there's non-empty content both before and after this empty line
    let hasContentBefore = false;
    let hasContentAfter = false;

    // Check for content before
    for (let i = index - 1; i >= 0; i--) {
      if (!isEmptyLine(allChildren[i])) {
        hasContentBefore = true;
        break;
      }
    }

    // Check for content after (excluding trailing empty lines)
    for (let i = index + 1; i < totalLines - trailingEmptyCount; i++) {
      if (!isEmptyLine(allChildren[i])) {
        hasContentAfter = true;
        break;
      }
    }

    // Only highlight if there's content both before and after
    return hasContentBefore && hasContentAfter;
  }, [isEmptyLine]);

  // Function to count empty lines that would be highlighted (problematic empty lines)
  const countEmptyLines = useCallback(() => {
    if (!editor || !editor.children) return 0;

    let count = 0;
    for (let i = 0; i < editor.children.length; i++) {
      const node = editor.children[i];
      if (shouldHighlightEmptyLine(node, i, editor.children)) {
        count++;
      }
    }
    return count;
  }, [editor, shouldHighlightEmptyLine]);

  // Function to update empty lines alert state
  const updateEmptyLinesAlert = useCallback(() => {
    const count = countEmptyLines();
    setEmptyLinesCount(count);

    // Notify parent component about empty lines count
    if (onEmptyLinesChange) {
      onEmptyLinesChange(count);
    }

    // Show alert if there are empty lines and it's not already dismissed
    if (count > 0 && !showEmptyLinesAlert) {
      setShowEmptyLinesAlert(true);
    } else if (count === 0) {
      setShowEmptyLinesAlert(false);
    }
  }, [countEmptyLines, showEmptyLinesAlert, onEmptyLinesChange]);

  // Function to delete problematic empty lines (only those that would be highlighted)
  const deleteAllEmptyLines = useCallback(() => {
    if (!editor || !editor.children) return;

    // Save current selection to restore later
    const currentSelection = editor.selection;

    // Find all problematic empty line paths (in reverse order to avoid index shifting)
    const emptyLinePaths: Path[] = [];
    for (let i = editor.children.length - 1; i >= 0; i--) {
      const node = editor.children[i];
      if (shouldHighlightEmptyLine(node, i, editor.children)) {
        emptyLinePaths.push([i]);
      }
    }

    // Remove empty lines using Slate transforms
    Editor.withoutNormalizing(editor, () => {
      for (const path of emptyLinePaths) {
        try {
          Transforms.removeNodes(editor, { at: path });
        } catch (error) {
          console.warn('Failed to remove empty line at path:', path, error);
        }
      }
    });

    // Ensure we have at least one paragraph
    if (editor.children.length === 0) {
      Transforms.insertNodes(editor, {
        type: 'paragraph',
        children: [{ text: '' }]
      });
    }

    // Try to restore selection or set to beginning
    try {
      if (currentSelection && Editor.hasPath(editor, currentSelection.anchor.path)) {
        Transforms.select(editor, currentSelection);
      } else {
        // Set cursor to the beginning of the first paragraph
        Transforms.select(editor, {
          anchor: { path: [0, 0], offset: 0 },
          focus: { path: [0, 0], offset: 0 }
        });
      }
    } catch (error) {
      console.warn('Failed to restore selection after deleting empty lines:', error);
    }

    // Update alert state
    setShowEmptyLinesAlert(false);
    setEmptyLinesCount(0);
  }, [editor, shouldHighlightEmptyLine]);

  // Track if we've already set up the editor
  const isInitializedRef = useRef(false);

  // Function to force update paragraph indices
  const forceUpdateParagraphIndices = useCallback(() => {
    try {
      if (editor && editor.children) {
        // Create a new array with updated paragraph indices
        const updatedChildren = updateParagraphIndices(editor.children);

        // Update the editor's children directly
        editor.children = updatedChildren;

        // Also update the state
        setEditorValue([...updatedChildren]);

        console.log("Paragraph indices force updated");
        return true;
      }
    } catch (error) {
      console.error("Error force updating paragraph indices:", error);
    }
    return false;
  }, [editor]);

  // Effect to handle editor readiness and DOM hydration
  useEffect(() => {
    // Check if DOM is ready and Slate elements exist
    const checkEditorReadiness = () => {
      if (typeof window === 'undefined' || !document) {
        return false;
      }

      // Wait for DOM to be fully loaded
      if (document.readyState === 'loading') {
        return false;
      }

      // Check if React has hydrated (for SSR)
      const hasReactRoot = document.querySelector('[data-reactroot]') ||
                          document.querySelector('#__next') ||
                          document.querySelector('[data-slate-editor]');

      return !!hasReactRoot;
    };

    const initializeEditor = () => {
      if (checkEditorReadiness()) {
        setIsEditorReady(true);
      } else {
        // Retry after a short delay
        setTimeout(initializeEditor, 100);
      }
    };

    // Start the initialization process
    initializeEditor();

    // Also listen for DOM ready events
    const handleDOMReady = () => {
      setTimeout(() => setIsEditorReady(true), 50);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', handleDOMReady);
    } else {
      handleDOMReady();
    }

    return () => {
      document.removeEventListener('DOMContentLoaded', handleDOMReady);
    };
  }, []);

  // Initialize editor with content
  useEffect(() => {
    // Only initialize when editor is ready and we haven't initialized yet
    if (!isEditorReady || isInitializedRef.current) {
      return;
    }

    if (initialContent) {
      const validContent = ensureValidContent(initialContent);

      // Update the editor value with valid content
      setEditorValue(validContent);

      // Force update paragraph indices after initialization
      setTimeout(() => {
        forceUpdateParagraphIndices();
      }, 50);

      isInitializedRef.current = true;
    }
  }, [initialContent, forceUpdateParagraphIndices, isEditorReady]);

  // CRITICAL FIX: Disable periodic paragraph index updates to prevent link deletion
  // The normalization process now handles paragraph indices safely
  // Periodic updates were causing links to be lost during content editing
  // useEffect(() => {
  //   // Set up an interval to update paragraph indices every 2 seconds
  //   const intervalId = setInterval(() => {
  //     if (editor && editor.children) {
  //       forceUpdateParagraphIndices();
  //     }
  //   }, 2000);

  //   // Clean up the interval when the component unmounts
  //   return () => clearInterval(intervalId);
  // }, [editor, forceUpdateParagraphIndices]);

  // Set mounted state for portal rendering
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Share the linkEditorRef with child components via window
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Update the ref with the latest state setters
      linkEditorRef.current.setShowLinkEditor = setShowLinkEditor;
      linkEditorRef.current.setLinkEditorPosition = setLinkEditorPosition;
      linkEditorRef.current.setInitialLinkValues = setInitialLinkValues;

      // Share the ref globally
      (window as any).currentLinkEditorRef = linkEditorRef.current;
    }

    return () => {
      // Clean up when component unmounts
      if (typeof window !== 'undefined') {
        (window as any).currentLinkEditorRef = null;
      }
    };
  }, [setShowLinkEditor, setLinkEditorPosition, setInitialLinkValues]);

  // Insert a link at the current selection
  const insertLink = useCallback((url, text, options = {}) => {
    if (!url) return false;

    try {
      // Determine if this is a page link, user link, or external link
      const isUserLinkType = url.startsWith('/user/') || (options as any).isUser;
      const isPageLinkType = !isUserLinkType && (url.startsWith('/') || (options as any).pageId);
      const isExternalLinkType = !isUserLinkType && !isPageLinkType;

      // Ensure pageId is properly extracted for page links
      let pageId = (options as any).pageId;
      if (isPageLinkType && !pageId && url.startsWith('/pages/')) {
        const match = url.match(/\/pages\/([a-zA-Z0-9-_]+)/);
        if (match) pageId = match[1];
      }

      // Log the link type for debugging
      console.log('Link type:', { isUserLinkType, isPageLinkType, isExternalLinkType });

      console.log('[DEBUG] insertLink called with:', { url, text, options });

      // Create the initial link object with basic properties
      const initialLink = {
        type: 'link',
        url,
        children: [{ text: text || url }],
        // Add type-specific properties
        ...(isUserLinkType && {
          isUser: true,
          userId: (options as any).userId
        }),
        ...(isPageLinkType && {
          pageId: pageId || (options as any).pageId,
          pageTitle: (options as any).pageTitle,
          originalPageTitle: (options as any).originalPageTitle || (options as any).pageTitle, // Store original page title
          isCustomText: (options as any).isCustomText || false, // Flag to indicate if text is custom
          // Add compound link properties
          showAuthor: (options as any).showAuthor || false,
          authorUsername: (options as any).authorUsername || null
        }),
        ...(isExternalLinkType && {
          isExternal: true
        }),
        ...((options as any).isPublic === false && { isPublic: false })
      };

      console.log('[DEBUG] Initial link object created:', initialLink);

      // CRITICAL FIX: Use the validator to ensure all required properties are present
      // This standardizes link creation and ensures backward compatibility
      const link = validateLink(initialLink);

      // CRITICAL FIX: Ensure the link has proper inline structure for Slate
      // Remove any properties that might cause Slate to treat this as a block element
      if (link.className) {
        delete link.className; // Remove className as it can interfere with inline rendering
      }

      // Ensure the link is marked as inline
      link.inline = true;

      // Log the validated link structure
      console.log('LINK_DEBUG: Created validated link:', JSON.stringify(link));

      // Log the editor selection state before insertion
      console.log('Editor selection before insertion:',
        editor.selection ? {
          anchor: editor.selection.anchor,
          focus: editor.selection.focus,
          isCollapsed: Range.isCollapsed(editor.selection)
        } : 'No selection');

      // Add a unique identifier to help track this link
      link.linkId = `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('LINK_DEBUG: Added unique linkId:', link.linkId);

      if (editor.selection) {
        const [parentNode, parentPath] = Editor.parent(
          editor,
          editor.selection.focus.path
        );

        if (editor.selection.anchor.offset === editor.selection.focus.offset) {
          // No text is selected, insert the link inline
          console.log('LINK_DEBUG: Inserting link inline at cursor position');

          try {
            // CRITICAL FIX: Insert link inline using insertText and then wrap it
            // This ensures the link appears exactly at the cursor position
            const currentSelection = { ...editor.selection };
            console.log('LINK_DEBUG: Current selection before insertion:', currentSelection);

            // First, insert the link text at the cursor position
            const linkText = text || 'Link';
            Transforms.insertText(editor, linkText, { at: currentSelection });

            // Now select the text we just inserted
            const startPoint = currentSelection.focus;
            const endPoint = {
              path: startPoint.path,
              offset: startPoint.offset + linkText.length
            };

            // Select the inserted text
            Transforms.select(editor, {
              anchor: startPoint,
              focus: endPoint
            });

            // Wrap the selected text in a link
            Transforms.wrapNodes(editor, link, { split: true });

            // Position cursor after the link
            const afterLinkPoint = Editor.after(editor, endPoint);
            if (afterLinkPoint) {
              Transforms.select(editor, afterLinkPoint);
              console.log('LINK_DEBUG: Positioned cursor after inserted link');
            } else {
              // Fallback: collapse to end
              Transforms.collapse(editor, { edge: 'end' });
              console.log('LINK_DEBUG: Used fallback cursor positioning');
            }
          } catch (error) {
            console.error('LINK_DEBUG: Error during cursor positioning:', error);
            // Last resort fallback
            try {
              Transforms.collapse(editor, { edge: 'end' });
              // CRITICAL FIX: Don't insert a space after the link to prevent unwanted line wrapping
            } catch (fallbackError) {
              console.error('LINK_DEBUG: Even fallback failed:', fallbackError);
            }
          }
        } else {
          // Text is selected, wrap it in a link
          console.log('LINK_DEBUG: Wrapping selected text in link');

          try {
            // Store the current selection before wrapping
            const currentSelection = { ...editor.selection };

            // Update the link's children to match the selected text
            const selectedText = Editor.string(editor, currentSelection);
            link.children = [{ text: selectedText }];
            link.displayText = selectedText;

            // Wrap the selected text in a link
            Transforms.wrapNodes(editor, link, { split: true });

            // Position cursor after the wrapped link
            const afterLinkPoint = Editor.after(editor, currentSelection.focus);
            if (afterLinkPoint) {
              Transforms.select(editor, afterLinkPoint);
              console.log('LINK_DEBUG: Positioned cursor after wrapped link');
            } else {
              // Fallback: collapse to end
              Transforms.collapse(editor, { edge: 'end' });
              console.log('LINK_DEBUG: Used fallback cursor positioning after wrap');
            }
          } catch (error) {
            console.error('LINK_DEBUG: Error during text wrapping:', error);
            // Last resort fallback
            try {
              Transforms.collapse(editor, { edge: 'end' });
            } catch (fallbackError) {
              console.error('LINK_DEBUG: Even fallback failed:', fallbackError);
            }
          }
        }
      } else {
        // No selection, just insert the link at the current position
        console.log('LINK_DEBUG: No editor selection, inserting link at default position');

        try {
          // Insert the link node
          Transforms.insertNodes(editor, link);

          // Get the path to the inserted link
          const linkEntry = Editor.above(editor, {
            match: n => (n as any).type === 'link'
          });

          if (linkEntry) {
            const [linkNode, linkPath] = linkEntry;
            console.log('LINK_DEBUG: Found inserted link at path:', linkPath);

            // CRITICAL FIX: Don't insert a space after the link to prevent unwanted line wrapping
            // Instead, just position the cursor after the link
            const endPoint = Editor.end(editor, linkPath);
            console.log('LINK_DEBUG: End point after link:', endPoint);

            // Select the point after the link
            Transforms.select(editor, endPoint);
            console.log('LINK_DEBUG: Selected end point after link');

            // Don't insert a space - this was causing the unwanted line wrapping
          } else {
            console.log('LINK_DEBUG: Could not find inserted link, using fallback');
            // Fallback: just move to the end without inserting a space
            Transforms.collapse(editor, { edge: 'end' });
          }
        } catch (error) {
          console.error('LINK_DEBUG: Error during cursor positioning:', error);
          // Last resort fallback
          try {
            Transforms.collapse(editor, { edge: 'end' });
            // CRITICAL FIX: Don't insert a space after the link to prevent unwanted line wrapping
          } catch (fallbackError) {
            console.error('LINK_DEBUG: Even fallback failed:', fallbackError);
          }
        }
      }
      return true;
    } catch (error) {
      console.error('Error inserting link:', error);
      return false;
    }
  }, [editor]);

  // Create a ref for the link editor state
  const linkEditorRef = useRef({
    showLinkEditor: false,
    setShowLinkEditor: setShowLinkEditor,
    linkEditorPosition: linkEditorPosition,
    setLinkEditorPosition: setLinkEditorPosition,
    initialLinkValues: initialLinkValues,
    setInitialLinkValues: setInitialLinkValues,
    selectedLinkElement: null,
    selectedLinkPath: null
  });

  // Function to open the link editor
  const openLinkEditor = useCallback((initialTab = "page") => {
    // Check if link functionality is enabled
    if (!linkFunctionalityEnabled) {
      console.log('[DEBUG] Link functionality is disabled, showing DisabledLinkModal');
      setShowDisabledLinkModal(true);
      return false;
    }

    // Track link editor opening
    try {
      const { trackInteractionEvent, events } = useWeWriteAnalytics();
      trackInteractionEvent(events.LINK_EDITOR_OPENED, {
        initial_tab: initialTab,
        source: 'editor'
      });
    } catch (error) {
      console.error('Analytics tracking failed (non-fatal):', error);
    }

    try {
      console.log('[DEBUG] openLinkEditor called with initialTab:', initialTab);

      // Focus the editor first
      safeReactEditor.focus(editor);

      // Get the current selection
      const { selection } = editor;

      if (!selection) {
        // If no selection, position at the end
        const end = Editor.end(editor, []);
        Transforms.select(editor, end);
      }

      // Position the link editor near the cursor
      const domSelection = window.getSelection();
      if (domSelection && domSelection.rangeCount > 0) {
        const range = domSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Update the link editor position
        linkEditorRef.current.linkEditorPosition = {
          top: rect.bottom + window.pageYOffset,
          left: rect.left + window.pageXOffset,
        };
      } else {
        // Fallback position
        linkEditorRef.current.linkEditorPosition = {
          top: window.innerHeight / 2,
          left: window.innerWidth / 2,
        };
      }

      // Set initial values for a new link
      linkEditorRef.current.selectedLinkElement = null;
      linkEditorRef.current.selectedLinkPath = null;
      linkEditorRef.current.initialLinkValues = {
        text: '',
        pageId: null,
        pageTitle: '',
        initialTab: initialTab // Set the initial tab
      };

      // Get the selected text to use as the initial display text
      if (selection && !Range.isCollapsed(selection)) {
        try {
          const fragment = Editor.fragment(editor, selection);
          const text = fragment.map(n => Node.string(n)).join('\n');
          if (text) {
            linkEditorRef.current.initialLinkValues = {
              ...linkEditorRef.current.initialLinkValues,
              text: text
            };
          }
        } catch (error) {
          console.error('[DEBUG] Error getting selected text:', error);
        }
      }

      // Create a local state setter function if it doesn't exist
      if (!linkEditorRef.current.setShowLinkEditor) {
        linkEditorRef.current.setShowLinkEditor = (value) => {
          linkEditorRef.current.showLinkEditor = typeof value === 'function' ? value(linkEditorRef.current.showLinkEditor) : value;
          // Force a re-render by dispatching a custom event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('linkEditorStateChange', { detail: { showLinkEditor: value } }));
          }
        };
      }

      // Show the link editor
      linkEditorRef.current.showLinkEditor = true;
      if (linkEditorRef.current.setShowLinkEditor) {
        linkEditorRef.current.setShowLinkEditor(true);
      }

      // Force a re-render to show the link editor
      // This is a critical fix to ensure the link editor appears
      try {
        // Create a custom event to trigger the link editor
        const event = new CustomEvent('show-link-editor', {
          detail: {
            position: linkEditorRef.current.linkEditorPosition,
            initialValues: linkEditorRef.current.initialLinkValues,
            initialTab: initialTab, // Include the initialTab parameter directly
            showLinkEditor: true // Explicitly set showLinkEditor to true
          }
        });
        document.dispatchEvent(event);

        console.log('[DEBUG] Dispatched show-link-editor event with initialTab:', initialTab);
      } catch (error) {
        console.error('[DEBUG] Error dispatching show-link-editor event:', error);
      }

      return true;
    } catch (error) {
      console.error('Error opening link editor:', error);
      return false;
    }
  }, [editor, linkFunctionalityEnabled]);

  // Expose methods to parent components via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      try {
        safeReactEditor.focus(editor);
        return true;
      } catch (error) {
        console.error('Error focusing editor:', error);
        return false;
      }
    },
    getContent: () => editorValue,
    insertText: (text) => {
      try {
        editor.insertText(text);
        return true;
      } catch (error) {
        console.error('Error inserting text:', error);
        return false;
      }
    },
    insertLink, // Expose the insertLink method
    openLinkEditor, // Expose the openLinkEditor method
    // CRITICAL FIX: Expose the setShowLinkEditor method
    setShowLinkEditor: (value) => {
      console.log('[DEBUG] External call to setShowLinkEditor:', value);
      setShowLinkEditor(value);
      return true;
    },
    deleteAllEmptyLines, // Expose the deleteAllEmptyLines method
    // Add any other methods you want to expose
  }));

  // We no longer need to synchronize line numbers with editor content
  // since we're using inline paragraph numbers

  // Function to update paragraph indices
  const handleParagraphIndices = useCallback((value) => {
    // Use the utility function from slate-path-fix.js
    return updateParagraphIndices(value);
  }, []);

  // Handle editor changes
  const handleEditorChange = useCallback((value) => {
    try {
      // Store the current selection to prevent cursor jumps
      if (editor.selection) {
        lastSelectionRef.current = editor.selection;
      }

      // CRITICAL FIX: Only update paragraph indices when necessary to prevent link deletion
      // The normalization process now handles this more safely
      let updatedValue = value;

      // Only update paragraph indices if the structure has actually changed
      // (number of paragraphs changed, not just content within paragraphs)
      const currentParagraphCount = editorValue.filter(node =>
        node.type === 'paragraph' || !node.type
      ).length;
      const newParagraphCount = value.filter(node =>
        node.type === 'paragraph' || !node.type
      ).length;

      if (currentParagraphCount !== newParagraphCount) {
        // Only update indices when paragraph structure changes
        try {
          updatedValue = handleParagraphIndices(value);
        } catch (indicesError) {
          console.warn("Error updating paragraph indices, using original value:", indicesError);
          updatedValue = value;
        }
      }

      // Update the editor value
      setEditorValue(updatedValue);

      // Call the onChange callback if provided
      if (onChange) {
        try {
          onChange(updatedValue);
        } catch (onChangeError) {
          console.error("Error in onChange callback:", onChangeError);
        }
      }

      // Update empty lines alert after content changes
      setTimeout(() => {
        updateEmptyLinesAlert();
      }, 0);
    } catch (error) {
      console.error("Error in handleEditorChange:", error);

      // Enhanced error recovery
      try {
        // Fall back to just updating the state without indices
        setEditorValue(value);
        if (onChange) {
          onChange(value);
        }
      } catch (fallbackError) {
        console.error("Error in fallback handleEditorChange:", fallbackError);
        // Last resort: try to maintain editor state
        try {
          // If we can't update the value, at least try to preserve the selection
          if (editor.selection && lastSelectionRef.current) {
            setTimeout(() => {
              try {
                if (lastSelectionRef.current) {
                  Transforms.select(editor, lastSelectionRef.current);
                }
              } catch (selectionError) {
                console.error("Error restoring selection:", selectionError);
              }
            }, 0);
          }
        } catch (lastResortError) {
          console.error("Error in last resort recovery:", lastResortError);
        }
      }
    }
  }, [editor, onChange, handleParagraphIndices, editorValue, updateEmptyLinesAlert]);

  // Render a paragraph element or link
  const renderElement = useCallback(({ attributes, children, element }) => {
    switch (element.type) {
      case 'link':
        return <LinkComponent attributes={attributes} children={children} element={element} editor={editor} />;
      case 'paragraph':
        // Get the paragraph index
        let index = 0;

        // Use our utility function to get the paragraph index
        index = getParagraphIndex(element, editor);

        // Check if this empty line should be highlighted (using smart highlighting rules)
        const shouldHighlight = shouldHighlightEmptyLine(element, index, editor.children);

        return (
          <div
            {...attributes}
            className={`paragraph-with-number relative ${shouldHighlight ? 'empty-line-highlight' : ''}`}
            style={shouldHighlight ? { backgroundColor: 'rgba(255, 0, 0, 0.15)' } : {}}
          >
            {/* Paragraph number inline at beginning - non-selectable and non-interactive */}
            <span
              contentEditable={false}
              className="paragraph-number-inline select-none"
              style={{
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                pointerEvents: 'none'
              }}
            >
              {index + 1}
            </span>
            <p className="inline">{children}</p>

            {/* Info icon for empty lines */}
            {isEmptyLine(element) && (
              <button
                contentEditable={false}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-red-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-300"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowEmptyLineModal(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowEmptyLineModal(true);
                  }
                }}
                tabIndex={0}
                aria-label="Information about empty lines"
                title="Click for guidance on empty lines"
                style={{
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none'
                }}
              >
                <Info className="h-4 w-4 text-red-500" />
              </button>
            )}
          </div>
        );
      default:
        return <p {...attributes}>{children}</p>;
    }
  }, [editor, isEmptyLine, shouldHighlightEmptyLine]);

  // Render a leaf (text with formatting)
  const renderLeaf = useCallback(({ attributes, children, leaf }) => {
    let leafProps = { ...attributes };

    if (leaf.bold) {
      children = <strong>{children}</strong>;
    }

    if (leaf.italic) {
      children = <em>{children}</em>;
    }

    if (leaf.underline) {
      children = <u>{children}</u>;
    }

    return <span {...leafProps}>{children}</span>;
  }, []);

  // Handle key down events
  const handleKeyDown = useCallback((event) => {
    // Store the current selection before any key event
    if (editor.selection) {
      lastSelectionRef.current = editor.selection;
    }

    // Force update paragraph indices after key operations that might change structure
    if (event.key === 'Enter' || event.key === 'Backspace' || event.key === 'Delete') {
      // Use setTimeout to ensure the operation completes first
      setTimeout(() => {
        forceUpdateParagraphIndices();
      }, 0);
    }

    // Handle arrow key navigation around links
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && editor.selection) {
      const { selection } = editor;

      // Only handle collapsed selections (cursor)
      if (Range.isCollapsed(selection)) {
        const point = selection.anchor;

        // Handle ArrowRight key - check if we're right before a link
        if (event.key === 'ArrowRight') {
          try {
            // Get the next node in the document
            const [nextNode, nextPath] = Editor.next(editor, { at: point.path }) || [];

            // If the next node is a link and we're right before it
            if (nextNode && nextNode.type === 'link') {
              const nodeStart = Editor.start(editor, nextPath);

              // Check if we're right before the link
              if (Point.equals(point, nodeStart) || Point.isBefore(point, nodeStart)) {
                event.preventDefault();

                // Select the entire link instead of jumping over it
                const nodeEnd = Editor.end(editor, nextPath);
                Transforms.select(editor, {
                  anchor: nodeStart,
                  focus: nodeEnd
                });

                // Skip DOM manipulation that causes errors

                return;
              }
            }
          } catch (error) {
            console.error('Error handling ArrowRight navigation around link:', error);
          }
        }

        // Handle ArrowLeft key - check if we're right after a link
        if (event.key === 'ArrowLeft') {
          try {
            // Get the previous node in the document
            const [prevNode, prevPath] = Editor.previous(editor, { at: point.path }) || [];

            // If the previous node is a link and we're right after it
            if (prevNode && prevNode.type === 'link') {
              const nodeEnd = Editor.end(editor, prevPath);

              // Check if we're right after the link
              if (Point.equals(point, nodeEnd) || Point.isAfter(point, nodeEnd)) {
                event.preventDefault();

                // Select the entire link instead of jumping over it
                const nodeStart = Editor.start(editor, prevPath);
                Transforms.select(editor, {
                  anchor: nodeStart,
                  focus: nodeEnd
                });

                // Skip DOM manipulation that causes errors

                return;
              }
            }
          } catch (error) {
            console.error('Error handling ArrowLeft navigation around link:', error);
          }
        }
      }
    }

    // Handle @ symbol to trigger link insertion
    if (event.key === '@' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      // Check if the previous character is a backslash (escape sequence)
      let isEscaped = false;

      try {
        if (editor.selection) {
          const { anchor } = editor.selection;
          const prevPointPath = [...anchor.path];
          const prevPoint = { path: prevPointPath, offset: Math.max(0, anchor.offset - 1) };

          // Get the previous character
          const range = { anchor: prevPoint, focus: anchor };
          const fragment = Editor.fragment(editor, range);
          const text = Node.string(fragment[0]);

          // If the previous character is a backslash, it's an escape sequence
          if (text === '\\') {
            isEscaped = true;

            // Delete the backslash
            Transforms.delete(editor, { at: range });

            // Insert the @ symbol as a regular character
            Transforms.insertText(editor, '@');

            // Don't show the link editor
            return;
          }
        }
      } catch (error) {
        console.error('Error checking for escape sequence:', error);
      }

      // If not escaped, prevent default and show link editor
      if (!isEscaped) {
        // Prevent default to stop the @ from being inserted
        event.preventDefault();
        console.log("@ key pressed, showing link editor with Pages tab");

        // Use the openLinkEditor method to ensure consistent behavior with the Insert Link button
        // This ensures the same modal and behavior is used for both @ symbol and Insert Link button
        openLinkEditor("page");

        // Get any selected text to use as the initial display text
        if (editor.selection && !Range.isCollapsed(editor.selection)) {
          try {
            const fragment = Editor.fragment(editor, editor.selection);
            const text = fragment.map(n => Node.string(n)).join('\n');
            if (text) {
              // Update the initial values with the selected text
              setInitialLinkValues(prev => ({
                ...prev,
                text: text
              }));
            }
          } catch (error) {
            console.error('Error getting selected text for @ shortcut:', error);
          }
        }
      }
    }

    // Pass the event to the parent component's onKeyDown handler if provided
    if (props.onKeyDown) {
      props.onKeyDown(event);
    }

    // Handle single-keystroke deletion of links
    if ((event.key === 'Delete' || event.key === 'Backspace') && editor.selection) {
      const { selection } = editor;

      // Case 1: Check if a link is fully selected (new behavior)
      if (!Range.isCollapsed(selection)) {
        // Check if the selection contains or exactly matches a link
        const selectedLinkEntry = Editor.getSelectedLink(editor);
        if (selectedLinkEntry) {
          const [linkNode, linkPath] = selectedLinkEntry;

          // Check if the entire link is selected
          if (Editor.isLinkFullySelected(editor, linkPath)) {
            event.preventDefault();
            console.log('Deleting fully selected link:', linkNode);
            Transforms.removeNodes(editor, { at: linkPath });
            return;
          }
        }
        // If not a fully selected link, let default behavior handle text selections
        return;
      }

      // Case 1.5: Check if cursor is inside a link and prevent text editing
      const [linkMatch] = Editor.nodes(editor, {
        at: selection,
        match: n => n.type === 'link'
      });

      if (linkMatch) {
        const [linkNode, linkPath] = linkMatch;
        const linkStart = Editor.start(editor, linkPath);
        const linkEnd = Editor.end(editor, linkPath);

        // If we're at the start or end of the link and trying to delete inward
        if ((event.key === 'Delete' && Point.equals(selection.anchor, linkStart)) ||
            (event.key === 'Backspace' && Point.equals(selection.anchor, linkEnd))) {
          // Delete the entire link
          event.preventDefault();
          Transforms.removeNodes(editor, { at: linkPath });
          return;
        }

        // If we're inside the link, delete the entire link instead of partial text
        if (!Point.equals(selection.anchor, linkStart) && !Point.equals(selection.anchor, linkEnd)) {
          event.preventDefault();
          console.log('Deleting link from inside:', linkNode);
          Transforms.removeNodes(editor, { at: linkPath });
          return;
        }
      }

      // Case 2: Check if cursor is positioned right before a link (for Delete key)
      if (event.key === 'Delete') {
        try {
          const point = selection.anchor;

          // Get the next character/node after the cursor
          const after = Editor.after(editor, point);
          if (after) {
            // Check if there's a link node at the next position
            const [node] = Editor.node(editor, after.path);

            // If we're at the start of a link node, delete the entire link
            if (node && node.type === 'link') {
              const linkPath = after.path.slice(0, -1); // Get the link's path
              const linkStart = Editor.start(editor, linkPath);

              // Only delete if we're exactly at the start of the link
              if (Point.equals(point, linkStart)) {
                event.preventDefault();
                Transforms.removeNodes(editor, { at: linkPath });
                return;
              }
            }
          }
        } catch (error) {
          console.error('Error checking for link after cursor:', error);
        }
      }

      // Case 3: Check if cursor is positioned right after a link (for Backspace key)
      if (event.key === 'Backspace') {
        try {
          const point = selection.anchor;

          // Get the previous character/node before the cursor
          const before = Editor.before(editor, point);
          if (before) {
            // Check if there's a link node at the previous position
            const [node] = Editor.node(editor, before.path);

            // If we're at the end of a link node, delete the entire link
            if (node && node.type === 'link') {
              const linkPath = before.path.slice(0, -1); // Get the link's path
              const linkEnd = Editor.end(editor, linkPath);

              // Only delete if we're exactly at the end of the link
              if (Point.equals(point, linkEnd)) {
                event.preventDefault();
                Transforms.removeNodes(editor, { at: linkPath });
                return;
              }
            }
          }
        } catch (error) {
          console.error('Error checking for link before cursor:', error);
        }
      }
    }

    // Handle Enter key to edit links
    if (event.key === 'Enter' && !event.shiftKey && editor.selection) {
      // Case 1: Check if a link is fully selected (new behavior)
      const selectedLinkEntry = Editor.getSelectedLink(editor);
      if (selectedLinkEntry) {
        const [linkNode, linkPath] = selectedLinkEntry;

        // Check if the entire link is selected or if we're inside a link
        const isFullySelected = Editor.isLinkFullySelected(editor, linkPath);
        const isAtLink = Editor.isSelectionAtLink(editor, linkPath);

        if (isFullySelected || isAtLink) {
          event.preventDefault(); // Prevent default Enter behavior
          console.log('Opening link editor for selected/focused link:', linkNode);

          try {
            // Open the link editor for this link
            openLinkEditor(linkNode);
            return;
          } catch (error) {
            console.error('Error opening link editor:', error);
            // If there's an error, let the default behavior happen
          }
        }
      }

      // Case 2: Fallback - check if we're at a link or inside a link (existing behavior)
      let linkEntry = null;
      try {
        // Try to find a link node at or above the current selection
        linkEntry = Editor.above(editor, {
          at: editor.selection,
          match: n => n.type === 'link',
        });
      } catch (error) {
        console.error('Error finding link node:', error);
      }

      // If we found a link and haven't handled it yet, open the link editor
      if (linkEntry && !selectedLinkEntry) {
        event.preventDefault(); // Prevent default Enter behavior
        const [linkNode] = linkEntry;

        try {
          // Open the link editor for this link
          openLinkEditor(linkNode);
          return;
        } catch (error) {
          console.error('Error opening link editor:', error);
          // If there's an error, let the default behavior happen
        }
      }
    }
  }, [editor, openLinkEditor, props.onKeyDown, forceUpdateParagraphIndices]);

  // We no longer need to calculate line numbers for the editor content
  // since we're using inline paragraph numbers

  return (
    <div className="unified-editor relative rounded-lg bg-background w-full max-w-none">
      {/* Editor-specific styles */}
      <style jsx global>{`
        /* Pill link spacing in editor */
        .unified-editor .slate-pill-link + .slate-pill-link {
          margin-left: 0.25rem;
        }

        /* Icon alignment in pill links */
        .unified-editor .slate-pill-link svg {
          flex-shrink: 0;
        }

        /* Paragraph number styling - consistent with view mode */
        .unified-editor .paragraph-number-inline {
          display: inline-block;
          min-width: 0.75rem;
          text-align: right;
          vertical-align: baseline;
          opacity: 0.8;
          position: relative;
          top: 0;
          color: var(--muted-foreground);
          font-size: 0.75rem;
          user-select: none;
          pointer-events: none;
          margin-right: 0.25rem;
          float: none;
          line-height: 1.5;
        }

        /* Standardized paragraph spacing for edit mode */
        .unified-editor .paragraph-with-number {
          margin-bottom: 1.1rem; /* Match view mode spacing */
        }

        /* Ensure paragraph text has consistent line height */
        .unified-editor p {
          line-height: 1.5; /* Match view mode line height */
        }

        /* Align placeholder text with paragraph number */
        .unified-editor [data-slate-placeholder] {
          position: absolute;
          pointer-events: none;
          display: inline-block;
          width: auto;
          white-space: nowrap;
          left: calc(0.75rem + 0.25rem + 0.5rem); /* paragraph min-width + margin-right + reduced padding */
          opacity: 0.6;
          font-size: 1rem; /* Match text size */
          line-height: 1.5; /* Match line height */
          top: 0.5rem; /* Adjust vertical position to match reduced padding */
          color: var(--muted-foreground); /* Match text color */
          font-family: inherit; /* Ensure font matches */
        }

        /* Ensure editor uses full width */
        .unified-editor {
          width: 100% !important;
          max-width: none !important;
        }

        /* Ensure editable area uses full width */
        .unified-editor [data-slate-editor] {
          width: 100% !important;
          max-width: none !important;
        }
      `}</style>

      {/* Global Link Editor removed to avoid duplicate LinkEditor components */}

      {/* Editor help tooltip removed */}

      <Slate
        editor={editor}
        initialValue={editorValue}
        onChange={handleEditorChange}
      >
        <Editable
          ref={editableRef}
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          placeholder={placeholder}
          spellCheck={true}
          autoFocus={false}
          onKeyDown={handleKeyDown}
          className="min-h-[400px] p-2 outline-none w-full max-w-none page-editor-stable"
          // Critical fix: Preserve selection on blur to prevent cursor jumps
          onBlur={() => {
            try {
              if (editor.selection) {
                lastSelectionRef.current = editor.selection;
              }
            } catch (error) {
              console.error('Error in onBlur:', error);
            }
          }}
          // Critical fix: Restore selection on focus to prevent cursor jumps
          onFocus={() => {
            try {
              if (lastSelectionRef.current && !editor.selection) {
                Transforms.select(editor, lastSelectionRef.current);
              }
            } catch (error) {
              console.error('Error restoring selection on focus:', error);
            }
          }}
          // We no longer need to synchronize line numbers after DOM mutations
        />
      </Slate>

      {/* Render the LinkEditor when showLinkEditor is true using createPortal */}
      {showLinkEditor && isMounted && createPortal(
        <LinkEditor
          position={linkEditorPosition}
          onSelect={(item) => {
            console.log('[DEBUG] onSelect called with item:', item);

            // Check if we're editing an existing link
            if (linkEditorRef.current.selectedLinkElement && linkEditorRef.current.selectedLinkPath) {
              console.log('[DEBUG] Editing existing link');
              // Edit existing link
              try {
                const displayText = item.displayText || item.title || item.pageTitle;

                // Create the updated link with compound link support
                let linkText = displayText;
                if (item.showAuthor && item.authorUsername) {
                  console.log('[DEBUG] Creating compound link with author:', item.authorUsername);
                  // For compound links, preserve custom text if available, otherwise use page title
                  linkText = item.displayText || item.pageTitle || item.title;
                }

                const updatedLink = validateLink({
                  type: "link",
                  url: item.isExternal ? item.url : `/pages/${item.pageId}`,
                  children: [{ text: linkText }],
                  ...(item.isExternal && { isExternal: true }),
                  ...(item.pageId && {
                    pageId: item.pageId,
                    pageTitle: item.pageTitle, // Always preserve the actual page title
                    showAuthor: item.showAuthor || false,
                    authorUsername: item.authorUsername || null
                  })
                });

                console.log('[DEBUG] Updated link object:', updatedLink);

                // Apply the validated link properties
                Transforms.setNodes(
                  editor,
                  updatedLink,
                  { at: linkEditorRef.current.selectedLinkPath }
                );

                console.log('Updated existing link:', updatedLink);
              } catch (error) {
                console.error("Error updating existing link:", error);
              }
            } else {
              console.log('[DEBUG] Creating new link');
              // Insert new link
              const url = item.isExternal ? item.url : `/pages/${item.pageId}`;
              console.log('[DEBUG] Inserting new link with URL:', url, 'and pageId:', item.pageId);

              // Create display text for compound links
              let linkText = item.displayText || item.title;
              if (item.showAuthor && item.authorUsername) {
                console.log('[DEBUG] Creating new compound link with author:', item.authorUsername);
                // For compound links, preserve custom text if available, otherwise use page title
                linkText = item.displayText || item.pageTitle || item.title;
              }

              const linkOptions = {
                pageId: item.pageId,
                pageTitle: item.pageTitle,
                isExternal: item.isExternal,
                isUser: item.isUser,
                userId: item.userId,
                isPublic: item.isPublic !== false,
                // Add compound link properties
                showAuthor: item.showAuthor,
                authorUsername: item.authorUsername
              };

              console.log('[DEBUG] Link options:', linkOptions);

              insertLink(url, linkText, linkOptions);
            }

            // Reset link editor state
            linkEditorRef.current.selectedLinkElement = null;
            linkEditorRef.current.selectedLinkPath = null;

            // Hide the link editor
            setShowLinkEditor(false);
          }}
          setShowLinkEditor={setShowLinkEditor}
          initialText={initialLinkValues.text || ""}
          initialPageId={initialLinkValues.pageId || null}
          initialPageTitle={initialLinkValues.pageTitle || ""}
          initialTab={initialLinkValues.initialTab || "page"}
          initialShowAuthor={initialLinkValues.showAuthor || false}
          initialAuthorUsername={initialLinkValues.authorUsername || null}
          initialExternalUrl={initialLinkValues.externalUrl || ""}
          initialHasCustomText={initialLinkValues.hasCustomText || false}
        />,
        document.body
      )}



      {/* Empty Line Guidance Modal */}
      <Modal
        isOpen={showEmptyLineModal}
        onClose={() => setShowEmptyLineModal(false)}
        title="Content Structure Tip"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            It's recommended to use one line at a time for better readability and structure.
          </p>
          <p className="text-sm text-gray-500">
            Empty lines can make your content harder to read and navigate. Consider removing them or adding meaningful content.
          </p>
          <div className="flex justify-end">
            <Button
              onClick={() => setShowEmptyLineModal(false)}
              variant="primary"
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      {/* Disabled Link Modal */}
      <DisabledLinkModal
        isOpen={showDisabledLinkModal}
        onClose={() => setShowDisabledLinkModal(false)}
      />
    </div>
  );
});

EditorComponent.displayName = 'Editor';

// Link Component that matches the PillLink styling
const LinkComponent = ({ attributes, children, element, editor }) => {
  // Use the linkEditorRef from the parent component
  const linkEditorRef = useRef(null);

  // Access shared state for the link editor
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkEditorPosition, setLinkEditorPosition] = useState({ top: 0, left: 0 });
  const [initialLinkValues, setInitialLinkValues] = useState({});
  const [isSelected, setIsSelected] = useState(false);

  // Get the linkEditorRef from the parent Editor component
  useEffect(() => {
    // This will be set by the parent Editor component
    if (typeof window !== 'undefined' && window.currentLinkEditorRef) {
      linkEditorRef.current = window.currentLinkEditorRef;
    }
  }, []);

  // Track when this link is selected
  useEffect(() => {
    const checkSelection = () => {
      try {
        // Only check if the editor has a selection
        if (!editor.selection) {
          setIsSelected(false);
          return;
        }

        // Skip path finding that causes errors - just use basic selection check
        if (!editor.selection) {
          setIsSelected(false);
          return;
        }

        // Simplified selection check - just check if we're in a link
        try {
          const linkEntry = Editor.above(editor, {
            at: editor.selection,
            match: n => n.type === 'link' && n === element,
          });
          setIsSelected(!!linkEntry);
        } catch (error) {
          setIsSelected(false);
        }
      } catch (error) {
        // Ignore errors, just don't update the selected state
        console.error('Error checking link selection:', error);
        setIsSelected(false);
      }
    };

    // Check selection on mount and when selection changes
    checkSelection();

    // Add a selection change listener
    const onSelectionChange = () => {
      checkSelection();
    };

    // Use a MutationObserver to detect selection changes
    // This is more reliable than the selectionchange event
    if (typeof window !== 'undefined') {
      document.addEventListener('selectionchange', onSelectionChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        document.removeEventListener('selectionchange', onSelectionChange);
      }
    };
  }, [editor, element]);

  // Local state for this component
  const [selectedLinkElement, setSelectedLinkElement] = useState<any>(null);
  const [selectedLinkPath, setSelectedLinkPath] = useState<any>(null);

  // Update the linkEditorRef when local state changes
  useEffect(() => {
    if (linkEditorRef.current) {
      // Only update the selected element and path from this component
      linkEditorRef.current.selectedLinkElement = selectedLinkElement;
      linkEditorRef.current.selectedLinkPath = selectedLinkPath;

      // Get the parent component's state
      if (typeof window !== 'undefined' && window.currentLinkEditorRef) {
        // Copy over the parent's state for these properties
        linkEditorRef.current.showLinkEditor = window.currentLinkEditorRef.showLinkEditor;
        linkEditorRef.current.setShowLinkEditor = window.currentLinkEditorRef.setShowLinkEditor;
        linkEditorRef.current.linkEditorPosition = window.currentLinkEditorRef.linkEditorPosition;
        linkEditorRef.current.initialLinkValues = window.currentLinkEditorRef.initialLinkValues;
      }
    }
  }, [selectedLinkElement, selectedLinkPath]);

  // Listen for custom events to update the link editor state
  useEffect(() => {
    const handleLinkEditorStateChange = (event) => {
      if (event.detail && event.detail.showLinkEditor !== undefined) {
        setShowLinkEditor(event.detail.showLinkEditor);
      }
    };

    const handleShowLinkEditor = (event) => {
      console.log('[DEBUG] Received show-link-editor event', event.detail);

      // Always log the current state before making changes
      console.log('[DEBUG] Current state before changes:', {
        showLinkEditor,
        linkEditorPosition,
        initialLinkValues
      });

      if (event.detail) {
        // Set the link editor position
        if (event.detail.position) {
          setLinkEditorPosition(event.detail.position);
        } else {
          // Default position in the center of the screen if not specified
          setLinkEditorPosition({
            top: window.innerHeight / 2,
            left: window.innerWidth / 2,
          });
        }

        // Create initial values object with any passed values
        const initialValues = {
          ...(event.detail.initialValues || {}),
          initialTab: event.detail.initialTab || "page" // Default to "page" tab if not specified
        };

        // Set the initial values for the link editor
        setInitialLinkValues(initialValues);

        // CRITICAL FIX: Always set showLinkEditor to true regardless of event.detail.showLinkEditor
        setShowLinkEditor(true);

        // Log that we're showing the link editor
        console.log('[DEBUG] FORCE Setting showLinkEditor to true');

        // Force a re-render by updating the DOM directly as a last resort
        setTimeout(() => {
          console.log('[DEBUG] Checking if link editor is visible after timeout');
          console.log('[DEBUG] Current showLinkEditor state:', showLinkEditor);

          // If still not visible, try to force it
          if (!showLinkEditor) {
            console.log('[DEBUG] Link editor still not visible, forcing state update');
            setShowLinkEditor(true);
          }
        }, 100);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('linkEditorStateChange', handleLinkEditorStateChange);
      document.addEventListener('show-link-editor', handleShowLinkEditor);

      return () => {
        window.removeEventListener('linkEditorStateChange', handleLinkEditorStateChange);
        document.removeEventListener('show-link-editor', handleShowLinkEditor);
      };
    }
  }, []);

  // Use PillStyle context to get the current pill style
  const { pillStyle, getPillStyleClasses } = usePillStyle();

  // Use our utility functions to determine link type
  const isUserLinkType = isUserLink(element.url) || element.isUser || element.className === 'user-link';
  const isPageLinkType = isPageLink(element.url) || element.pageId || element.className === 'page-link';
  const isExternalLinkType = isExternalLink(element.url) || element.isExternal || element.className === 'external-link';

  // Determine the appropriate class based on link type
  const linkTypeClass = isUserLinkType ? 'user-link' : isPageLinkType ? 'page-link' : 'external-link';

  // Allow text to display fully, only truncate when necessary
  const textWrapStyle = 'whitespace-nowrap';

  // Apply padding based on pill style
  const classicPadding = pillStyle === 'classic' ? '' : 'px-2 py-0.5';

  // Base styles for all pill links - EXACTLY matching PillLink component
  const baseStyles = `
    inline-flex items-center
    my-0.5
    text-sm font-medium
    rounded-lg
    transition-colors
    ${textWrapStyle}
    ${classicPadding}
    ${getPillStyleClasses()}
    cursor-pointer
    ${linkTypeClass}
    slate-pill-link
    text-indent-0
    float-none
    align-baseline
    leading-tight
    w-fit
    min-w-fit
    max-w-none
    flex-none
  `.trim().replace(/\s+/g, ' ');

  /**
   * Handle click on a link element
   * This opens the link editor modal for editing the link
   *
   * @param {Event} e - The click event
   */
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling

    try {
      // Skip path finding that causes errors - use a simple approach
      const path = [0]; // Default path

      // Store the element and path for the link editor
      setSelectedLinkElement(element);
      setSelectedLinkPath(path);

      // Set initial values for the link editor
      const initialText = element.children && element.children[0] ? element.children[0].text || "" : "";

      // Determine the initial tab based on the link type
      let initialTab = "page"; // Default to page tab
      if (isExternalLinkType) {
        initialTab = "external";
      } else if (isUserLinkType) {
        initialTab = "user";
      }

      // Instead of using local state, directly update the parent component's state
      if (typeof window !== 'undefined' && window.currentLinkEditorRef) {
        // Update the parent's state
        if (window.currentLinkEditorRef.setShowLinkEditor) {
          // Store the element and path in the parent's ref
          window.currentLinkEditorRef.selectedLinkElement = element;
          window.currentLinkEditorRef.selectedLinkPath = path;

          // Update the parent's initialLinkValues
          if (window.currentLinkEditorRef.setInitialLinkValues) {
            window.currentLinkEditorRef.setInitialLinkValues({
              text: initialText,
              pageId: element.pageId || null,
              pageTitle: element.pageTitle || initialText,
              initialTab: initialTab,
              showAuthor: element.showAuthor || false,
              authorUsername: element.authorUsername || null,
              // Add external link specific data
              externalUrl: isExternalLinkType ? element.url : null,
              hasCustomText: element.hasCustomText || false
            });
          }

          // Update the parent's position
          if (window.currentLinkEditorRef.setLinkEditorPosition) {
            // Try to position near the link
            const linkElement = document.querySelector(`[data-page-id="${element.pageId || ''}"][data-link-type="${linkTypeClass}"]`);
            if (linkElement) {
              const rect = linkElement.getBoundingClientRect();
              window.currentLinkEditorRef.setLinkEditorPosition({
                top: rect.bottom + window.pageYOffset + 5,
                left: rect.left + window.pageXOffset,
              });
            } else {
              // Fallback to center position
              window.currentLinkEditorRef.setLinkEditorPosition({
                top: window.innerHeight / 2,
                left: window.innerWidth / 2,
              });
            }
          }

          // Show the link editor in the parent component
          window.currentLinkEditorRef.setShowLinkEditor(true);

          // Dispatch a custom event to ensure the link editor appears
          try {
            const event = new CustomEvent('show-link-editor', {
              detail: {
                position: window.currentLinkEditorRef.linkEditorPosition,
                initialValues: {
                  text: initialText,
                  pageId: element.pageId || null,
                  pageTitle: element.pageTitle || initialText,
                },
                initialTab: initialTab,
                showLinkEditor: true
              }
            });
            document.dispatchEvent(event);
          } catch (eventError) {
            console.error("Error dispatching custom event:", eventError);
          }

          console.log('[DEBUG] Updated parent component state directly');
        }
      }

      // Prevent any other editor actions
      setTimeout(() => {
        // This ensures the editor doesn't try to handle this click
        if (editor.selection) {
          try {
            // Preserve the selection
            const savedSelection = editor.selection;
            // We'll restore it after the link editor is closed
            if (linkEditorRef.current) {
              linkEditorRef.current.savedSelection = savedSelection;
            }
          } catch (selectionError) {
            console.warn("Could not save selection:", selectionError);
          }
        }
      }, 0);
    } catch (error) {
      console.error("Error handling link click:", error);
      // Try a fallback approach
      try {
        // Just show the link editor with basic information
        setShowLinkEditor(true);
        setSelectedLinkElement(element);
        setInitialLinkValues({
          text: element.children?.[0]?.text || "",
          pageId: element.pageId || null,
          pageTitle: element.pageTitle || ""
        });

        // Try to dispatch a custom event as a last resort
        if (typeof document !== 'undefined') {
          const event = new CustomEvent('show-link-editor', {
            detail: {
              showLinkEditor: true,
              initialValues: {
                text: element.children?.[0]?.text || "",
                pageId: element.pageId || null,
                pageTitle: element.pageTitle || ""
              }
            }
          });
          document.dispatchEvent(event);
        }
      } catch (fallbackError) {
        console.error("Error in fallback link handling:", fallbackError);
      }
    }
  };

  // Handle selection from the link editor
  const handleSelection = useCallback((item) => {
    console.log('[DEBUG] handleSelection called with item:', item);

    // Check if this is an external link
    if (item.isExternal) {
      const displayText = item.displayText || item.url;

      if (selectedLinkElement && selectedLinkPath) {
        try {
          // Edit existing link
          // CRITICAL FIX: Use the validator to ensure all required properties are present
          const updatedLink = validateLink({
            type: "link",
            url: item.url,
            children: [{ text: displayText }],
            isExternal: true,
            hasCustomText: item.hasCustomText || false
          });

          console.log('[DEBUG] Updating existing external link with:', updatedLink);

          // Apply the validated link properties
          Transforms.setNodes(
            editor,
            updatedLink,
            { at: selectedLinkPath }
          );

          // Force editor to re-render by triggering a change event
          setTimeout(() => {
            try {
              const event = new Event('input', { bubbles: true });
              const editorElement = document.querySelector('[data-slate-editor=true]');
              if (editorElement) {
                editorElement.dispatchEvent(event);
              }
            } catch (error) {
              console.error('[DEBUG] Error triggering editor refresh:', error);
            }
          }, 100);
        } catch (error) {
          console.error("Error updating existing link:", error);
          // Try fallback approach - insert a new link
          try {
            // Insert a new link at the current selection
            // CRITICAL FIX: Use the validator to ensure all required properties are present
            const link = validateLink({
              type: "link",
              url: item.url,
              children: [{ text: displayText }],
              isExternal: true,
              hasCustomText: item.hasCustomText || false
            });

            // Make sure we have a valid selection
            if (!editor.selection) {
              // If no selection, position at the end
              const end = Editor.end(editor, []);
              Transforms.select(editor, end);
            }

            // Insert the link
            Transforms.insertNodes(editor, link);
          } catch (fallbackError) {
            console.error("Error in fallback link insertion:", fallbackError);
          }
        }
      } else {
        // Insert a new link
        try {
          // CRITICAL FIX: Use the validator to ensure all required properties are present
          const link = validateLink({
            type: "link",
            url: item.url,
            children: [{ text: displayText }],
            isExternal: true,
            hasCustomText: item.hasCustomText || false
          });

          console.log('[DEBUG] Inserting new external link with:', link);

          // Make sure we have a valid selection
          if (!editor.selection) {
            // If no selection, position at the end
            const end = Editor.end(editor, []);
            Transforms.select(editor, end);
          }

          // Insert the link
          Transforms.insertNodes(editor, link);
        } catch (error) {
          console.error("Error inserting new link:", error);
        }
      }
    } else {
      // Handle internal page links
      // Format the title to ensure it never has @ symbols for page links
      const formattedTitle = formatPageTitle(item.displayText || item.title);

      if (selectedLinkElement && selectedLinkPath) {
        try {
          // Edit existing link
          // CRITICAL FIX: Use the validator to ensure all required properties are present
          const updatedLink = validateLink({
            type: "link",
            url: `/pages/${item.id}`,
            children: [{ text: formattedTitle }],
            pageId: item.id,
            pageTitle: item.title // Store the original page title for reference
          });

          // Apply the validated link properties
          Transforms.setNodes(
            editor,
            updatedLink,
            { at: selectedLinkPath }
          );
        } catch (error) {
          console.error("Error updating existing page link:", error);
          // Try fallback approach - insert a new link
          try {
            // Insert a new link at the current selection
            // CRITICAL FIX: Use the validator to ensure all required properties are present
            const link = validateLink({
              type: "link",
              url: `/pages/${item.id}`,
              children: [{ text: formattedTitle }],
              pageId: item.id,
              pageTitle: item.title
            });

            // Make sure we have a valid selection
            if (!editor.selection) {
              // If no selection, position at the end
              const end = Editor.end(editor, []);
              Transforms.select(editor, end);
            }

            // Insert the link
            Transforms.insertNodes(editor, link);
          } catch (fallbackError) {
            console.error("Error in fallback link insertion:", fallbackError);
          }
        }
      } else {
        // Insert a new link
        try {
          // CRITICAL FIX: Use the validator to ensure all required properties are present
          const link = validateLink({
            type: "link",
            url: `/pages/${item.id}`,
            children: [{ text: formattedTitle }],
            pageId: item.id,
            pageTitle: item.title
          });

          // Make sure we have a valid selection
          if (!editor.selection) {
            // If no selection, position at the end
            const end = Editor.end(editor, []);
            Transforms.select(editor, end);
          }

          // Insert the link
          Transforms.insertNodes(editor, link);
        } catch (error) {
          console.error("Error inserting new page link:", error);
        }
      }
    }

    // Reset link editor state
    setSelectedLinkElement(null);
    setSelectedLinkPath(null);
    setInitialLinkValues({});

    // Focus the editor with error handling
    try {
      safeReactEditor.focus(editor);
    } catch (error) {
      console.error("Error focusing editor:", error);
      // Try DOM fallback
      try {
        const editorElement = document.querySelector('[data-slate-editor=true]');
        if (editorElement) {
          editorElement.focus();
        }
      } catch (fallbackError) {
        console.error("Error in fallback focus:", fallbackError);
      }
    }

    // Hide the dropdown
    setShowLinkEditor(false);
  }, [editor, selectedLinkElement, selectedLinkPath, setSelectedLinkElement, setSelectedLinkPath, setInitialLinkValues, setShowLinkEditor]);

  // Check if this is a compound link with author
  const isCompoundLink = element.showAuthor && element.pageTitle && element.authorUsername;

  console.log('[DEBUG] Compound link check:', {
    showAuthor: element.showAuthor,
    pageTitle: element.pageTitle,
    authorUsername: element.authorUsername,
    isCompoundLink,
    element
  });

  if (isCompoundLink) {
    // Render compound link: "[Page Title] by [Author Username]" with separate clickable pills
    return (
      <>
        <span
          {...attributes}
          contentEditable={false}
          className="inline-flex items-center gap-1 compound-link-container group"
          data-pill-style={pillStyle}
          data-page-id={element.pageId || ''}
          data-link-type="compound"
          data-selected={isSelected ? 'true' : 'false'}
          title={`${element.pageTitle} by ${element.authorUsername}`}
        >
          {/* Page title portion - clickable pill */}
          <a
            className={`${baseStyles} ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''} page-portion`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Navigate to the page
              window.location.href = `/pages/${element.pageId}`;
            }}
            href={`/pages/${element.pageId}`}
            title={element.pageTitle}
          >
            {element.isPublic === false && <Lock size={14} className="mr-1 flex-shrink-0" />}
            <span className="pill-text">
              {element.children?.[0]?.text || element.pageTitle}
            </span>
          </a>

          <span className="text-muted-foreground text-sm">by</span>

          {/* Author username portion - clickable pill */}
          <a
            className={`${baseStyles} ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''} author-portion user-link`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Navigate to the user profile
              window.location.href = `/users/${element.authorUsername}`;
            }}
            href={`/users/${element.authorUsername}`}
            title={element.authorUsername}
          >
            <span className="pill-text">
              {element.authorUsername}
            </span>
          </a>

          {/* Edit button for the compound link */}
          <button
            className="ml-1 p-0.5 rounded hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100"
            onClick={handleClick}
            title="Edit link"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </span>

        {/* Hidden children for Slate.js structure */}
        <span style={{ display: 'none' }}>{children}</span>
      </>
    );
  }

  // Regular single link rendering
  return (
    <>
      <a
        {...attributes}
        contentEditable={false} // Make the link non-editable
        className={`${baseStyles} ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
        data-pill-style={pillStyle}
        data-page-id={isPageLinkType ? (element.pageId || '') : undefined}
        data-user-id={isUserLinkType ? (element.userId || '') : undefined}
        data-link-type={linkTypeClass}
        data-selected={isSelected ? 'true' : 'false'}
        title={element.children?.[0]?.text || ''} // Add title attribute for hover tooltip on truncated text
        onClick={handleClick}
      >
        {element.isPublic === false && <Lock size={14} className="mr-1 flex-shrink-0" />}
        <span className="pill-text">
          {children}
        </span>
        {isExternalLinkType && (
          <ExternalLink size={14} className="ml-1 flex-shrink-0" />
        )}
      </a>

      {/* LinkEditor is now handled by the parent component */}

      {/* Debug element to verify state */}
      <div style={{ display: 'none' }}>
        {`Link Editor State: ${showLinkEditor ? 'Visible' : 'Hidden'}`}
      </div>
    </>
  );
};

/**
 * Link Editor Component
 *
 * This component provides a modal interface for creating and editing links.
 * It supports both internal page links and external URLs.
 *
 * @param {Object} props - Component props
 * @param {Object} props.position - Position for the editor (not used in modal mode)
 * @param {Function} props.onSelect - Callback when a link is selected/created
 * @param {Function} props.setShowLinkEditor - Function to hide the editor
 * @param {string} props.initialText - Initial text for the link
 * @param {string|null} props.initialPageId - Initial page ID for internal links
 * @param {string} props.initialPageTitle - Initial page title for internal links
 * @param {string} props.initialTab - Initial tab to show ("page" or "external")
 */
const LinkEditor = ({ position, onSelect, setShowLinkEditor, initialText = "", initialPageId = null, initialPageTitle = "", initialTab = "page", initialShowAuthor = false, initialAuthorUsername = null, initialExternalUrl = "", initialHasCustomText = false }) => {
  // Get accent color for button styling
  const { accentColor, customColors } = useAccentColor();

  // Analytics tracking
  const { trackInteractionEvent, events } = useWeWriteAnalytics();

  // Determine if we're editing an existing link
  const isEditing = !!initialPageId || !!initialText;

  const [displayText, setDisplayText] = useState(initialText);
  const [pageTitle, setPageTitle] = useState(initialPageTitle);
  // Use the initialTab parameter if provided, otherwise determine based on initialPageId
  const [activeTab, setActiveTab] = useState(initialTab || (initialPageId ? "page" : "external"));
  const [selectedPageId, setSelectedPageId] = useState(initialPageId);
  const [externalUrl, setExternalUrl] = useState(initialExternalUrl);
  const [showAuthor, setShowAuthor] = useState(initialShowAuthor);
  const [hasChanged, setHasChanged] = useState(false);
  const [isValid, setIsValid] = useState(true); // Start as valid to avoid initial error state
  const [validationMessage, setValidationMessage] = useState("");
  const [formTouched, setFormTouched] = useState(false); // Track if form has been interacted with - only show validation errors after user interaction



  // Detect if the link has custom text (different from page title or URL)
  const hasCustomText = isEditing && initialText && (
    (initialPageTitle && initialText !== initialPageTitle) ||
    (activeTab === 'external' && initialText !== externalUrl && initialText !== `https://${externalUrl}`) ||
    initialHasCustomText
  );

  // New state for toggles - initialize based on existing link state
  const [showCustomDisplayText, setShowCustomDisplayText] = useState(hasCustomText);
  const [showCustomLinkText, setShowCustomLinkText] = useState(hasCustomText);

  // Handle custom text toggle changes with proper field clearing
  const handleCustomDisplayTextToggle = (enabled) => {
    setShowCustomDisplayText(enabled);
    if (!enabled) {
      // When disabling custom text, clear the display text field
      setDisplayText('');
    } else if (enabled && !displayText.trim()) {
      // When enabling custom text from OFF state, ensure field is empty for clean start
      setDisplayText('');
    }
    setFormTouched(true);

    // Track custom text toggle
    trackInteractionEvent(events.CUSTOM_TEXT_TOGGLED, {
      enabled: enabled,
      link_type: activeTab,
      is_editing: isEditing
    });
  };

  const handleCustomLinkTextToggle = (enabled) => {
    setShowCustomLinkText(enabled);
    if (!enabled) {
      // When disabling custom text, clear the display text field
      setDisplayText('');
    } else if (enabled && !displayText.trim()) {
      // When enabling custom text from OFF state, ensure field is empty for clean start
      setDisplayText('');
    }
    setFormTouched(true);
  };

  // Helper function to get accent color value
  const getAccentColorValue = () => {
    if (accentColor && accentColor.startsWith('custom')) {
      return customColors[accentColor] || '#1768FF';
    }
    // Default accent color values
    const accentColors = {
      blue: '#1768FF',
      red: '#DC2626',
      green: '#16A34A',
      amber: '#D97706',
      purple: '#9333EA',
      sky: '#0EA5E9',
      indigo: '#4F46E5',
      tomato: '#E11D48',
      grass: '#22C55E'
    };
    return accentColors[accentColor] || '#1768FF';
  };



  // Input refs for focus management
  const displayTextRef = useRef(null);
  const pageSearchRef = useRef(null);
  const externalUrlRef = useRef(null);

  // State to track if modal has been mounted (for animation timing)
  const [isModalMounted, setIsModalMounted] = useState(false);



  // Track initial state for change detection
  const initialState = React.useRef({
    displayText: initialText,
    pageTitle: initialPageTitle,
    selectedPageId: initialPageId,
    externalUrl: "",
    showAuthor: false,
    activeTab: initialTab || "page"
  });

  // Enable save if any field changes
  useEffect(() => {
    const changed =
      displayText !== initialState.current.displayText ||
      pageTitle !== initialState.current.pageTitle ||
      selectedPageId !== initialState.current.selectedPageId ||
      externalUrl !== initialState.current.externalUrl ||
      showAuthor !== initialState.current.showAuthor ||
      activeTab !== initialState.current.activeTab;
    setHasChanged(changed);

    // Mark form as touched when any value changes
    if (changed) {
      setFormTouched(true);
    }
  }, [displayText, pageTitle, selectedPageId, externalUrl, showAuthor, activeTab]);

  // Validate the form
  const validateForm = useCallback(() => {
    // Only validate if the form has been touched
    if (!formTouched) {
      // Always return true and don't show validation errors if the form hasn't been touched
      setIsValid(true);
      setValidationMessage("");
      return true;
    }

    if (activeTab === "page") {
      if (!selectedPageId) {
        setIsValid(false);
        setValidationMessage("Please select a page");
        return false;
      }
    } else if (activeTab === "external") {
      if (!externalUrl) {
        setIsValid(false);
        setValidationMessage("Please enter a URL");
        return false;
      }

      // Basic URL validation
      try {
        // Add protocol if missing
        let urlToCheck = externalUrl;
        if (!/^https?:\/\//i.test(urlToCheck)) {
          urlToCheck = 'https://' + urlToCheck;
        }

        new URL(urlToCheck);
        setIsValid(true);
        setValidationMessage("");
      } catch (e) {
        setIsValid(false);
        setValidationMessage("Please enter a valid URL");
        return false;
      }
    }

    // Validate display text - for external links, allow empty display text when custom text is disabled
    // (the URL will be used as display text in that case)
    if (activeTab === "page" && !displayText.trim()) {
      setIsValid(false);
      setValidationMessage("Please enter display text for the link");
      return false;
    } else if (activeTab === "external" && showCustomLinkText && !displayText.trim()) {
      setIsValid(false);
      setValidationMessage("Please enter display text for the link");
      return false;
    }

    setIsValid(true);
    setValidationMessage("");
    return true;
  }, [activeTab, selectedPageId, externalUrl, displayText, formTouched, showCustomLinkText]);

  // Update validation when form changes, but only if the form has been touched
  useEffect(() => {
    if (formTouched) {
      validateForm();
    }
  }, [activeTab, selectedPageId, externalUrl, displayText, validateForm, formTouched, showCustomLinkText]);

  // Auto-focus and text selection logic after modal mounts
  useEffect(() => {
    // Set modal as mounted immediately
    setIsModalMounted(true);

    // Wait for modal animation to complete before focusing
    const focusTimer = setTimeout(() => {
      try {
        if (activeTab === 'page') {
          // Focus the page search input
          if (pageSearchRef.current) {
            const searchInput = pageSearchRef.current.querySelector('input') || pageSearchRef.current;
            if (searchInput && typeof searchInput.focus === 'function') {
              searchInput.focus();

              // Select all text if there's initial content
              if (searchInput.value && typeof searchInput.select === 'function') {
                searchInput.select();
              }

              // Trigger virtual keyboard on mobile
              if (typeof window !== 'undefined' && 'ontouchstart' in window) {
                searchInput.click();
              }

              console.log('[LinkEditor] Auto-focused page search input');
            }
          }
        } else if (activeTab === 'external') {
          // Focus the external URL input
          if (externalUrlRef.current) {
            externalUrlRef.current.focus();

            // Select all text if there's initial content
            if (externalUrlRef.current.value) {
              externalUrlRef.current.select();
            }

            // Trigger virtual keyboard on mobile
            if (typeof window !== 'undefined' && 'ontouchstart' in window) {
              externalUrlRef.current.click();
            }

            console.log('[LinkEditor] Auto-focused external URL input');
          }
        }
      } catch (error) {
        console.error('[LinkEditor] Error during auto-focus:', error);
      }
    }, 300); // Wait 300ms for modal animation to complete

    return () => clearTimeout(focusTimer);
  }, []); // Only run once when component mounts

  // Handle tab changes - refocus when switching tabs
  useEffect(() => {
    if (!isModalMounted) return; // Don't run on initial mount

    const focusTimer = setTimeout(() => {
      try {
        if (activeTab === 'page') {
          if (pageSearchRef.current) {
            const searchInput = pageSearchRef.current.querySelector('input') || pageSearchRef.current;
            if (searchInput && typeof searchInput.focus === 'function') {
              searchInput.focus();
              if (searchInput.value && typeof searchInput.select === 'function') {
                searchInput.select();
              }
            }
          }
        } else if (activeTab === 'external') {
          if (externalUrlRef.current) {
            externalUrlRef.current.focus();
            if (externalUrlRef.current.value) {
              externalUrlRef.current.select();
            }
          }
        }
      } catch (error) {
        console.error('[LinkEditor] Error during tab change focus:', error);
      }
    }, 100); // Shorter delay for tab changes

    return () => clearTimeout(focusTimer);
  }, [activeTab, isModalMounted]);

  // Helper function to validate URL format
  const isValidUrl = (url) => {
    if (!url) return false;
    // Allow URLs with or without protocol
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    return urlPattern.test(url) || url.includes('.') || url.startsWith('http');
  };

  // Validation helpers for UI
  const isPageValid = activeTab === 'page' && !!selectedPageId;
  const isExternalValid = activeTab === 'external' && isValidUrl(externalUrl);

  // For external links, enable button when URL is valid and either:
  // 1. Custom link text is disabled (URL will be used as display text), or
  // 2. Custom link text is enabled and display text is provided
  const canSave = (activeTab === 'page' && isPageValid) ||
                  (activeTab === 'external' && isExternalValid && (!showCustomLinkText || displayText.trim()));

  // Handle close
  const handleClose = () => {
    // Track link editor closing
    trackInteractionEvent(events.LINK_EDITOR_CLOSED, {
      tab_when_closed: activeTab,
      had_changes: hasChanged,
      was_editing: isEditing
    });

    // CRITICAL FIX: Use the parent component's state setter if available
    if (typeof window !== 'undefined' && window.currentLinkEditorRef && window.currentLinkEditorRef.setShowLinkEditor) {
      console.log('[DEBUG] Using parent component setShowLinkEditor in handleClose');
      window.currentLinkEditorRef.setShowLinkEditor(false);

      // Also dispatch the event to ensure the link editor is hidden
      try {
        const event = new CustomEvent('show-link-editor', {
          detail: {
            showLinkEditor: false
          }
        });
        document.dispatchEvent(event);
        console.log('[DEBUG] Dispatched show-link-editor event to hide from LinkEditor handleClose');
      } catch (eventError) {
        console.error('[DEBUG] Error dispatching event from LinkEditor handleClose:', eventError);
      }
    }

    // Also use the local setter as a fallback
    setShowLinkEditor(false);
  };

  // Handle external URL changes
  const handleExternalUrlChange = (e) => {
    setExternalUrl(e.target.value);
    setHasChanged(true);
  };

  // Handle display text changes
  const handleDisplayTextChange = (e) => {
    setDisplayText(e.target.value);
    setHasChanged(true);
  };

  // Handle save for external links
  const handleExternalSubmit = () => {
    // Mark form as touched when submitting
    setFormTouched(true);

    if (!validateForm()) {
      return;
    }

    // Add protocol if missing
    let finalUrl = externalUrl;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    // Determine display text based on custom text toggle
    let finalDisplayText;
    if (showCustomLinkText && displayText.trim()) {
      // Custom text is enabled and provided
      finalDisplayText = displayText.trim();
    } else {
      // Custom text is disabled or empty, use URL as display text
      finalDisplayText = finalUrl;
    }

    onSelect({
      type: "external",
      url: finalUrl,
      displayText: finalDisplayText,
      isExternal: true,
      hasCustomText: showCustomLinkText && displayText.trim() !== ''
    });

    // CRITICAL FIX: Use the parent component's state setter if available
    if (typeof window !== 'undefined' && window.currentLinkEditorRef && window.currentLinkEditorRef.setShowLinkEditor) {
      console.log('[DEBUG] Using parent component setShowLinkEditor in handleExternalSubmit');
      window.currentLinkEditorRef.setShowLinkEditor(false);

      // Also dispatch the event to ensure the link editor is hidden
      try {
        const event = new CustomEvent('show-link-editor', {
          detail: {
            showLinkEditor: false
          }
        });
        document.dispatchEvent(event);
        console.log('[DEBUG] Dispatched show-link-editor event to hide from handleExternalSubmit');
      } catch (eventError) {
        console.error('[DEBUG] Error dispatching event from handleExternalSubmit:', eventError);
      }
    }

    // Also use the local setter as a fallback
    setShowLinkEditor(false);
  };

  // Handle save for page links
  const handleSave = async (item) => {
    // Mark form as touched when submitting
    setFormTouched(true);

    if (!validateForm()) {
      return;
    }

    let authorUsername = null;

    // If showAuthor is enabled, fetch the author information
    if (showAuthor && item.id) {
      console.log('[DEBUG] Show author is enabled, fetching author info for page:', item.id);
      try {
        // Fetch page details to get author information
        const response = await fetch(`/api/pages/${item.id}`);
        console.log('[DEBUG] API response status:', response.status);
        if (response.ok) {
          const pageData = await response.json();
          console.log('[DEBUG] Page data received:', pageData);
          authorUsername = pageData.authorUsername || pageData.author?.username || pageData.username;
          console.log('[DEBUG] Extracted author username:', authorUsername);
        } else {
          console.error('[DEBUG] API response not ok:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('[DEBUG] API error response:', errorText);
        }
      } catch (error) {
        console.error('[DEBUG] Error fetching author information:', error);
        // Continue without author info if fetch fails
      }
    } else {
      console.log('[DEBUG] Show author not enabled or no item.id:', { showAuthor, itemId: item.id });
    }

    const linkData = {
      type: "page",
      pageId: item.id,
      pageTitle: item.title, // Always use the actual page title for compound links
      displayText: displayText || item.title,
      showAuthor,
      authorUsername
    };

    console.log('[DEBUG] Calling onSelect with link data:', linkData);
    onSelect(linkData);

    // CRITICAL FIX: Use the parent component's state setter if available
    if (typeof window !== 'undefined' && window.currentLinkEditorRef && window.currentLinkEditorRef.setShowLinkEditor) {
      console.log('[DEBUG] Using parent component setShowLinkEditor in handleSave');
      window.currentLinkEditorRef.setShowLinkEditor(false);

      // Also dispatch the event to ensure the link editor is hidden
      try {
        const event = new CustomEvent('show-link-editor', {
          detail: {
            showLinkEditor: false
          }
        });
        document.dispatchEvent(event);
        console.log('[DEBUG] Dispatched show-link-editor event to hide from handleSave');
      } catch (eventError) {
        console.error('[DEBUG] Error dispatching event from handleSave:', eventError);
      }
    }

    // Also use the local setter as a fallback
    setShowLinkEditor(false);
  };

  // Position the link editor
  const editorStyle = {
    position: 'absolute',
    zIndex: 1000,
    top: `${position.top}px`,
    left: `${position.left}px`,
    maxWidth: '400px',
    width: '90%',
    backgroundColor: 'var(--background)',
    borderRadius: '0.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    border: '1px solid var(--border)'
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[999] dark:bg-black/50"
        onClick={handleClose}
      />
      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[400px] bg-background rounded-xl shadow-xl z-[1000] border border-border flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - fixed at top */}
        <div className="p-4 flex items-center justify-between border-b border-border">
          <h2 className="text-base font-medium flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            {isEditing ? 'Edit link' : 'Create link'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <span className="sr-only">Close</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 border-b border-border">
          <div className="flex">
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${activeTab === 'page'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('page')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              WeWrite Page
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${activeTab === 'external'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('external')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
              External link
            </button>
          </div>
        </div>

        {/* Scrollable content area - fixed height to prevent layout shift */}
        <div className="flex-1 overflow-y-auto h-[400px]">

          {activeTab === 'page' ? (
            <div className="p-4">
              <div>
                {/* Page search - removed label */}
                <div className="space-y-2">
                  <FilteredSearchResults
                    ref={pageSearchRef}
                    onSelect={(page) => {
                      setSelectedPageId(page.id);
                      setPageTitle(page.title);
                      // Only set display text if it's empty or matches the previous page title
                      if (!displayText.trim() || displayText === pageTitle) {
                        setDisplayText(page.title);
                      }
                      setFormTouched(true);
                    }}
                    placeholder="Search pages..."
                    initialSelectedId={selectedPageId}
                    initialSearch={isEditing && pageTitle ? pageTitle : ""}
                    displayText={displayText}
                    setDisplayText={setDisplayText}
                    preventRedirect={true}
                    autoFocus={activeTab === 'page'}
                    onInputChange={(value: string) => {
                      setFormTouched(true);
                      // If the input looks like a URL, switch to external tab
                      if (value && (value.startsWith('http://') || value.startsWith('https://') ||
                          value.startsWith('www.') || value.includes('.com') ||
                          value.includes('.org') || value.includes('.net') ||
                          value.includes('.io'))) {
                        setActiveTab('external');
                        setExternalUrl(value);
                      }
                    }}
                    onFocus={() => setFormTouched(true)}
                    className={formTouched && !selectedPageId ? 'border-red-500' : ''}
                  />
                </div>

                {/* Custom link text toggle */}
                <div className="mt-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Switch
                      checked={showCustomDisplayText}
                      onCheckedChange={handleCustomDisplayTextToggle}
                      id="custom-link-text-toggle"
                    />
                    <label htmlFor="custom-link-text-toggle" className="text-sm font-medium select-none">Custom link text</label>
                  </div>

                  {showCustomDisplayText && (
                    <input
                      ref={displayTextRef}
                      type="text"
                      value={displayText}
                      onChange={handleDisplayTextChange}
                      placeholder="Enter custom link text"
                      className="w-full p-2 bg-muted/50 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground text-sm"
                      onFocus={(e) => {
                        setFormTouched(true);
                        // Select all text when focused
                        if (e.target.value) {
                          e.target.select();
                        }
                      }}
                    />
                  )}
                </div>

                {/* Show Author Switch - only show after page is selected */}
                {selectedPageId && (
                  <div className="flex items-center gap-3 mt-4 mb-4">
                    <Switch
                      checked={showAuthor}
                      onCheckedChange={(checked) => {
                        setShowAuthor(checked);
                        // Track author toggle change
                        trackInteractionEvent(events.AUTHOR_TOGGLE_CHANGED, {
                          enabled: checked,
                          page_id: selectedPageId,
                          page_title: pageTitle,
                          is_editing: isEditing
                        });
                      }}
                      id="show-author-switch"
                    />
                    <label htmlFor="show-author-switch" className="text-sm font-medium select-none">Show author</label>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <h2 className="text-sm font-medium">URL</h2>
                <input
                  ref={externalUrlRef}
                  type="url"
                  value={externalUrl}
                  onChange={handleExternalUrlChange}
                  placeholder="https://example.com"
                  className={`w-full p-2 bg-muted/50 rounded-lg border ${formTouched && !isValid && !externalUrl ? 'border-red-500' : 'border-border'} focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground text-sm`}
                  onFocus={(e) => {
                    setFormTouched(true);
                    // Select all text when focused
                    if (e.target.value) {
                      e.target.select();
                    }
                  }}
                />
                {!externalUrl.startsWith('http://') && !externalUrl.startsWith('https://') && externalUrl && (
                  <p className="text-xs text-muted-foreground">
                    https:// will be added automatically
                  </p>
                )}
              </div>

              {/* Custom link text toggle */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Switch
                    checked={showCustomLinkText}
                    onCheckedChange={handleCustomLinkTextToggle}
                    id="custom-link-text-toggle-external"
                  />
                  <label htmlFor="custom-link-text-toggle-external" className="text-sm font-medium select-none">Custom link text</label>
                </div>

                {showCustomLinkText && (
                  <input
                    type="text"
                    value={displayText}
                    onChange={handleDisplayTextChange}
                    placeholder="Enter custom link text"
                    className="w-full p-2 bg-muted/50 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground text-sm"
                    onFocus={(e) => {
                      setFormTouched(true);
                      // Select all text when focused
                      if (e.target.value) {
                        e.target.select();
                      }
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer with buttons */}
        <div className="p-4 border-t border-border flex gap-2">
          <button
            onClick={handleClose}
            className="flex-1 py-2 px-4 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>

          {activeTab === 'page' ? (
            <button
              onClick={() => handleSave({ id: selectedPageId, title: pageTitle })}
              disabled={!canSave}
              className="flex-1 py-2 px-4 bg-primary text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
              style={{ backgroundColor: !canSave ? undefined : getAccentColorValue() }}
            >
              {isEditing ? 'Save changes' : 'Insert link'}
            </button>
          ) : (
            <button
              onClick={handleExternalSubmit}
              disabled={!canSave}
              className="flex-1 py-2 px-4 bg-primary text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
              style={{ backgroundColor: !canSave ? undefined : getAccentColorValue() }}
            >
              {isEditing ? 'Save changes' : 'Insert link'}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default EditorComponent;
