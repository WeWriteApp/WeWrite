import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import {
  createEditor,
  Transforms,
  Editor,
  Element as SlateElement,
  Range,
  Node,
} from "slate";
import { Editable, withReact, useSlate, Slate } from "slate-react";
import { withHistory } from "slate-history";
import TypeaheadSearch from "../search/TypeaheadSearch";
import { X, Link as LinkIcon, ExternalLink, FileText, Globe } from "lucide-react";
import { updateParagraphIndices, getParagraphIndex } from "../../utils/slate-path-fix";
import { useLineSettings, LINE_MODES } from "../../contexts/LineSettingsContext";
import { usePillStyle } from "../../contexts/PillStyleContext";
import { formatPageTitle, formatUsername, isUserLink, isPageLink, isExternalLink } from "../../utils/linkFormatters";
import { validateLink } from "../../utils/linkValidator";

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
 * ReplyEditor Component
 *
 * A rich text editor component built with Slate.js that supports:
 * - Text formatting (bold, italic, etc.)
 * - Links with URL validation
 * - Typeahead search for mentions and references
 * - Paragraph modes for different display styles (Normal and Dense)
 * - Initial content loading for new pages and replies
 *
 * Paragraph Mode Options:
 * 1. Normal Mode: Traditional document style with paragraph numbers creating indentation
 *    - Numbers positioned to the left of the text
 *    - Clear indent for each paragraph
 *    - Proper spacing between paragraphs
 *    - Standard text size (1rem/16px)
 *
 * 2. Dense Mode: Collapses all paragraphs for a more comfortable reading experience
 *    - NO line breaks between paragraphs
 *    - Text wraps continuously as if newline characters were temporarily deleted
 *    - Paragraph numbers inserted inline within the continuous text
 *    - Only a small space separates paragraphs
 *    - Standard text size (1rem/16px)
 *
 * The component handles two types of initial content:
 * 1. initialEditorState: Used for loading existing content
 * 2. initialContent: Used primarily for replies, which takes precedence over initialEditorState
 *
 * For the Reply to Page functionality, this component ensures that:
 * - The initialContent from URL parameters is properly parsed and displayed
 * - Links to the original page are properly formatted with 'url' attributes
 * - The editor is auto-focused after content initialization
 * - Content is only initialized once to prevent re-initialization issues
 *
 * @param {Object} initialEditorState - The initial state to load into the editor (for existing content)
 * @param {Object} initialContent - The initial content to load (takes precedence, used for replies)
 * @param {Function} onContentChange - Function to update the parent component's state with editor changes
 * @param {Ref} ref - Reference to access editor methods from parent components
 */
