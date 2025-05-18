"use client";

import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useCallback, useMemo } from "react";
import {
  createEditor,
  Transforms,
  Editor,
  Element as SlateElement,
  Range,
  Node,
  Path,
  Point,
} from "slate";
import { Editable, withReact, useSlate, Slate } from "slate-react";
import { ReactEditor } from "slate-react";
import { withHistory } from "slate-history";
import { Link as LinkIcon, ExternalLink, Lock } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useLineSettings, LineSettingsProvider } from '../contexts/LineSettingsContext';
import { usePillStyle } from '../contexts/PillStyleContext';
import { formatPageTitle, formatUsername, isUserLink, isPageLink, isExternalLink } from "../utils/linkFormatters";
import TypeaheadSearch from "./TypeaheadSearch";

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
        return ReactEditor.toDOMPoint(editor, point);
      }
    } catch (error) {
      console.error('Error in safeReactEditor.toDOMPoint:', error);
    }
    return null;
  },
  toSlatePoint: (editor, domPoint) => {
    try {
      if (ReactEditor && typeof ReactEditor.toSlatePoint === 'function') {
        return ReactEditor.toSlatePoint(editor, domPoint);
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
Editor.isSelectionAtLink = (editor, linkPath) => {
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

/**
 * UnifiedEditor Component
 *
 * A rich text editor component that provides a consistent editing experience
 * across different content types (wiki pages, group about pages, user bios).
 *
 * @param {Object} props - Component props
 * @param {Array} props.initialContent - Initial content for the editor
 * @param {Function} props.onChange - Callback when content changes
 * @param {string} props.placeholder - Placeholder text when editor is empty
 * @param {string} props.contentType - Type of content being edited (wiki, about, bio)
 * @param {Function} props.onKeyDown - Callback for keyboard events
 */
const UnifiedEditor = forwardRef((props, ref) => {
  const {
    initialContent = [createDefaultParagraph()],
    onChange,
    placeholder = "Start typing...",
    contentType = "wiki",
    onKeyDown
  } = props;
  // Create editor instance
  const [editor] = useState(() => withHistory(withReact(createEditor())));
  const [editorValue, setEditorValue] = useState(ensureValidContent(initialContent));
  const [selection, setSelection] = useState(null);
  const editableRef = useRef(null);
  const lastSelectionRef = useRef(null);

  // CRITICAL FIX: Add missing state variables for link editor
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkEditorPosition, setLinkEditorPosition] = useState({ top: 0, left: 0 });
  const [initialLinkValues, setInitialLinkValues] = useState({});

  // Track if we've already set up the editor
  const isInitializedRef = useRef(false);

  // Initialize editor with content
  useEffect(() => {
    if (!isInitializedRef.current && initialContent) {
      const validContent = ensureValidContent(initialContent);
      setEditorValue(validContent);
      isInitializedRef.current = true;
    }
  }, [initialContent]);

  // We no longer need to synchronize line numbers since we're using inline paragraph numbers
  useEffect(() => {
    // No-op - keeping the effect as a placeholder in case we need to add initialization logic in the future
  }, []);

  // Share the linkEditorRef with child components via window
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Update the ref with the latest state setters
      linkEditorRef.current.setShowLinkEditor = setShowLinkEditor;
      linkEditorRef.current.setLinkEditorPosition = setLinkEditorPosition;
      linkEditorRef.current.setInitialLinkValues = setInitialLinkValues;

      // Share the ref globally
      window.currentLinkEditorRef = linkEditorRef.current;
    }

    return () => {
      // Clean up when component unmounts
      if (typeof window !== 'undefined') {
        window.currentLinkEditorRef = null;
      }
    };
  }, [setShowLinkEditor, setLinkEditorPosition, setInitialLinkValues]);

  // Insert a link at the current selection
  const insertLink = useCallback((url, text, options = {}) => {
    if (!url) return false;

    try {
      // Determine if this is a page link, user link, or external link
      const isUserLinkType = url.startsWith('/user/') || options.isUser;
      const isPageLinkType = !isUserLinkType && (url.startsWith('/') || options.pageId);
      const isExternalLinkType = !isUserLinkType && !isPageLinkType;

      // Ensure pageId is properly extracted for page links
      let pageId = options.pageId;
      if (isPageLinkType && !pageId && url.startsWith('/pages/')) {
        const match = url.match(/\/pages\/([a-zA-Z0-9-_]+)/);
        if (match) pageId = match[1];
      }

      // Create the link node with appropriate properties
      const link = {
        type: 'link',
        url,
        children: [{ text: text || url }],
        // Add additional properties based on link type
        ...(isUserLinkType && { isUser: true, userId: options.userId }),
        ...(isPageLinkType && {
          pageId: pageId || options.pageId,
          pageTitle: options.pageTitle
        }),
        ...(isExternalLinkType && { isExternal: true }),
        ...(options.isPublic === false && { isPublic: false })
      };

      // Log the link structure for debugging
      console.log('Inserting link with structure:', JSON.stringify(link));

      if (editor.selection) {
        const [parentNode, parentPath] = Editor.parent(
          editor,
          editor.selection.focus.path
        );

        if (editor.selection.anchor.offset === editor.selection.focus.offset) {
          // No text is selected, insert the link
          Transforms.insertNodes(editor, link);
        } else {
          // Text is selected, wrap it in a link
          Transforms.wrapNodes(editor, link, { split: true });
          Transforms.collapse(editor, { edge: 'end' });
        }
      } else {
        // No selection, just insert the link at the current position
        Transforms.insertNodes(editor, link);
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
            linkEditorRef.current.initialLinkValues.text = text;
          }
        } catch (error) {
          console.error('[DEBUG] Error getting selected text:', error);
        }
      }

      // Create a local state setter function if it doesn't exist
      if (!linkEditorRef.current.setShowLinkEditor) {
        linkEditorRef.current.setShowLinkEditor = (value) => {
          linkEditorRef.current.showLinkEditor = value;
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
  }, [editor]);

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
    // Add any other methods you want to expose
  }));

  // We no longer need to synchronize line numbers with editor content
  // since we're using inline paragraph numbers

  // Handle editor changes
  const handleEditorChange = useCallback((value) => {
    // Store the current selection to prevent cursor jumps
    if (editor.selection) {
      lastSelectionRef.current = editor.selection;
    }

    setEditorValue(value);

    // Call the onChange callback if provided
    if (onChange) {
      onChange(value);
    }
  }, [editor, onChange]);

  // Render a paragraph element or link
  const renderElement = useCallback(({ attributes, children, element }) => {
    switch (element.type) {
      case 'link':
        return <LinkComponent attributes={attributes} children={children} element={element} editor={editor} />;
      case 'paragraph':
        // Get the paragraph index
        let index = 0;
        try {
          // Use the path property if it exists (for better performance)
          if (element.path && Array.isArray(element.path)) {
            index = element.path[0];
          } else {
            // Otherwise use our safe wrapper for findPath
            const path = safeReactEditor.findPath(editor, element);
            if (path && Array.isArray(path)) {
              index = path[0]; // The first element of the path is the paragraph index

              // Cache the path for future renders
              element.path = path;
            }
          }
        } catch (error) {
          console.error('Error finding paragraph index:', error);
          // Try to get a reasonable index as fallback
          try {
            // Find all paragraph nodes and determine this one's position
            const nodes = Array.from(
              Editor.nodes(editor, {
                at: [],
                match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'paragraph'
              })
            );

            // Find this element in the nodes
            const nodeIndex = nodes.findIndex(([node]) => node === element);
            if (nodeIndex !== -1) {
              index = nodeIndex;
            }
          } catch (fallbackError) {
            console.error('Error in fallback paragraph indexing:', fallbackError);
          }
        }

        return (
          <div {...attributes} className="paragraph-with-number">
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
          </div>
        );
      default:
        return <p {...attributes}>{children}</p>;
    }
  }, [editor]);

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

                // Set the link as selected for visual indication
                try {
                  const domNode = ReactEditor.toDOMNode(editor, nextNode);
                  if (domNode) {
                    // Clear any previously selected links
                    const linkElements = document.querySelectorAll('[data-selected="true"]');
                    linkElements.forEach(el => el.setAttribute('data-selected', 'false'));

                    // Mark this link as selected
                    domNode.setAttribute('data-selected', 'true');
                  }
                } catch (err) {
                  console.error('Error setting link as selected:', err);
                }

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

                // Set the link as selected for visual indication
                try {
                  const domNode = ReactEditor.toDOMNode(editor, prevNode);
                  if (domNode) {
                    // Clear any previously selected links
                    const linkElements = document.querySelectorAll('[data-selected="true"]');
                    linkElements.forEach(el => el.setAttribute('data-selected', 'false'));

                    // Mark this link as selected
                    domNode.setAttribute('data-selected', 'true');
                  }
                } catch (err) {
                  console.error('Error setting link as selected:', err);
                }

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

      // Case 1: Check if we're at a link or inside a link
      let linkEntry = null;
      try {
        // Try to find a link node at or above the current selection
        linkEntry = Editor.above(editor, {
          at: selection,
          match: n => n.type === 'link',
        });
      } catch (error) {
        console.error('Error finding link node:', error);
      }

      // If we found a link, delete the entire link with a single keystroke
      if (linkEntry) {
        event.preventDefault(); // Prevent default deletion behavior
        const [linkNode, linkPath] = linkEntry;

        try {
          // Remove the entire link node
          Transforms.removeNodes(editor, { at: linkPath });

          // Insert a space to replace the link
          Transforms.insertText(editor, ' ');

          // Return early since we've handled the event
          return;
        } catch (error) {
          console.error('Error removing link node:', error);
          // If there's an error, let the default behavior happen
        }
      }

      // Case 2: Check if cursor is positioned right before a link (for Delete key)
      if (event.key === 'Delete' && Range.isCollapsed(selection)) {
        try {
          const point = selection.anchor;
          const [nextNode, nextPath] = Editor.next(editor, { at: point.path, match: n => n.type === 'link' }) || [];

          // If the next node is a link and we're right before it
          if (nextNode && nextNode.type === 'link') {
            const nodeStart = Editor.start(editor, nextPath);

            // Check if we're right before the link
            if (Point.equals(point, nodeStart) || Point.isBefore(point, nodeStart)) {
              event.preventDefault();
              Transforms.removeNodes(editor, { at: nextPath });
              return;
            }
          }
        } catch (error) {
          console.error('Error checking for link after cursor:', error);
        }
      }

      // Case 3: Check if cursor is positioned right after a link (for Backspace key)
      if (event.key === 'Backspace' && Range.isCollapsed(selection)) {
        try {
          const point = selection.anchor;
          const [prevNode, prevPath] = Editor.previous(editor, { at: point.path, match: n => n.type === 'link' }) || [];

          // If the previous node is a link and we're right after it
          if (prevNode && prevNode.type === 'link') {
            const nodeEnd = Editor.end(editor, prevPath);

            // Check if we're right after the link
            if (Point.equals(point, nodeEnd) || Point.isAfter(point, nodeEnd)) {
              event.preventDefault();
              Transforms.removeNodes(editor, { at: prevPath });
              return;
            }
          }
        } catch (error) {
          console.error('Error checking for link before cursor:', error);
        }
      }
    }

    // Handle Enter key to edit links
    if (event.key === 'Enter' && !event.shiftKey && editor.selection) {
      // Check if we're at a link or inside a link
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

      // If we found a link, open the link editor
      if (linkEntry) {
        event.preventDefault(); // Prevent default Enter behavior
        const [linkNode, linkPath] = linkEntry;

        try {
          // Open the link editor for this link
          openLinkEditor(linkNode);

          // Return early since we've handled the event
          return;
        } catch (error) {
          console.error('Error opening link editor:', error);
          // If there's an error, let the default behavior happen
        }
      }
    }
  }, [editor, openLinkEditor, props.onKeyDown]);

  // We no longer need to calculate line numbers for the editor content
  // since we're using inline paragraph numbers

  return (
    <div className="unified-editor relative rounded-lg bg-background">
      {/* Add custom CSS for pill links and paragraph numbers in the editor */}
      <style jsx global>{`
        /* Ensure pill links in the editor match the site's appearance */
        .unified-editor .slate-pill-link {
          display: inline-flex;
          align-items: center;
          margin: 0.125rem 0;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 0.5rem;
          transition: all 0.2s ease;
          max-width: 100%;
          cursor: pointer;
        }

        /* Ensure proper spacing around links */
        .unified-editor .slate-pill-link + .slate-pill-link {
          margin-left: 0.25rem;
        }

        /* Ensure proper text truncation */
        .unified-editor .slate-pill-link .pill-text {
          overflow: hidden;
        }

        /* Ensure proper icon alignment */
        .unified-editor .slate-pill-link svg {
          flex-shrink: 0;
        }

        /* Inline paragraph number styling for editor */
        .unified-editor .paragraph-number-inline {
          display: inline-block;
          min-width: 0.75rem;
          text-align: right;
          vertical-align: baseline;
          opacity: 0.8;
          position: relative;
          top: -0.05em;
          color: var(--muted-foreground);
          font-size: 0.75rem;
          user-select: none;
          pointer-events: none;
          margin-right: 0.25rem;
          float: none;
        }
      `}</style>

      {/* Global Link Editor removed to avoid duplicate LinkEditor components */}

      {/* Editor help tooltip */}
      <div className="absolute top-2 right-2 z-10">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Editor help"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <path d="M12 17h.01"/>
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">
                <strong>Tip:</strong> Type <code>@</code> to insert a link to a page or user.
                Use <code>\@</code> to type a literal @ symbol.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

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
          className="min-h-[200px] p-3 outline-none"
          // Critical fix: Preserve selection on blur to prevent cursor jumps
          onBlur={() => {
            if (editor.selection) {
              lastSelectionRef.current = editor.selection;
            }
          }}
          // Critical fix: Restore selection on focus to prevent cursor jumps
          onFocus={() => {
            if (lastSelectionRef.current && !editor.selection) {
              try {
                Transforms.select(editor, lastSelectionRef.current);
              } catch (error) {
                console.error('Error restoring selection on focus:', error);
              }
            }
          }}
          // We no longer need to synchronize line numbers after DOM mutations
        />

        {/* Render the LinkEditor when showLinkEditor is true */}
        {showLinkEditor && (
          <div className="fixed inset-0 z-[1000]">
            <LinkEditor
              position={linkEditorPosition}
              onSelect={(item) => {
                // Insert the link
                const url = item.isExternal ? item.url : `/pages/${item.pageId}`;
                console.log('Inserting link with URL:', url, 'and pageId:', item.pageId);

                insertLink(
                  url,
                  item.displayText || item.title,
                  {
                    pageId: item.pageId,
                    pageTitle: item.pageTitle,
                    isExternal: item.isExternal,
                    isUser: item.isUser,
                    userId: item.userId,
                    isPublic: item.isPublic !== false
                  }
                );
                // Hide the link editor
                setShowLinkEditor(false);
              }}
              setShowLinkEditor={setShowLinkEditor}
              initialText={initialLinkValues.text || ""}
              initialPageId={initialLinkValues.pageId || null}
              initialPageTitle={initialLinkValues.pageTitle || ""}
              initialTab={initialLinkValues.initialTab || "page"}
            />
          </div>
        )}
      </Slate>
    </div>
  );
});

