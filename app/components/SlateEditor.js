import { Switch } from "./ui/switch";
import React, { useState, useContext, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import {
  createEditor,
  Transforms,
  Editor,
  Element as SlateElement,
  Path,
  Range,
  Node,
} from "slate";
import { Editable, withReact, useSlate, Slate } from "slate-react";
import { ReactEditor } from "slate-react";

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
  }
};
import { DataContext } from "../providers/DataProvider";
import { AuthContext } from "../providers/AuthProvider";
import { withHistory } from "slate-history";
import TypeaheadSearch from "./TypeaheadSearch";
import { Search, X, Link as LinkIcon, ExternalLink, FileText, Globe } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useLineSettings, LINE_MODES, LineSettingsProvider } from '../contexts/LineSettingsContext';
import { motion } from "framer-motion";
import "../styles/shake-animation.css";
import { formatPageTitle, formatUsername, isUserLink, isPageLink, isExternalLink } from "../utils/linkFormatters";

/**
 * SlateEditor Component
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
const SlateEditor = forwardRef(({ initialEditorState = null, initialContent = null, onContentChange }, ref) => {
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
      // TODO: Implement save functionality
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
      const { selection } = editor;

      console.log("@ key pressed, showing link editor menu");

      // Always show the link editor menu, even if there's no selection
      if (selection) {
        showLinkEditorMenu(editor, selection);
      } else {
        // If no selection, position at the end
        const end = Editor.end(editor, []);
        Transforms.select(editor, end);
        showLinkEditorMenu(editor, editor.selection);
      }
    }

    if (event.key === "Escape") {
      setShowLinkEditor(false);
    }
  };

  const showLinkEditorMenu = (editor, editorSelection) => {
    try {
      // First try to use the editor selection if provided
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
        // Position the link editor in the center as a fallback
        setLinkEditorPosition({
          top: window.innerHeight / 2,
          left: window.innerWidth / 2,
        });
        setShowLinkEditor(true);
        return;
      }

      const range = selection.getRangeAt(0).cloneRange();
      const rect = range.getBoundingClientRect();

      setLinkEditorPosition({
        top: rect.bottom + window.pageYOffset,
        left: rect.left + window.pageXOffset,
      });

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

    // Pass initial values to the LinkEditor with safe access to properties
    setInitialLinkValues({
      text: element.children && element.children[0] ? element.children[0].text || "" : "",
      pageId: element.pageId || null,
      pageTitle: element.pageTitle || ""
    });

    setShowLinkEditor(true);
  };

  const handleSelection = (item) => {
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
          // Fall through to insert a new link as fallback
        }
      } else {
        // Insert new external link
        const link = {
          type: "link",
          url: item.url,
          children: [{ text: displayText }],
          isExternal: true
        };

        // Make sure we have a valid selection
        if (!editor.selection) {
          // If no selection, place cursor at the end of the document
          const end = Editor.end(editor, []);
          Transforms.select(editor, end);
        }

        // Insert the link node
        Transforms.insertNodes(editor, link, { at: editor.selection });

        // Move cursor to the end of the link
        Transforms.collapse(editor, { edge: "end" });

        // Insert a space after the link for better editing experience
        Transforms.insertText(editor, " ");
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
              url: `/pages/${item.id}`,
              children: [{ text: formattedTitle }],
              pageId: item.id,
              pageTitle: item.title // Store the original page title for reference
            },
            { at: selectedLinkPath }
          );
        } catch (error) {
          console.error("Error updating existing page link:", error);
          // Fall through to insert a new link as fallback
        }
      } else {
        // Insertink
        const link = {
          type: "link",
          url: `/pages/${item.id}`,
          children: [{ text: formattedTitle }],
          pageId: item.id,
          pageTitle: item.title // Store the original page title for reference
        };

        // Make sure we have a valid selection
        if (!editor.selection) {
          // If no selection, place cursor at the end of the document
          const end = Editor.end(editor, []);
          Transforms.select(editor, end);
        }

        // Insert the link node
        Transforms.insertNodes(editor, link, { at: editor.selection });

        // Move cursor to the end of the link
        Transforms.collapse(editor, { edge: "end" });

        // Insert a space after the link for better editing experience
        Transforms.insertText(editor, " ");
      }
    }

    // Reset link editor state
    setSelectedLinkElement(null);
    setSelectedLinkPath(null);
    setInitialLinkValues({});

    // Focus the editor with error handling
    try {
      if (ReactEditor && typeof ReactEditor.focus === 'function') {
        ReactEditor.focus(editor);
      } else {
        console.warn("ReactEditor.focus is not available");
      }
    } catch (error) {
      console.error("Error focusing editor:", error);
    }

    // Hide the dropdown
    setShowLinkEditor(false);
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
        const index = props.element.path ? props.element.path[0] : ReactEditor.findPath(editor, element)[0];

        // Attribution paragraphs - no special styling, just regular paragraph
        if (isAttributionParagraph) {
          return (
            <p {...attributes} className="flex items-start gap-3 py-2.5">
              <span className="text-sm text-muted-foreground flex items-center justify-end select-none w-6 text-right flex-shrink-0" style={{ transform: 'translateY(0.15rem)' }}>
                {index + 1}
              </span>
              <span className="flex-1">{children}</span>
            </p>
          );
        }

        // Regular paragraph styling
        return (
          <p {...attributes} className="flex items-start gap-3 py-2.5">
            <span className="text-sm text-muted-foreground flex items-center justify-end select-none w-6 text-right flex-shrink-0" style={{ transform: 'translateY(0.15rem)' }}>
              {index + 1}
            </span>
            <span className="flex-1">{children}</span>
          </p>
        );
      default:
        const defaultIndex = props.element.path ? props.element.path[0] : ReactEditor.findPath(editor, element)[0];
        return (
          <p {...attributes} className="flex items-start gap-3 py-2.5">
            <span
              className="text-sm text-muted-foreground flex items-center justify-end select-none w-6 text-right flex-shrink-0"
              style={{ transform: 'translateY(0.15rem)', pointerEvents: 'none' }}
              tabIndex="-1"
              aria-hidden="true"
            >
              {defaultIndex + 1}
            </span>
            <span className="flex-1">{children}</span>
          </p>
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

SlateEditor.displayName = 'SlateEditor';

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

  const linkElement = {
    type: "link",
    url,
    pageId,
    pageTitle,
    children: isCollapsed ? [{ text }] : [],
  };

  if (isCollapsed) {
    Transforms.insertNodes(editor, linkElement);
  } else {
    Transforms.wrapNodes(editor, linkElement, { split: true });
    Transforms.collapse(editor, { edge: "end" });
  }
};

const unwrapLink = (editor) => {
  Transforms.unwrapNodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === "link",
  });
};

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

const LinkComponent = forwardRef(({ attributes, children, element, openLinkEditor }, ref) => {
  // const selected = useSelected();
  const editor = useSlate();

  // Use our utility functions to determine link type
  const isUserLinkType = isUserLink(element.url) || element.isUser || element.className === 'user-link';
  const isPageLinkType = isPageLink(element.url) || element.pageId || element.className === 'page-link';
  const isExternalLinkType = isExternalLink(element.url) || element.isExternal || element.className === 'external-link';

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

  // We'll handle deletion in the editor's main keydown handler instead

  return (
    <a
      {...attributes}
      ref={ref}
      onClick={handleClick}
      contentEditable={false} // Make the link non-editable
      className={`inline-flex items-center my-0.5 px-1.5 py-0.5 text-sm font-medium rounded-[8px] transition-colors duration-200 bg-primary text-primary-foreground border-[1.5px] border-[rgba(255,255,255,0.2)] hover:bg-primary/90 hover:border-[rgba(255,255,255,0.3)] shadow-sm cursor-pointer ${linkTypeClass}`}
      data-page-id={isPageLinkType ? (element.pageId || '') : undefined}
      data-user-id={isUserLinkType ? (element.userId || '') : undefined}
      data-link-type={linkTypeClass}
    >
      <InlineChromiumBugfix />
      <div className="flex items-center gap-0.5 min-w-0">
        {children}
        {isExternalLinkType || isExternalLink(element.url) ? (
          <ExternalLink className="inline-block h-3 w-3 ml-1 flex-shrink-0" />
        ) : null}
      </div>
      <InlineChromiumBugfix />
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
  const [displayText, setDisplayText] = useState(initialText);
  const [pageTitle, setPageTitle] = useState(initialPageTitle); // Store the original page title
  const [activeTab, setActiveTab] = useState("page"); // "page" or "external"
  const [selectedPageId, setSelectedPageId] = useState(initialPageId);
  const [externalUrl, setExternalUrl] = useState("");
  const [showAuthor, setShowAuthor] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);
  // Determine if we're editing an existing link or creating a new one
  const isEditing = !!initialPageId || !!initialText;

  // Track initial state for change detection
  const initialState = React.useRef({
    displayText: initialText,
    pageTitle: initialPageTitle,
    selectedPageId: initialPageId,
    externalUrl: "",
    showAuthor: false,
    activeTab: "page"
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
  }, [displayText, pageTitle, selectedPageId, externalUrl, showAuthor, activeTab]);

  // Validation helpers
  const isPageValid = activeTab === 'page' && !!selectedPageId;
  const isExternalValid = activeTab === 'external' && externalUrl && (externalUrl.startsWith('http://') || externalUrl.startsWith('https://'));
  const canSave = hasChanged && ((activeTab === 'page' && isPageValid) || (activeTab === 'external' && isExternalValid));

  const handleClose = () => {
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
    if (isExternalValid) {
      onSelect({
        url: externalUrl,
        displayText: displayText,
        isExternal: true
      });
    }
  };

  // Handle save for page links
  const handleSave = (item) => {
    if (canSave) {
      onSelect({
        ...item,
        showAuthor
      });
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
            <X className="h-4 w-4" />
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
                <FileText className="h-4 w-4" />
                WeWrite Page
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${activeTab === 'external'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('external')}
              >
                <Globe className="h-4 w-4" />
                External link
              </button>
            </div>
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'page' ? (
              <div className="p-4">
                <div>
                  <TypeaheadSearch
                    onSelect={(page) => {
                      setSelectedPageId(page.id);
                      setPageTitle(page.title);
                      setDisplayText(page.title);
                    }}
                    placeholder="Search pages..."
                    initialSelectedId={selectedPageId}
                    displayText={displayText}
                    setDisplayText={setDisplayText}
                    preventRedirect={true}
                    onInputChange={(value) => {
                      if (value && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('www.') || value.includes('.com') || value.includes('.org') || value.includes('.net') || value.includes('.io'))) {
                        setActiveTab('external');
                        setExternalUrl(value);
                      }
                    }}
                  />
                  {/* Show Author Switch */}
                  <div className="flex items-center gap-2 mt-4 mb-4">
                    <Switch checked={showAuthor} onCheckedChange={setShowAuthor} id="show-author-switch" />
                    <label htmlFor="show-author-switch" className="text-sm font-medium select-none">Show author</label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <h2 className="text-sm font-medium">Text</h2>
                  <input
                    type="text"
                    value={displayText}
                    onChange={handleDisplayTextChange}
                    placeholder="Link text"
                    className="w-full p-2 bg-muted/50 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground text-sm"
                  />
                </div>

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
                <div className="flex items-center gap-2 mb-2">
                  <Switch checked={showAuthor} onCheckedChange={setShowAuthor} id="show-author-switch-ext" />
                  <label htmlFor="show-author-switch-ext" className="text-sm font-medium select-none">Show author</label>
                </div>
              </div>
            )}
          </div>

          {/* Sticky footer with button */}
          <div className="p-4 border-t border-border">
            {activeTab === 'page' ? (
              <button
                onClick={() => handleSave({ id: selectedPageId, title: pageTitle })}
                disabled={!canSave}
                className="w-full py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEditing ? 'Save changes' : 'Insert link'}
              </button>
            ) : (
              <button
                onClick={handleExternalSubmit}
                disabled={!canSave}
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
        return 'space-y-4'; // Traditional document style with proper paragraph spacing
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

export default SlateEditor;