const ReplyEditor = forwardRef(({ initialEditorState = null, initialContent = null, onContentChange }, ref) => {
  const [editor] = useState(() => withInlines(withHistory(withReact(createEditor()))));
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkEditorPosition, setLinkEditorPosition] = useState({});
  const [selectedLinkElement, setSelectedLinkElement] = useState(null);
  const [selectedLinkPath, setSelectedLinkPath] = useState(null);
  const [initialLinkValues, setInitialLinkValues] = useState({}); // New state to store initial link values
  const editableRef = useRef(null);
  const [lineCount, setLineCount] = useState(0);
  // Remove contentInitialized state and related logic
  // Always update initialValue and the editor's value when initialContent changes
  const [initialValue, setInitialValue] = useState(() => {
    try {
      // If initialContent is provided, it takes precedence
      if (initialContent) {
        console.log("Using initialContent for editor initialization");
        return Array.isArray(initialContent) ? initialContent : JSON.parse(initialContent);
      }

      // Otherwise use initialEditorState if available
      if (initialEditorState) {
        console.log("Using initialEditorState for editor initialization");
        if (Array.isArray(initialEditorState)) {
          return initialEditorState;
        } else if (typeof initialEditorState === 'string') {
          return JSON.parse(initialEditorState);
        } else {
          return JSON.parse(JSON.stringify(initialEditorState));
        }
      }

      // Default empty state
      return [{ type: "paragraph", children: [{ text: "" }] }];
    } catch (error) {
      console.error("Error initializing editor state:", error);
      return [{ type: "paragraph", children: [{ text: "" }] }];
    }
  });

  useImperativeHandle(ref, () => ({
    focus: () => {
      try {
        // Check if we're currently editing the title or another input
        const isTitleFocused = document.activeElement &&
          (document.activeElement.tagName.toLowerCase() === 'textarea' ||
           document.activeElement.tagName.toLowerCase() === 'input');

        // Only focus the editor if we're not currently editing the title
        if (!isTitleFocused) {
          // Use our safe wrapper for ReactEditor.focus
          const focused = safeReactEditor.focus(editor);

          // If there's no content, add an empty paragraph
          if (editor.children.length === 0) {
            Transforms.insertNodes(editor, {
              type: 'paragraph',
              children: [{ text: '' }],
            });
          }

          // Find the last text node
          const lastNode = Editor.last(editor, []);
          if (lastNode) {
            const [node, path] = lastNode;

            // Create a new selection at the end of the last text node
            const point = { path, offset: node.text.length };
            try {
              Transforms.select(editor, point);
            } catch (selectError) {
              console.error('Error selecting text:', selectError);
            }
          }

          // If ReactEditor.focus failed, try DOM fallback
          if (!focused) {
            const editorElement = document.querySelector('[data-slate-editor=true]');
            if (editorElement) {
              editorElement.focus();
            }
          }
        }
      } catch (error) {
        console.error('Error focusing editor:', error);
      }
    },

    // Add the openLinkEditor method to the ref
    openLinkEditor: () => {
      try {
        // Check if we're currently editing the title
        const isTitleFocused = document.activeElement &&
          (document.activeElement.tagName.toLowerCase() === 'textarea' ||
           document.activeElement.tagName.toLowerCase() === 'input');

        // Only proceed if we're not editing the title
        if (!isTitleFocused) {
          // Focus the editor first
          safeReactEditor.focus(editor);

          // Get the current selection
          const { selection } = editor;

          // Show the link editor menu
          if (selection) {
            showLinkEditorMenu(editor, selection);
          } else {
            // If no selection, position at the end
            const end = Editor.end(editor, []);
            Transforms.select(editor, end);
            showLinkEditorMenu(editor, editor.selection);
          }
        }
      } catch (error) {
        console.error('Error opening link editor:', error);
      }
    }
  }));

  // Use initialContent as the priority content source if available
  useEffect(() => {
    if (initialContent) {
      try {
        // Check if initialContent has an attribution paragraph (for replies)
        const hasAttribution = initialContent.length > 0 && (
          // Check for explicit isAttribution flag
          initialContent[0].isAttribution ||
          // Fall back to content-based detection
          (initialContent[0].type === "paragraph" &&
           initialContent[0].children &&
           initialContent[0].children.some(child =>
             (child.text && child.text.includes("Replying to")) ||
             (child.type === "link" && child.children && child.children[0].text)
           ))
        );

        // Use initialContent as the priority source
        setInitialValue(initialContent);

        // Also notify the parent component if the callback is provided
        if (typeof onContentChange === 'function') {
          onContentChange(initialContent);
        }

        // IMPORTANT: Only handle cursor positioning for replies, not for regular editing
        // This prevents cursor jumps during normal typing
        if (hasAttribution && initialContent.length >= 2) {
          // Check if we're currently editing the title
          const isTitleFocused = document.activeElement &&
            (document.activeElement.tagName.toLowerCase() === 'textarea' ||
             document.activeElement.tagName.toLowerCase() === 'input');

          // Only focus the editor for replies and only if we're not currently editing the title
          if (!isTitleFocused) {
            // For replies, we need to position the cursor at the second paragraph
            // Use a longer timeout to ensure the editor is fully initialized
            setTimeout(() => {
              try {
                // Only focus if the title is not focused
                if (document.activeElement &&
                    (document.activeElement.tagName.toLowerCase() === 'textarea' ||
                     document.activeElement.tagName.toLowerCase() === 'input')) {
                  return; // Don't steal focus from title
                }

                // Use our safe wrapper for ReactEditor.focus
                safeReactEditor.focus(editor);

                // Create a point at the start of the second paragraph (index 1)
                const point = { path: [1, 0], offset: 0 };
                Transforms.select(editor, point);
              } catch (error) {
                console.error("Error positioning cursor for reply:", error);
              }
            }, 300);
          }
        }
        // Otherwise, don't focus the editor at all - this is crucial for preventing cursor jumps
      } catch (error) {
        console.error("Error setting editor content from initialContent:", error);
      }
    }
  }, [initialContent, onContentChange, editor]);

  // Make sure initialValue is properly set from initialContent
  useEffect(() => {
    if (initialContent && initialValue.length === 1 && initialValue[0].children[0].text === "") {
      console.log("Setting initialValue from initialContent in secondary effect");
      setInitialValue(initialContent);
    }
  }, [initialContent, initialValue]);

  // Debounce function to prevent too many updates
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Create a debounced version of the content change callback
  // Use a longer debounce time to prevent cursor jumps
  const debouncedContentChange = React.useCallback(
    debounce((value) => {
      if (typeof onContentChange === 'function') {
        // Store the current selection before calling onContentChange
        const currentSelection = editor.selection;

        // Call the parent's onContentChange
        onContentChange(value);

        // Restore the selection after a short delay to ensure React has updated
        if (currentSelection) {
          setTimeout(() => {
            try {
              Transforms.select(editor, currentSelection);
            } catch (error) {
              console.error('Error restoring selection:', error);
            }
          }, 0);
        }
      }
    }, 300), // Increased debounce time for better stability
    [onContentChange, editor]
  );

  // onchange handler with error handling and debouncing
  const onChange = (newValue) => {
    try {
      // Make sure newValue is valid before updating state
      if (Array.isArray(newValue) && newValue.length > 0) {
        // Update local state
        setLineCount(newValue.length);

        // Update paragraph indices to ensure correct numbering
        handleParagraphIndices(newValue);

        // Store the current selection
        const currentSelection = editor.selection;

        // Use debounced callback with selection preservation
        debouncedContentChange(newValue);

        // Immediately restore selection to prevent cursor jumps
        if (currentSelection) {
          try {
            Transforms.select(editor, currentSelection);
          } catch (error) {
            console.error('Error immediately restoring selection:', error);
          }
        }
      } else {
        console.error('Invalid editor value:', newValue);
      }
    } catch (error) {
      console.error('Error in onChange handler:', error);
    }
  };

  // Function to update paragraph indices
  const handleParagraphIndices = (value) => {
    // Use the utility function from slate-path-fix.js
    return updateParagraphIndices(value);
  };

  const handleKeyDown = (event, editor) => {
    // Check if we're at or adjacent to a link and handle deletion
    if ((event.key === 'Delete' || event.key === 'Backspace')) {
      // First check if we're at a link
      const [link] = Editor.nodes(editor, {
        match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === "link",
      }) || [];

      if (link) {
        event.preventDefault();
        const [, path] = link;
        Transforms.removeNodes(editor, { at: path });
        return;
      }

      // If not at a link, check if we're adjacent to one
      const { selection } = editor;
      if (selection && Range.isCollapsed(selection)) {
        const [start] = Range.edges(selection);
        const beforePoint = { path: start.path, offset: start.offset - 1 };
        const afterPoint = { path: start.path, offset: start.offset };

        // Check if there's a link before the cursor (for Backspace)
        if (event.key === 'Backspace' && start.offset > 0) {
          try {
            const [nodeEntry] = Editor.nodes(editor, {
              at: Editor.range(editor, beforePoint, beforePoint),
              match: (n) => SlateElement.isElement(n) && n.type === 'link',
            }) || [];

            if (nodeEntry) {
              event.preventDefault();
              const [, linkPath] = nodeEntry;
              Transforms.removeNodes(editor, { at: linkPath });
              return;
            }
          } catch (error) {
            console.error('Error checking for link before cursor:', error);
          }
        }

        // Check if there's a link after the cursor (for Delete)
        if (event.key === 'Delete') {
          try {
            const [nodeEntry] = Editor.nodes(editor, {
              at: Editor.range(editor, afterPoint, afterPoint),
              match: (n) => SlateElement.isElement(n) && n.type === 'link',
            }) || [];

            if (nodeEntry) {
              event.preventDefault();
              const [, linkPath] = nodeEntry;
              Transforms.removeNodes(editor, { at: linkPath });
              return;
            }
          } catch (error) {
            console.error('Error checking for link after cursor:', error);
          }
        }
      }
    }
    // Handle cmd+enter to save
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      // Trigger save by dispatching a custom event that PageEditor can listen for
      const saveEvent = new CustomEvent('editor-save-requested');
      document.dispatchEvent(saveEvent);
      return;
    }

    // Shift+enter should do nothing
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      return;
    }

    // For regular Enter key, use our custom insertBreak implementation
    if (event.key === 'Enter') {
      event.preventDefault();
      try {
        // Call our custom insertBreak implementation
        editor.insertBreak();
      } catch (error) {
        console.error('Error handling Enter key:', error);

        // Fallback: try to insert a new paragraph directly
        try {
          const newParagraph = { type: 'paragraph', children: [{ text: '' }] };
          Transforms.insertNodes(editor, newParagraph);
        } catch (fallbackError) {
          console.error('Fallback error:', fallbackError);
        }
      }
      return;
    }

    // Fix arrow key navigation around links
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const [link] = Editor.nodes(editor, {
        match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === "link",
      });

      if (link) {
        // Get the current selection
        const { selection } = editor;
        if (!selection) return;

        // Find the link element and its parent paragraph
        const [, linkPath] = link;
        const parentPath = Path.parent(linkPath);

        if (event.key === 'ArrowUp') {
          // Find the previous paragraph if exists
          if (parentPath[0] > 0) {
            const prevPath = [...parentPath];
            prevPath[0] = parentPath[0] - 1;
            const newPoint = Editor.end(editor, prevPath);
            Transforms.select(editor, newPoint);
            event.preventDefault();
          }
        } else if (event.key === 'ArrowDown') {
          // Find the next paragraph if exists
          const nextPath = [...parentPath];
          nextPath[0] = parentPath[0] + 1;

          try {
            const nextNode = Node.get(editor, nextPath);
            if (nextNode) {
              const newPoint = Editor.start(editor, nextPath);
              Transforms.select(editor, newPoint);
              event.preventDefault();
            }
          } catch (error) {
            // Next paragraph doesn't exist, do nothing
          }
        }
      }
    }

    if (event.key === "@") {
      event.preventDefault();

      try {
        console.log("@ key pressed, showing link editor menu");

        // Focus the editor first to ensure we have a valid selection
        safeReactEditor.focus(editor);

        // Get the current selection after focusing
        const { selection } = editor;

        // Always show the link editor menu, even if there's no selection
        if (selection) {
          showLinkEditorMenu(editor, selection);
        } else {
          // If no selection, position at the end
          const end = Editor.end(editor, []);
          Transforms.select(editor, end);
          showLinkEditorMenu(editor, editor.selection);
        }
      } catch (error) {
        console.error("Error handling @ key:", error);
        // Fallback method
        try {
          const end = Editor.end(editor, []);
          Transforms.select(editor, end);

          // Position the link editor in the center as a last resort
          setLinkEditorPosition({
            top: window.innerHeight / 2,
            left: window.innerWidth / 2,
          });
          setShowLinkEditor(true);
        } catch (fallbackError) {
          console.error("Error in fallback @ key handling:", fallbackError);
        }
      }
    }

    if (event.key === "Escape") {
      setShowLinkEditor(false);
    }
  };

  const showLinkEditorMenu = (editor, editorSelection) => {
    try {
      // First ensure the editor is focused
      safeReactEditor.focus(editor);

      // Try to use the editor selection if provided
      if (editor && editorSelection) {
        try {
          // Use our safe wrapper for ReactEditor.toDOMRange
          const domSelection = safeReactEditor.toDOMRange(editor, editorSelection);
          if (domSelection) {
            const rect = domSelection.getBoundingClientRect();

            setLinkEditorPosition({
              top: rect.bottom + window.pageYOffset,
              left: rect.left + window.pageXOffset,
            });

            setShowLinkEditor(true);
            setSelectedLinkElement(null);
            setSelectedLinkPath(null);

            // Ensure the editor stays focused
            setTimeout(() => {
              safeReactEditor.focus(editor);
            }, 10);

            return;
          }
        } catch (editorError) {
          console.warn("Error getting DOM range from editor selection:", editorError);
          // Continue to fallback method
        }
      }

      // Fall back to window.getSelection()
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        console.warn("No selection available");

        // Try to find the editor element and position relative to it
        try {
          const editorElement = document.querySelector('[data-slate-editor=true]');
          if (editorElement) {
            const rect = editorElement.getBoundingClientRect();
            setLinkEditorPosition({
              top: rect.top + 100 + window.pageYOffset, // Position 100px below the top of the editor
              left: rect.left + 100 + window.pageXOffset, // Position 100px from the left of the editor
            });
            setShowLinkEditor(true);
            return;
          }
        } catch (elementError) {
          console.error("Error finding editor element:", elementError);
        }

        // Position the link editor in the center as a last resort
        setLinkEditorPosition({
          top: window.innerHeight / 2,
          left: window.innerWidth / 2,
        });
        setShowLinkEditor(true);
        return;
      }

      try {
        const range = selection.getRangeAt(0).cloneRange();
        const rect = range.getBoundingClientRect();

        setLinkEditorPosition({
          top: rect.bottom + window.pageYOffset,
          left: rect.left + window.pageXOffset,
        });
      } catch (rangeError) {
        console.error("Error getting range rect:", rangeError);
        // Position in center as last resort
        setLinkEditorPosition({
          top: window.innerHeight / 2,
          left: window.innerWidth / 2,
        });
      }

      setShowLinkEditor(true);
      setSelectedLinkElement(null);
      setSelectedLinkPath(null);
    } catch (error) {
      console.error("Error showing link editor menu:", error);
      // Position the link editor in the center if all else fails
      setLinkEditorPosition({
        top: window.innerHeight / 2,
        left: window.innerWidth / 2,
      });
      setShowLinkEditor(true);
      setSelectedLinkElement(null);
      setSelectedLinkPath(null);
    }
  };

  const openLinkEditor = (element, path) => {
    // Make sure we have a valid element
    if (!element) {
      console.warn("No element provided to openLinkEditor");
      return;
    }

    setSelectedLinkElement(element);
    setSelectedLinkPath(path); // path can be null, that's okay

    // Determine if this is an internal link (has pageId)
    const isInternalLink = !!element.pageId || isPageLink(element.url);

    // Get the display text from the element
    const displayText = element.children && element.children[0] ? element.children[0].text || "" : "";

    // For internal links, ensure we have the pageId and pageTitle
    let pageId = element.pageId || null;
    let pageTitle = element.pageTitle || "";

    // If it's a page link but doesn't have pageId, try to extract it from the URL
    if (isInternalLink && !pageId && element.url) {
      const matches = element.url.match(/\/pages\/([a-zA-Z0-9-_]+)/);
      if (matches && matches[1]) {
        pageId = matches[1];
      }
    }

    console.log("Opening link editor for:", {
      isInternalLink,
      displayText,
      pageId,
      pageTitle,
      url: element.url
    });

    // Pass initial values to the LinkEditor
    setInitialLinkValues({
      text: displayText,
      pageId: pageId,
      pageTitle: pageTitle
    });

    setShowLinkEditor(true);
  };

  const handleSelection = (item) => {
    // CRITICAL FIX: Improved link insertion with better error handling
    if (!item) {
      console.warn('ReplyEditor: Received null item in handleSelection');
      return;
    }

    try {
      // Check if this is an external link
      if (item.isExternal) {
        const displayText = item.displayText || item.url;

        if (selectedLinkElement && selectedLinkPath) {
          // Edit existing link
          const updatedLink = validateLink({
            type: "link",
            url: item.url,
            children: [{ text: displayText }],
            isExternal: true,
            className: "external-link",
            linkVersion: 3 // Ensure we're using the latest link format
          });

          Transforms.setNodes(
            editor,
            updatedLink,
            { at: selectedLinkPath }
          );
        } else {
          // Insert new external link
          const link = validateLink({
            type: "link",
            url: item.url,
            children: [{ text: displayText }],
            isExternal: true,
            className: "external-link",
            linkVersion: 3 // Ensure we're using the latest link format
          });

          // Ensure we have a valid selection
          if (!editor.selection) {
            const end = Editor.end(editor, []);
            Transforms.select(editor, end);
          }

          // Simple insertion at current selection
          Transforms.insertNodes(editor, link);

          // Move cursor to the end of the link
          Transforms.collapse(editor, { edge: "end" });

          // Add a space after the link for better editing experience
          Transforms.insertText(editor, " ");
        }
      } else {
        // This is a page link
        const formattedTitle = formatPageTitle(item.displayText || item.title || "Untitled");

        if (selectedLinkElement && selectedLinkPath) {
          // Edit existing link
          const updatedLink = validateLink({
            type: "link",
            url: `/pages/${item.id}`,
            children: [{ text: formattedTitle }],
            pageId: item.id,
            pageTitle: item.title,
            isPageLink: true,
            className: "page-link",
            linkVersion: 3 // Ensure we're using the latest link format
          });

          Transforms.setNodes(
            editor,
            updatedLink,
            { at: selectedLinkPath }
          );
        } else {
          // Insert new page link
          const link = validateLink({
            type: "link",
            url: `/pages/${item.id}`,
            children: [{ text: formattedTitle }],
            pageId: item.id,
            pageTitle: item.title,
            isPageLink: true,
            className: "page-link",
            linkVersion: 3 // Ensure we're using the latest link format
          });

          // CRITICAL FIX: Ensure we have a valid selection with better error handling
          try {
            if (!editor.selection) {
              const end = Editor.end(editor, []);
              Transforms.select(editor, end);
            }

            // Simple insertion at current selection
            Transforms.insertNodes(editor, link);

          // Move cursor to the end of the link
          Transforms.collapse(editor, { edge: "end" });

          // Add a space after the link for better editing experience
          Transforms.insertText(editor, " ");
          } catch (insertError) {
            console.error("Error inserting page link:", insertError);

            // Fallback insertion at the end of the document
            try {
              const end = Editor.end(editor, []);
              Transforms.select(editor, end);
              Transforms.insertNodes(editor, link);
              Transforms.insertText(editor, " ");
            } catch (fallbackError) {
              console.error("Fallback insertion failed:", fallbackError);
            }
          }
        }
      }

      // Force editor to update
      if (typeof editor.onChange === 'function') {
        editor.onChange();
      }

      // Reset link editor state
      setSelectedLinkElement(null);
      setSelectedLinkPath(null);
      setInitialLinkValues({});

      // Focus the editor
      try {
        if (ReactEditor && typeof ReactEditor.focus === 'function') {
          ReactEditor.focus(editor);
        }
      } catch (focusError) {
        console.error("Error focusing editor:", focusError);
      }

      // Close the link editor
      setShowLinkEditor(false);
    } catch (error) {
      console.error("Error in link insertion:", error);

      // Fallback for critical errors
      try {
        // Create a simple text node as fallback
        const textNode = {
          text: item.isExternal
            ? (item.displayText || item.url)
            : (item.title || "Untitled")
        };

        // Insert as plain text
        Transforms.insertText(editor, textNode.text);

        // Close the link editor
        setShowLinkEditor(false);
      } catch (fallbackError) {
        console.error("Critical error in fallback:", fallbackError);
        setShowLinkEditor(false);
      }
    }
  };

  const renderElement = (props) => {
    const { attributes, children, element } = props;

    // Check if this is an attribution paragraph (first paragraph in a reply)
    // First check for the explicit isAttribution flag
    const isAttributionParagraph = element.isAttribution ||
      // Then fall back to content-based detection
      (element.type === "paragraph" &&
       element.children &&
       element.children.some(child =>
         (child.text && child.text.includes("Replying to")) ||
         (child.type === "link" && child.children && child.children[0].text)
       ));

    switch (element.type) {
      case "link":
        return <LinkComponent {...props} openLinkEditor={openLinkEditor} />;
      case "paragraph":
        // Use our utility function to get the paragraph index
        const index = getParagraphIndex(element, editor);

        // Attribution paragraphs - no special styling, just regular paragraph
        if (isAttributionParagraph) {
          return (
            <div {...attributes} className="paragraph-with-number py-2" data-paragraph-index={index}>
              <span className="paragraph-number-inline select-none" style={{ pointerEvents: 'none' }}>
                {index + 1}
              </span>
              <p className="inline">{children}</p>
            </div>
          );
        }

        // Regular paragraph styling with reduced vertical padding (py-2 instead of py-2.5)
        return (
          <div {...attributes} className="paragraph-with-number py-2" data-paragraph-index={index}>
            <span className="paragraph-number-inline select-none" style={{ pointerEvents: 'none' }}>
              {index + 1}
            </span>
            <p className="inline">{children}</p>
          </div>
        );
      default:
        // Use our utility function to get the paragraph index
        const defaultIndex = getParagraphIndex(element, editor);

        return (
          <div {...attributes} className="paragraph-with-number py-2" data-paragraph-index={defaultIndex}>
            <span
              className="paragraph-number-inline select-none"
              style={{ pointerEvents: 'none' }}
              tabIndex="-1"
              aria-hidden="true"
            >
              {defaultIndex + 1}
            </span>
            <p className="inline">{children}</p>
          </div>
        );
    }
  };

  // Force editor to use the initialValue
  useEffect(() => {
    try {
      // Only proceed if editor is available
      if (editor && editor.children) {
        // Reset the editor's children to match initialValue
        editor.children = Array.isArray(initialValue) && initialValue.length > 0
          ? initialValue
          : [{ type: "paragraph", children: [{ text: "" }] }];

        // Force a re-render if onChange is available
        if (typeof editor.onChange === 'function') {
          editor.onChange();
        }
        console.log("Forced editor to use initialValue:", JSON.stringify(initialValue, null, 2));
      }
    } catch (error) {
      console.error("Error forcing editor to use initialValue:", error);
    }
  }, [editor, initialValue]);

  // Make sure we have a valid editor and initialValue
  const validEditor = editor || createEditor();
  const validInitialValue = Array.isArray(initialValue) && initialValue.length > 0
    ? initialValue
    : [{ type: "paragraph", children: [{ text: "" }] }];

  return (
    <LineSettingsProvider>
      <div
        className="relative rounded-lg bg-background"
        style={{
          height: '300px',  // Fixed height to prevent layout shifts
          overflow: 'auto', // Add scrolling for content that exceeds the height
          display: 'flex',  // Use flexbox for better content distribution
          flexDirection: 'column'
        }}
      >
        <Slate
          editor={validEditor}
          initialValue={validInitialValue}
          onChange={onChange}
          // Add key to prevent re-creation of the Slate component
          key="slate-editor-instance"
        >
          <div className="flex-grow flex flex-col">
            <div className="relative flex-grow">
              <EditorContent
                ref={editableRef}
                editor={validEditor}
                handleKeyDown={handleKeyDown}
                renderElement={renderElement}
              />
            </div>
          </div>
        </Slate>
      </div>

      {showLinkEditor && (
        <LinkEditor
          position={linkEditorPosition}
          onSelect={handleSelection}
          setShowLinkEditor={setShowLinkEditor}
          initialText={initialLinkValues.text || ""}
          initialPageId={initialLinkValues.pageId || null}
          initialPageTitle={initialLinkValues.pageTitle || ""}
        />
      )}
    </LineSettingsProvider>
  );
});