UnifiedEditor.displayName = 'UnifiedEditor';

// Wrap with forwardRef to fix the "Function components cannot be given refs" error
const InlineChromiumBugfix = forwardRef((_, ref) => (
  <span
    ref={ref}
    contentEditable={false}
    style={{
      display: "inline-block",
      width: 0,
      height: 0,
      lineHeight: 0,
    }}
  >
    {String.fromCodePoint(160) /* Non-breaking space */}
  </span>
));

// Add display name for debugging
InlineChromiumBugfix.displayName = 'InlineChromiumBugfix';

// Link Component that matches the PillLink styling
const LinkComponent = ({ attributes, children, element, editor }) => {
  // Use the linkEditorRef from the parent component
  const linkEditorRef = useRef(null);

  // Access shared state for the link editor
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkEditorPosition, setLinkEditorPosition] = useState({ top: 0, left: 0 });
  const [initialLinkValues, setInitialLinkValues] = useState({});
  const [isSelected, setIsSelected] = useState(false);

  // Get the linkEditorRef from the parent UnifiedEditor component
  useEffect(() => {
    // This will be set by the parent UnifiedEditor component
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

        // Get the path to this link element using our safe wrapper
        const path = safeReactEditor.findPath(editor, element);
        if (!path) {
          setIsSelected(false);
          return;
        }

        // Check if the current selection is at or contains this link
        const isAtLink = Editor.isSelectionAtLink(editor, path);

        // Update the selected state
        setIsSelected(isAtLink);
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
  const [selectedLinkElement, setSelectedLinkElement] = useState(null);
  const [selectedLinkPath, setSelectedLinkPath] = useState(null);

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

  // Add whitespace-nowrap and truncate for filled and outline modes, but allow wrapping for classic mode
  const textWrapStyle = pillStyle === 'classic' ? 'break-words' : 'whitespace-nowrap truncate';

  // Apply padding based on pill style
  const classicPadding = pillStyle === 'classic' ? '' : 'px-2 py-0.5';

  // Base styles for all pill links - EXACTLY matching PillLink component
  const baseStyles = `
    inline-flex items-center
    my-0.5
    text-sm font-medium
    rounded-lg
    transition-colors
    max-w-full
    ${textWrapStyle}
    ${classicPadding}
    ${getPillStyleClasses()}
    cursor-pointer
    ${linkTypeClass}
    slate-pill-link
    text-indent-0
    float-none
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
      // Find the path to this element using the safe wrapper
      const path = safeReactEditor.findPath(editor, element);

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
              initialTab: initialTab
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
    // Check if this is an external link
    if (item.isExternal) {
      const displayText = item.displayText || item.url;

      if (selectedLinkElement && selectedLinkPath) {
        try {
          // Edit existing link
          Transforms.setNodes(
            editor,
            {
              type: "link",
              url: item.url,
              children: [{ text: displayText }],
              isExternal: true
            },
            { at: selectedLinkPath }
          );
        } catch (error) {
          console.error("Error updating existing link:", error);
          // Try fallback approach - insert a new link
          try {
            // Insert a new link at the current selection
            const link = {
              type: "link",
              url: item.url,
              children: [{ text: displayText }],
              isExternal: true
            };

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
          const link = {
            type: "link",
            url: item.url,
            children: [{ text: displayText }],
            isExternal: true
          };

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
          Transforms.setNodes(
            editor,
            {
              type: "link",
              url: `/pages/${item.id}`,
              children: [{ text: formattedTitle }],
              pageId: item.id,
              pageTitle: item.title // Store the original page title for reference
            },
            { at: selectedLinkPath }
          );
        } catch (error) {
          console.error("Error updating existing page link:", error);
          // Try fallback approach - insert a new link
          try {
            // Insert a new link at the current selection
            const link = {
              type: "link",
              url: `/pages/${item.id}`,
              children: [{ text: formattedTitle }],
              pageId: item.id,
              pageTitle: item.title
            };

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
          const link = {
            type: "link",
            url: `/pages/${item.id}`,
            children: [{ text: formattedTitle }],
            pageId: item.id,
            pageTitle: item.title
          };

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
        <InlineChromiumBugfix />
        {element.isPublic === false && <Lock size={14} className="mr-1 flex-shrink-0" />}
        <span className={`pill-text overflow-hidden ${pillStyle === 'classic' ? 'break-words' : 'truncate'}`}>
          {children}
        </span>
        {isExternalLinkType && (
          <ExternalLink size={14} className="ml-1 flex-shrink-0" />
        )}
        <InlineChromiumBugfix />
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
const LinkEditor = ({ position, onSelect, setShowLinkEditor, initialText = "", initialPageId = null, initialPageTitle = "", initialTab = "page" }) => {
  const [displayText, setDisplayText] = useState(initialText);
  const [pageTitle, setPageTitle] = useState(initialPageTitle);
  // Use the initialTab parameter if provided, otherwise determine based on initialPageId
  const [activeTab, setActiveTab] = useState(initialTab || (initialPageId ? "page" : "external"));
  const [selectedPageId, setSelectedPageId] = useState(initialPageId);
  const [externalUrl, setExternalUrl] = useState("");
  const [showAuthor, setShowAuthor] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);
  const [isValid, setIsValid] = useState(true); // Start as valid to avoid initial error state
  const [validationMessage, setValidationMessage] = useState("");
  const [formTouched, setFormTouched] = useState(false); // Track if form has been interacted with - only show validation errors after user interaction

  // Determine if we're editing an existing link or creating a new one
  const isEditing = !!initialPageId || !!initialText;

  // Input refs for focus management
  const displayTextRef = useRef(null);
  const pageSearchRef = useRef(null);
  const externalUrlRef = useRef(null);

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

    // Validate display text
    if (!displayText.trim()) {
      setIsValid(false);
      setValidationMessage("Please enter display text for the link");
      return false;
    }

    setIsValid(true);
    setValidationMessage("");
    return true;
  }, [activeTab, selectedPageId, externalUrl, displayText, formTouched]);

  // Update validation when form changes, but only if the form has been touched
  useEffect(() => {
    if (formTouched) {
      validateForm();
    }
  }, [activeTab, selectedPageId, externalUrl, displayText, validateForm, formTouched]);

  // Validation helpers for UI
  const isPageValid = !formTouched || (activeTab === 'page' && !!selectedPageId && !!displayText);
  const isExternalValid = !formTouched || (activeTab === 'external' && !!externalUrl && !!displayText);
  const canSave = hasChanged && (formTouched ? isValid : true) &&
    ((activeTab === 'page' && (formTouched ? isPageValid : true)) ||
     (activeTab === 'external' && (formTouched ? isExternalValid : true)));

  // Handle close
  const handleClose = () => {
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

    onSelect({
      type: "external",
      url: finalUrl,
      displayText: displayText || externalUrl,
      isExternal: true
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
  const handleSave = (item) => {
    // Mark form as touched when submitting
    setFormTouched(true);

    if (!validateForm()) {
      return;
    }

    onSelect({
      type: "page",
      pageId: item.id,
      pageTitle: item.title || displayText,
      displayText: displayText || item.title,
      showAuthor
    });

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

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Display validation message if there's an error and form has been touched */}
          {formTouched && validationMessage && (
            <div className="px-4 pt-2 text-sm text-red-500">
              {validationMessage}
            </div>
          )}

          {activeTab === 'page' ? (
            <div className="p-4">
              <div>
                {/* Display text input */}
                <div className="space-y-2 mb-4">
                  <h2 className="text-sm font-medium">Link text</h2>
                  <input
                    ref={displayTextRef}
                    type="text"
                    value={displayText}
                    onChange={handleDisplayTextChange}
                    placeholder="Link text"
                    className={`w-full p-2 bg-muted/50 rounded-lg border ${formTouched && !displayText.trim() ? 'border-red-500' : 'border-border'} focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground text-sm`}
                    autoFocus={!initialText}
                    onFocus={() => setFormTouched(true)}
                  />
                </div>

                {/* Page search */}
                <div className="space-y-2">
                  <h2 className="text-sm font-medium">Search for a page</h2>
                  <TypeaheadSearch
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
                    displayText={pageTitle}
                    preventRedirect={true}
                    onInputChange={(value) => {
                      setFormTouched(true);
                      if (value && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('www.') || value.includes('.com') || value.includes('.org') || value.includes('.net') || value.includes('.io'))) {
                        setActiveTab('external');
                        setExternalUrl(value);
                      }
                    }}
                    onFocus={() => setFormTouched(true)}
                    className={formTouched && !selectedPageId ? 'border-red-500' : ''}
                  />
                </div>

                {/* Show Author Switch */}
                <div className="flex items-center gap-2 mt-4 mb-4">
                  <input
                    type="checkbox"
                    checked={showAuthor}
                    onChange={(e) => setShowAuthor(e.target.checked)}
                    id="show-author-switch"
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="show-author-switch" className="text-sm font-medium select-none">Show author</label>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <h2 className="text-sm font-medium">Link text</h2>
                <input
                  ref={displayTextRef}
                  type="text"
                  value={displayText}
                  onChange={handleDisplayTextChange}
                  placeholder="Link text"
                  className={`w-full p-2 bg-muted/50 rounded-lg border ${formTouched && !displayText.trim() ? 'border-red-500' : 'border-border'} focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground text-sm`}
                  autoFocus={!initialText}
                  onFocus={() => setFormTouched(true)}
                />
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-medium">URL</h2>
                <input
                  ref={externalUrlRef}
                  type="url"
                  value={externalUrl}
                  onChange={handleExternalUrlChange}
                  placeholder="https://example.com"
                  className={`w-full p-2 bg-muted/50 rounded-lg border ${formTouched && !externalUrl ? 'border-red-500' : 'border-border'} focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground text-sm`}
                  autoFocus={!!initialText && !externalUrl}
                  onFocus={() => setFormTouched(true)}
                />
                <p className="text-xs text-muted-foreground">
                  {!externalUrl.startsWith('http://') && !externalUrl.startsWith('https://') && externalUrl &&
                    'https:// will be added automatically'}
                </p>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={showAuthor}
                  onChange={(e) => setShowAuthor(e.target.checked)}
                  id="show-author-switch-ext"
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="show-author-switch-ext" className="text-sm font-medium select-none">Show author</label>
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
              className="flex-1 py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? 'Save changes' : 'Insert link'}
            </button>
          ) : (
            <button
              onClick={handleExternalSubmit}
              disabled={!canSave}
              className="flex-1 py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? 'Save changes' : 'Insert link'}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default UnifiedEditor;