ReplyEditor.displayName = 'ReplyEditor';

function isUrl(string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

const withInlines = (editor) => {
  const { insertData, insertText, isInline, normalizeNode, insertBreak } = editor

  // Override isInline to handle link elements
  editor.isInline = element => {
    return ['link'].includes(element.type) || isInline(element)
  }

  // Override insertText to handle URL pasting
  editor.insertText = text => {
    try {
      // Store the current selection before inserting text
      const currentSelection = editor.selection;

      if (text && isUrl(text)) {
        wrapLink(editor, text);
      } else {
        insertText(text);
      }

      // If we had a selection, ensure it's properly updated after text insertion
      if (currentSelection) {
        // For normal text insertion, the cursor position is automatically updated
        // We only need to handle special cases like URL wrapping
        if (text && isUrl(text)) {
          // Move cursor to the end of the inserted link
          Transforms.collapse(editor, { edge: 'end' });
        }
      }
    } catch (error) {
      console.error('Error in insertText:', error);
      // Fallback to original behavior
      insertText(text);
    }
  }

  // Override insertData to handle URL pasting
  editor.insertData = data => {
    try {
      const text = data.getData('text/plain')
      if (text && isUrl(text)) {
        wrapLink(editor, text)
      } else {
        insertData(data)
      }
    } catch (error) {
      console.error('Error in insertData:', error);
      // Fallback to original behavior
      insertData(data);
    }
  }

  // Ensure insertBreak works properly
  editor.insertBreak = () => {
    try {
      // Use Transforms.splitNodes to create a new paragraph at the current selection
      if (editor.selection) {
        // First check if we're at the end of a paragraph
        const endPoint = Editor.end(editor, editor.selection.focus.path.slice(0, 1));
        const isAtEnd = editor.selection.focus.offset === endPoint.offset;

        // Split the node to create a new paragraph
        Transforms.splitNodes(editor, {
          always: true,
          match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'paragraph'
        });

        // If we're at the end of a paragraph, ensure the cursor is in the new paragraph
        if (isAtEnd) {
          Transforms.move(editor, { distance: 1, unit: 'line' });
        }
      } else {
        // If no selection, insert at the end
        const end = Editor.end(editor, []);
        Transforms.select(editor, end);
        Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] });
      }
    } catch (error) {
      console.error('Error in custom insertBreak:', error);

      // Try a simpler approach as fallback
      try {
        // Just insert a new paragraph at the current selection
        const newParagraph = { type: 'paragraph', children: [{ text: '' }] };
        Transforms.insertNodes(editor, newParagraph);
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError);

        // Last resort: use the original insertBreak
        try {
          insertBreak();
        } catch (lastResortError) {
          console.error('Error in original insertBreak:', lastResortError);
        }
      }
    }
  };

  // Add custom normalizer to ensure links have valid url properties
  editor.normalizeNode = entry => {
    try {
      const [node, path] = entry;

      // Check if the element is a link
      if (SlateElement.isElement(node) && node.type === 'link') {
        // Ensure link has a url property
        if (!node.url) {
          // If no URL, convert to normal text or provide a default
          if (node.href) {
            // Handle legacy href attribute
            Transforms.setNodes(
              editor,
              { url: node.href },
              { at: path }
            );
          } else {
            // Remove the link formatting if no URL available
            Transforms.unwrapNodes(editor, { at: path });
          }
          return; // Return early as we've handled this node
        }
      }

      // Fall back to the original normalizeNode
      normalizeNode(entry);
    } catch (error) {
      console.error('Error in normalizeNode:', error);
      // Try to continue with original normalizeNode
      try {
        normalizeNode(entry);
      } catch (fallbackError) {
        console.error('Error in fallback normalizeNode:', fallbackError);
      }
    }
  }

  return editor
}

const wrapLink = (editor, url, pageId, pageTitle) => {
  if (isLinkActive(editor)) {
    unwrapLink(editor);
  }

  const { selection } = editor;
  const isCollapsed = selection && Range.isCollapsed(selection);

  // CRITICAL FIX: Save the current selection before any transformations
  const currentSelection = editor.selection;
  console.log('Current selection before link wrapping:', JSON.stringify(currentSelection));

  // Determine the display text
  let text = url;

  // If it's a page link and no display text is provided, use the page title
  if (pageId && pageTitle) {
    text = pageTitle;
  }

  // Format text based on link type
  if (isPageLink(url)) {
    // For page links, ensure they never have @ symbols
    text = formatPageTitle(text);
  } else if (isUserLink(url)) {
    // For user links, ensure they have @ symbols
    text = formatUsername(text);
  }

  // Create the link element with basic properties
  const basicLinkElement = {
    type: "link",
    url,
    pageId,
    pageTitle,
    children: isCollapsed ? [{ text }] : [],
  };

  // CRITICAL FIX: Use validateLink to ensure all required properties are present
  // This ensures backward compatibility with both old and new link formats
  const linkElement = validateLink(basicLinkElement);

  // MAJOR FIX: Completely rewritten link insertion logic to fix positioning issues
  try {
    // Store the current selection state before any transformations
    // This is critical for accurate insertion
    const originalSelection = editor.selection ? { ...editor.selection } : null;

    // Log the original selection for debugging
    console.log('wrapLink - Original selection:', JSON.stringify(originalSelection));

    if (!originalSelection) {
      // If no selection, place cursor at the end of the document
      const end = Editor.end(editor, []);
      Transforms.select(editor, end);
      console.log('wrapLink - No selection, placing cursor at end of document');
    }

    // Get the current paragraph path AFTER ensuring we have a selection
    const [paragraphNode, paragraphPath] = Editor.above(editor, {
      match: n => n.type === 'paragraph',
    }) || [null, null];

    console.log('wrapLink - Current paragraph path:', JSON.stringify(paragraphPath));
    console.log('wrapLink - Current selection after paragraph check:', JSON.stringify(editor.selection));

    // CRITICAL FIX: Save the exact point where the cursor is
    // This is the key to inserting at the correct position
    const insertionPoint = editor.selection ? { ...editor.selection.anchor } : null;
    console.log('wrapLink - Insertion point:', JSON.stringify(insertionPoint));

    if (isCollapsed) {
      // For collapsed selection (cursor), insert the link node

      // CRITICAL FIX: Use the exact insertion point for precise positioning
      if (insertionPoint && paragraphPath) {
        // Create a point-specific selection at the exact cursor position
        const preciseSelection = {
          anchor: insertionPoint,
          focus: insertionPoint
        };

        console.log('wrapLink - Precise selection for insertion:', JSON.stringify(preciseSelection));

        // First select the exact point to ensure correct insertion
        Transforms.select(editor, preciseSelection);

        // Now insert the link at the precise position
        Transforms.insertNodes(editor, linkElement, {
          at: preciseSelection,
          select: true // Select the inserted node
        });

        // Move cursor to the end of the link
        Transforms.collapse(editor, { edge: "end" });

        // Insert a space after the link only if we're not at the end of the paragraph
        const currentPoint = editor.selection ? editor.selection.focus : null;
        if (currentPoint) {
          const endPoint = Editor.end(editor, paragraphPath);
          const isAtEnd = endPoint.offset === currentPoint.offset;
          if (!isAtEnd) {
            Transforms.insertText(editor, " ");
          }
        }
      } else {
        // Fallback if we don't have precise position information
        console.log('wrapLink - Using fallback insertion without precise position');
        Transforms.insertNodes(editor, linkElement, { select: true });
        Transforms.collapse(editor, { edge: "end" });
      }
    } else {
      // For non-collapsed selection (text selected), wrap the selection with the link

      // CRITICAL FIX: Ensure we're wrapping the exact selection
      if (originalSelection && paragraphPath) {
        console.log('wrapLink - Wrapping selection:', JSON.stringify(originalSelection));

        // First ensure the original selection is active
        Transforms.select(editor, originalSelection);

        // Now wrap the selected text with the link
        Transforms.wrapNodes(editor, linkElement, {
          at: originalSelection,
          split: true,
          select: true
        });

        // Move cursor to the end of the link
        Transforms.collapse(editor, { edge: "end" });

        // Insert a space after the link only if we're not at the end of the paragraph
        const currentPoint = editor.selection ? editor.selection.focus : null;
        if (currentPoint) {
          const endPoint = Editor.end(editor, paragraphPath);
          const isAtEnd = endPoint.offset === currentPoint.offset;
          if (!isAtEnd) {
            Transforms.insertText(editor, " ");
          }
        }
      } else {
        // Fallback if we don't have precise selection information
        console.log('wrapLink - Using fallback wrapping without precise selection');
        Transforms.wrapNodes(editor, linkElement, { split: true, select: true });
        Transforms.collapse(editor, { edge: "end" });
      }
    }

    // CRITICAL FIX: Ensure the editor is properly updated after link insertion
    // This forces a re-render of the editor with the updated content
    if (typeof editor.onChange === 'function') {
      editor.onChange();
      console.log('wrapLink - Triggered onChange to update editor state');
    }

  } catch (error) {
    console.error('Error in wrapLink:', error);
    // Simplified fallback with better error handling
    try {
      if (isCollapsed) {
        Transforms.insertNodes(editor, linkElement, { select: true });
      } else {
        Transforms.wrapNodes(editor, linkElement, { split: true, select: true });
      }
      Transforms.collapse(editor, { edge: "end" });
      console.log('wrapLink - Used simplified fallback after error');
    } catch (fallbackError) {
      console.error('Critical error in wrapLink fallback:', fallbackError);
    }
  }
};

const unwrapLink = (editor) => {
  Transforms.unwrapNodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === "link",
  });
};

const LinkComponent = forwardRef(({ attributes, children, element, openLinkEditor }, ref) => {
  const editor = useSlate();

  // Use PillStyle context to get the current pill style
  const { pillStyle, getPillStyleClasses } = usePillStyle();

  // MAJOR FIX: Completely rewritten link validation for edit mode
  // This ensures links are rendered correctly in both edit and view modes
  // and fixes issues with links disappearing or appearing in the wrong position

  // First, create a deep copy of the element to avoid modifying the original
  let elementCopy;
  try {
    elementCopy = JSON.parse(JSON.stringify(element));
  } catch (copyError) {
    console.error('LinkComponent: Error creating deep copy, using shallow copy:', copyError);
    elementCopy = { ...element };
  }

  // Now validate the link to ensure all required properties are present
  const validatedElement = validateLink(elementCopy);
  console.log('LinkComponent: Validated element:', JSON.stringify(validatedElement));

  // CRITICAL FIX: Ensure the link has a unique ID
  if (!validatedElement.id) {
    validatedElement.id = `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Use our utility functions to determine link type
  const isUserLinkType = isUserLink(validatedElement.url) || validatedElement.isUser || validatedElement.className === 'user-link';
  const isPageLinkType = isPageLink(validatedElement.url) || validatedElement.pageId || validatedElement.className === 'page-link';
  const isExternalLinkType = isExternalLink(validatedElement.url) || validatedElement.isExternal || validatedElement.className === 'external-link';

  // Determine the appropriate class based on link type
  const linkTypeClass = isUserLinkType ? 'user-link' : isPageLinkType ? 'page-link' : 'external-link';

  const handleClick = (e) => {
    e.preventDefault();
    try {
      // Check if ReactEditor and findPath are available
      if (ReactEditor && typeof ReactEditor.findPath === 'function') {
        const path = ReactEditor.findPath(editor, element);
        openLinkEditor(element, path);
      } else {
        console.warn("ReactEditor.findPath is not available");
        // Still try to open the link editor with just the element
        openLinkEditor(element, null);
      }
    } catch (error) {
      console.error("Error handling link click:", error);
      // Fallback: still try to open the link editor with just the element
      try {
        openLinkEditor(element, null);
      } catch (fallbackError) {
        console.error("Error in fallback link handling:", fallbackError);
      }
    }
  };

  // Allow text to display fully, only truncate when necessary
  const textWrapStyle = 'whitespace-nowrap';

  // Apply padding based on pill style
  const classicPadding = pillStyle === 'classic' ? '' : 'px-2 py-0.5';

  // Base styles for all pill links - EXACTLY matching PillLink component
  // IMPORTANT: This must match the styles in PillLink.js to ensure consistent appearance
  // between edit mode and view mode. Any changes here should also be made in PillLink.js.
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

  return (
    <a
      {...attributes}
      ref={ref}
      onClick={handleClick}
      contentEditable={false} // Make the link non-editable
      className={baseStyles}
      data-pill-style={pillStyle}
      data-page-id={isPageLinkType ? (validatedElement.pageId || '') : undefined}
      data-user-id={isUserLinkType ? (validatedElement.userId || '') : undefined}
      data-link-type={linkTypeClass}
      title={validatedElement.children?.[0]?.text || ''} // Add title attribute for hover tooltip on truncated text
    >
      <span className="pill-text">
        {children}
      </span>
      {isExternalLinkType || isExternalLink(validatedElement.url) ? (
        <ExternalLink size={14} className="ml-1 flex-shrink-0" />
      ) : null}
    </a>
  );
});

LinkComponent.displayName = 'LinkComponent';

const isLinkActive = (editor) => {
  const [link] = Editor.nodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === "link",
  });
  return !!link;
};

const LinkEditor = ({ onSelect, setShowLinkEditor, initialText = "", initialPageId = null, initialPageTitle = "" }) => {
  // CRITICAL FIX: Improved state management with better defaults
  const [displayText, setDisplayText] = useState(initialText || initialPageTitle || "");
  const [selectedPageId, setSelectedPageId] = useState(initialPageId);
  const [pageTitle, setPageTitle] = useState(initialPageTitle || "");
  const [externalUrl, setExternalUrl] = useState("");
  // CRITICAL FIX: Always default to page tab for consistency
  const [activeTab, setActiveTab] = useState("page");

  // Determine if we're editing an existing link
  const isEditing = !!initialPageId || !!initialText;

  // Validation helpers with improved error handling
  const isPageValid = activeTab === 'page' && !!selectedPageId;
  const isExternalValid = activeTab === 'external' && !!externalUrl && externalUrl.trim().length > 0;
  const canSave = (activeTab === 'page' && isPageValid) || (activeTab === 'external' && isExternalValid);

  // Handle close
  const handleClose = () => {
    setShowLinkEditor(false);
  };

  // Handle page selection with improved error handling
  const handlePageSelect = (page) => {
    if (!page) {
      console.warn('LinkEditor: Received null page in handlePageSelect');
      return;
    }

    try {
      // Set page ID and title
      setSelectedPageId(page.id);
      setPageTitle(page.title || 'Untitled Page');

      // Only update display text if it's empty or matches the previous page title
      // This preserves custom display text entered by the user
      if (!displayText || displayText === pageTitle) {
        setDisplayText(page.title || 'Untitled Page');
      }
    } catch (error) {
      console.error('LinkEditor: Error in handlePageSelect:', error);
      // Fallback with safe values
      setSelectedPageId(page.id || null);
      setPageTitle(page.title || 'Untitled Page');
      if (!displayText) {
        setDisplayText(page.title || 'Untitled Page');
      }
    }
  };

  // Handle external URL changes
  const handleExternalUrlChange = (e) => {
    setExternalUrl(e.target.value);
  };

  // Handle save for page links
  const handlePageSave = () => {
    if (isPageValid) {
      onSelect({
        id: selectedPageId,
        title: pageTitle,
        displayText: displayText
      });
    }
  };

  // Handle save for external links
  const handleExternalSave = () => {
    if (isExternalValid) {
      // Ensure URL has protocol
      let finalUrl = externalUrl;
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = 'https://' + finalUrl;
      }

      onSelect({
        url: finalUrl,
        displayText: displayText || externalUrl,
        isExternal: true
      });
    }
  };

  // Handle URL input that looks like an external link
  const handleUrlLikeInput = (value) => {
    if (value && (
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('www.') ||
      value.includes('.com') ||
      value.includes('.org') ||
      value.includes('.net')
    )) {
      setActiveTab('external');
      setExternalUrl(value);
    }
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
        {/* Header */}
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
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 border-b border-border">
          <div className="flex">
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${
                activeTab === 'page'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('page')}
            >
              <FileText className="h-4 w-4" />
              WeWrite Page
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${
                activeTab === 'external'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('external')}
            >
              <Globe className="h-4 w-4" />
              External link
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'page' ? (
            <div className="p-4">
              <TypeaheadSearch
                onSelect={handlePageSelect}
                placeholder="Search pages..."
                initialSelectedId={selectedPageId}
                displayText={displayText}
                setDisplayText={setDisplayText}
                preventRedirect={true}
                onInputChange={handleUrlLikeInput}
              />
            </div>
          ) : (
            <div className="p-4">
              <div className="space-y-2">
                <h2 className="text-sm font-medium">URL</h2>
                <input
                  type="url"
                  value={externalUrl}
                  onChange={handleExternalUrlChange}
                  placeholder="https://example.com"
                  className="w-full p-2 bg-muted/50 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer with button */}
        <div className="p-4 border-t border-border">
          {activeTab === 'page' ? (
            <button
              onClick={handlePageSave}
              disabled={!isPageValid}
              className="w-full py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? 'Save changes' : 'Insert link'}
            </button>
          ) : (
            <button
              onClick={handleExternalSave}
              disabled={!isExternalValid}
              className="w-full py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? 'Save changes' : 'Add External Link'}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

// Use forwardRef for EditorContent so Editable can receive the ref
const EditorContent = React.forwardRef(({ editor, handleKeyDown, renderElement }, editableRef) => {
  const { lineMode } = useLineSettings();
  const [selectedParagraph, setSelectedParagraph] = useState(null);

  // Get the current Slate editor from context instead of props
  // This ensures we're using the editor from the Slate context
  let slateEditor;
  try {
    slateEditor = useSlate();
  } catch (error) {
    console.warn("Could not get editor from Slate context:", error);
    slateEditor = null;
  }

  // Use the editor from context if available, otherwise fall back to props
  const activeEditor = slateEditor || editor;

  // If we don't have an editor at all, render a fallback
  if (!activeEditor) {
    console.warn("No editor available in EditorContent");
    return (
      <div className="p-4 border border-dashed border-muted-foreground rounded-md">
        <p className="text-muted-foreground">Editor not available</p>
      </div>
    );
  }

  // Simplified selection tracking
  useEffect(() => {
    // Only track selection when editor is available
    if (!activeEditor) return;

    const handleSelectionChange = () => {
      try {
        // If no selection, clear the selected paragraph
        if (!activeEditor.selection) {
          setSelectedParagraph(null);
          return;
        }

        // Get the path of the current node
        const nodeEntry = Editor.above(activeEditor, {
          match: n => !Editor.isEditor(n) && SlateElement.isElement(n),
        });

        // If we found a node, set its path as the selected paragraph
        if (nodeEntry) {
          const [, path] = nodeEntry;
          setSelectedParagraph(path[0]);
        } else {
          setSelectedParagraph(null);
        }
      } catch (error) {
        console.error("Error tracking selection:", error);
        setSelectedParagraph(null);
      }
    };

    // Add event listener for selection changes
    document.addEventListener('selectionchange', handleSelectionChange);

    // Initial check
    handleSelectionChange();

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [activeEditor]);

  // Get styles based on line mode
  const getLineModeStyles = () => {
    switch(lineMode) {
      case LINE_MODES.NORMAL:
        return 'space-y-2.5'; // Further reduced spacing for normal mode
      case LINE_MODES.DENSE:
        return 'space-y-0'; // Bible verse style with minimal spacing between paragraphs
      default:
        return 'space-y-2'; // Fallback spacing if mode is undefined
    }
  };

  // Custom element renderer that adds hover and selection styles
  const renderElementWithStyles = (props) => {
    const { element, attributes } = props;
    // Check if element and path exist before comparing
    const isSelected = selectedParagraph !== null &&
                      ((element.id && selectedParagraph === element.id) ||
                       (props.path && selectedParagraph === props.path[0]));

    // Create a new props object with custom styling
    const enhancedProps = {
      ...props,
      attributes: {
        ...attributes,
        className: `${attributes.className || ''} rounded-sm transition-colors duration-150 hover:bg-accent/10 ${isSelected ? 'bg-accent/20' : ''}`,
      }
    };

    // Call the original renderElement with the enhanced props
    return renderElement(enhancedProps);
  };

  return (
    <div
      className={`p-2 ${getLineModeStyles()} w-full`}
      style={{
        height: '100%', // Fill the parent container
        position: 'relative',
        overflow: 'auto' // Enable scrolling for content
      }}
    >
      <style jsx global>{`
        /* Ensure placeholder text aligns with actual text */
        [data-slate-editor] [data-slate-placeholder] {
          position: absolute;
          pointer-events: none;
          display: inline-block;
          width: auto;
          white-space: nowrap;
          margin-left: 1.75rem; /* Align with text after paragraph number */
          opacity: 0.6;
          font-size: 1rem; /* Match text size */
          line-height: 1.5; /* Match line height */
          top: 0.75rem; /* Adjust vertical position to match text */
          color: var(--muted-foreground); /* Match text color */
          font-family: inherit; /* Ensure font matches */
          transform: translateY(-0.25rem); /* Fine-tune vertical alignment */
        }

        /* Style for the first paragraph number to ensure alignment with placeholder */
        [data-slate-editor] .paragraph-with-number:first-child .paragraph-number-inline {
          min-width: 1rem;
          margin-right: 0.5rem;
          text-align: right;
          vertical-align: top;
          position: relative;
          top: 0.5em;
        }

        /* Ensure consistent styling for all paragraph numbers */
        [data-slate-editor] .paragraph-number-inline {
          min-width: 1rem;
          margin-right: 0.5rem;
        }
      `}</style>
      <Editable
        ref={editableRef}
        renderElement={renderElementWithStyles}
        renderLeaf={props => <Leaf {...props} />}
        placeholder="Start typing..."
        spellCheck={true}
        autoFocus={false} // Don't auto-focus to avoid stealing focus from title
        onKeyDown={event => {
          // Only handle key events if this element or its children have focus
          if (document.activeElement === editableRef.current ||
              editableRef.current?.contains(document.activeElement)) {
            handleKeyDown(event, activeEditor);
          }
        }}
        className="text-base leading-normal" // Match text styling
        // Add onFocus handler to preserve selection
        onFocus={() => {
          // If there's no selection, try to restore the last known selection
          if (!activeEditor.selection && activeEditor.lastSelection) {
            try {
              Transforms.select(activeEditor, activeEditor.lastSelection);
            } catch (error) {
              console.error('Error restoring last selection on focus:', error);
            }
          }
        }}
        // Add onBlur handler to save the current selection
        onBlur={() => {
          // Save the current selection when the editor loses focus
          if (activeEditor.selection) {
            activeEditor.lastSelection = activeEditor.selection;
          }
        }}
        className="outline-none h-full"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          padding: '8px'
        }}
      />
    </div>
  );
});

// Add display name for debugging
EditorContent.displayName = 'EditorContent';

const Leaf = ({ attributes, children, leaf }) => {
  return (
    <span
      {...attributes}
      style={{ fontWeight: leaf.bold ? 'bold' : 'normal' }}
      className="transition-colors"
    >
      {children}
    </span>
  )
}

export default ReplyEditor;
