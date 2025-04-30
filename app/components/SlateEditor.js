import { Switch } from "./ui/switch";
import React, { useState, useContext, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import { AuthContext } from "../providers/AuthProvider";
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
const SlateEditor = forwardRef(({ initialEditorState = null, initialContent = null, onContentChange, onInsert }, ref) => {
  const [editor] = useState(() => withInlines(withHistory(withReact(createEditor()))));
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [selectedLinkElement, setSelectedLinkElement] = useState(null);
  const [selectedLinkPath, setSelectedLinkPath] = useState(null);
  const [initialLinkValues, setInitialLinkValues] = useState({}); // New state to store initial link values
  const editableRef = useRef(null);
  const [lineCount, setLineCount] = useState(0);
  const hasPositionedCursor = useRef(false); // NEW: track if we've set the cursor
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
  // Initialize with all paragraphs visible if initialValue is available
  const [visibleParagraphs, setVisibleParagraphs] = useState(
    initialValue && Array.isArray(initialValue)
      ? Array.from({ length: initialValue.length }, (_, i) => i)
      : []
  );
  const revealTimeoutRef = useRef(null);

  // Progressive reveal effect on mount or when initialValue changes
  useEffect(() => {
    if (!initialValue || !Array.isArray(initialValue)) return;

    // Instead of progressive reveal, make all paragraphs visible immediately
    const allParagraphIndices = Array.from({ length: initialValue.length }, (_, i) => i);
    setVisibleParagraphs(allParagraphIndices);

    // Clean up any existing timeout
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
    }

    return () => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    };
  }, [initialValue]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      try {
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
            console.log('Editor focused via DOM fallback');
          }
        }
      } catch (error) {
        console.error('Error focusing editor:', error);
      }
    },
    // Add a method to directly open the link editor
    openLinkEditor: () => {
      try {
        console.log("openLinkEditor called");
        // Focus the editor first
        safeReactEditor.focus(editor);

        // Get the current selection or create one at the end if none exists
        let selection = editor.selection;
        if (!selection) {
          console.log("No selection, creating one at the end");
          const end = Editor.end(editor, []);
          Transforms.select(editor, end);
          selection = editor.selection;
        }

        // Show the link editor directly
        setShowLinkEditor(true);
        setSelectedLinkElement(null);
        setSelectedLinkPath(null);
        console.log("Link editor shown directly");
      } catch (error) {
        console.error('Error opening link editor:', error);
        // Fallback if all else fails
        setShowLinkEditor(true);
        console.log("Link editor shown via error fallback");
      }
    }
  }));

  // Use initialContent as the priority content source if available
  useEffect(() => {
    if (initialContent && !hasPositionedCursor.current) {
      hasPositionedCursor.current = true;
      // Add debug log to see what initialContent is
      console.log("SlateEditor initialContent:", JSON.stringify(initialContent, null, 2));
      try {
        setInitialValue(initialContent);
        if (typeof onContentChange === 'function') {
          onContentChange(initialContent);
        }
        // Only focus the editor on first mount, do not set cursor to any specific line
        setTimeout(() => {
          try {
            const focused = safeReactEditor.focus(editor);
            if (!focused) {
              const editorElement = document.querySelector('[data-slate-editor=true]');
              if (editorElement) editorElement.focus();
            }
          } catch (error) {
            console.error("Error focusing editor after content initialization:", error);
          }
        }, 100);
      } catch (error) {
        console.error("Error setting editor content from initialContent:", error);
      }
    }
  }, [initialContent, onContentChange, editor]);

  // Add a global event listener for the @ key
  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if (event.key === "@") {
        console.log("@ key pressed globally");

        // Check if we're in the editor
        const editorElement = document.querySelector('[data-slate-editor=true]');
        const isEditorFocused = document.activeElement === editorElement ||
                               editorElement?.contains(document.activeElement);

        if (isEditorFocused) {
          console.log("Editor is focused, showing link editor");
          event.preventDefault();

          // The link editor is centered via CSS, no need to set position

          // Show the link editor directly
          setShowLinkEditor(true);
          setSelectedLinkElement(null);
          setSelectedLinkPath(null);
          console.log("Link editor shown from global @ key handler");
        }
      }
    };

    // Add the event listener
    document.addEventListener("keydown", handleGlobalKeyDown);

    // Clean up
    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  // Make sure initialValue is properly set from initialContent
  useEffect(() => {
    if (initialContent && initialValue.length === 1 && initialValue[0].children[0].text === "") {
      console.log("Setting initialValue from initialContent in secondary effect");
      setInitialValue(initialContent);
    }
  }, [initialContent, initialValue]);

  // onchange handler with error handling
  const onChange = (newValue) => {
    try {
      // Make sure newValue is valid before updating state
      if (Array.isArray(newValue) && newValue.length > 0) {
        // Update local state
        setLineCount(newValue.length);

        // Call the parent component's onContentChange callback
        if (typeof onContentChange === 'function') {
          console.log('SlateEditor onChange: Updating parent component with new content');
          onContentChange(newValue);
        } else {
          console.warn('SlateEditor onChange: No onContentChange callback provided');
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
      console.log("@ key pressed, opening link editor");

      // Don't insert the @ symbol, just show the link editor directly
      try {
        // Show the link editor directly
        setShowLinkEditor(true);
        setSelectedLinkElement(null);
        setSelectedLinkPath(null);
        console.log("Link editor shown directly from @ key handler");
      } catch (error) {
        console.error("Error showing link editor from @ key:", error);
      }
    }

    if (event.key === "Escape") {
      setShowLinkEditor(false);
    }
  };

  const showLinkEditorMenu = (editor, editorSelection) => {
    console.log("showLinkEditorMenu called", { editor: !!editor, editorSelection: !!editorSelection });
    try {
      // Show the link editor directly
      setShowLinkEditor(true);
      setSelectedLinkElement(null);
      setSelectedLinkPath(null);
      console.log("Link editor shown directly from showLinkEditorMenu");
    } catch (error) {
      console.error("Error showing link editor menu:", error);
      // Fallback if all else fails
      setShowLinkEditor(true);
      setSelectedLinkElement(null);
      setSelectedLinkPath(null);
      console.log("Link editor shown via error fallback");
    }
  };

  const openLinkEditor = (element, path) => {
    setSelectedLinkElement(element);
    setSelectedLinkPath(path);
    // Pass initial values to the LinkEditor
    setInitialLinkValues({
      text: element.children[0]?.text || "",
      pageId: element.pageId || null,
      pageTitle: element.pageTitle || "",
      url: element.url || "" // Add the URL to the initial values
    });
    setShowLinkEditor(true);
  };

  const handleSelection = (item) => {
    // Check if this is an external link
    if (item.isExternal) {
      const displayText = item.displayText || item.url;

      if (selectedLinkElement && selectedLinkPath) {
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
      } else {
        // Insert new link
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

    // Focus the editor
    ReactEditor.focus(editor);

    // Hide the dropdown
    setShowLinkEditor(false);
  };

  const renderElement = (props) => {
    const { attributes, children, element } = props;
    const index = props.element.path ? props.element.path[0] : ReactEditor.findPath(editor, element)[0];

    // Simple animation style with no visibility conditions
    const animationStyle = {
      transition: 'opacity 0.18s cubic-bezier(.4,0,.2,1), transform 0.18s cubic-bezier(.4,0,.2,1)',
      opacity: 1,
      transform: 'translateY(0px)',
      willChange: 'opacity, transform',
    };
    switch (element.type) {
      case "link":
        return <LinkComponent {...props} openLinkEditor={openLinkEditor} />;
      case "paragraph": {
        const index = props.element.path ? props.element.path[0] : ReactEditor.findPath(editor, element)[0];
        // Attribution paragraphs - render as normal text without special styling
        // Only identify paragraphs that have the explicit isAttribution flag or contain "Replying to" text
        if (element.isAttribution || (element.type === "paragraph" && element.children && element.children.some(child => child.text && child.text.includes("Replying to")))) {
          return (
            <div className="relative flex items-start gap-3 py-2.5 group" style={animationStyle}>
              <span
                contentEditable={false}
                tabIndex={-1}
                className="text-sm text-muted-foreground flex items-center justify-end select-none w-6 text-right flex-shrink-0 pointer-events-none opacity-80 group-hover:opacity-100"
                aria-hidden="true"
                style={{ userSelect: 'none', pointerEvents: 'none', alignSelf: 'center' }}
              >
                {index + 1}
              </span>
              <p
                {...attributes}
                className="flex-1 ml-8 min-w-0 attribution-paragraph"
                style={{ position: 'relative' }}
                data-attribution="true"
              >
                {children}
              </p>
            </div>
          );
        }
        // Regular paragraph styling
        return (
          <div className="relative flex items-start gap-3 py-2.5 group" style={animationStyle}>
            <span
              contentEditable={false}
              tabIndex={-1}
              className="text-sm text-muted-foreground flex items-center justify-end select-none w-6 text-right flex-shrink-0 pointer-events-none opacity-80 group-hover:opacity-100"
              aria-hidden="true"
              style={{ userSelect: 'none', pointerEvents: 'none', alignSelf: 'center' }}
            >
              {index + 1}
            </span>
            <p
              {...attributes}
              className="flex-1 ml-8 min-w-0"
              style={{ position: 'relative' }}
            >
              {children}
            </p>
          </div>
        );
      }
      default: {
        const defaultIndex = props.element.path ? props.element.path[0] : ReactEditor.findPath(editor, element)[0];
        return (
          <div className="relative flex items-start gap-3 py-2.5 group" style={animationStyle}>
            <span
              contentEditable={false}
              tabIndex={-1}
              className="text-sm text-muted-foreground flex items-center justify-end select-none w-6 text-right flex-shrink-0 pointer-events-none opacity-80 group-hover:opacity-100"
              aria-hidden="true"
              style={{ userSelect: 'none', pointerEvents: 'none', alignSelf: 'center' }}
            >
              {defaultIndex + 1}
            </span>
            <p
              {...attributes}
              className="flex-1 ml-8 min-w-0"
              style={{ position: 'relative' }}
            >
              {children}
            </p>
          </div>
        );
      }
    }
  };

  // Force editor to use the initialValue
  useEffect(() => {
    try {
      // Reset the editor's children to match initialValue
      editor.children = initialValue;
      // Force a re-render
      editor.onChange();
      console.log("Forced editor to use initialValue:", JSON.stringify(initialValue, null, 2));
    } catch (error) {
      console.error("Error forcing editor to use initialValue:", error);
    }
  }, [editor, initialValue]);

  return (
    <LineSettingsProvider>
      <motion.div
        className="relative rounded-lg bg-background"
        initial={{ opacity: 1 }} // Start fully visible
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        <Slate
          editor={editor}
          initialValue={initialValue}
          onChange={onChange}
          // Remove the key prop that was causing re-creation and cursor jumps
        >
          <div className="flex">
            <div className="flex-grow">
              <div className="relative">
                <EditorContent
                  ref={editableRef}
                  editor={editor}
                  handleKeyDown={handleKeyDown}
                  renderElement={renderElement}
                  setShowLinkEditor={setShowLinkEditor}
                  setSelectedLinkElement={setSelectedLinkElement}
                  setSelectedLinkPath={setSelectedLinkPath}
                />
              </div>
            </div>
          </div>
        </Slate>
      </motion.div>

      {showLinkEditor && (
        <LinkEditor
          onSelect={handleSelection}
          setShowLinkEditor={setShowLinkEditor}
          initialText={initialLinkValues.text || ""}
          initialPageId={initialLinkValues.pageId || null}
          initialPageTitle={initialLinkValues.pageTitle || ""}
          initialUrl={initialLinkValues.url || ""}
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
      if (text && isUrl(text)) {
        wrapLink(editor, text)
      } else {
        insertText(text)
      }
    } catch (error) {
      console.error('Error in insertText:', error);
      // Fallback to original behavior
      insertText(text);
    }
  }

  // Override insertData to handle URL pasting and collapse double newlines
  editor.insertData = data => {
    try {
      let text = data.getData('text/plain');
      if (text) {
        // Collapse all double (or more) newlines to a single newline
        text = text.replace(/\n{2,}/g, '\n');
        if (isUrl(text)) {
          wrapLink(editor, text);
        } else {
          insertText(text);
        }
      } else {
        insertData(data);
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
    // For user links, ensure they never have @ symbols
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
      const path = ReactEditor.findPath(editor, element);
      openLinkEditor(element, path);
    } catch (error) {
      console.error("Error handling link click:", error);
    }
  };

  // We'll handle deletion in the editor's main keydown handler instead

  // Determine if this link is part of an attribution line
  const isInAttribution = React.useMemo(() => {
    try {
      // Find the parent paragraph
      const path = ReactEditor.findPath(editor, element);
      if (path.length >= 2) {
        const paragraphPath = path.slice(0, path.length - 2);
        const [paragraphNode] = Editor.node(editor, paragraphPath);

        // Check if the paragraph has the isAttribution flag
        // or if it contains text that includes "Replying to"
        // Using the same improved logic as in renderElement
        return paragraphNode?.isAttribution === true ||
               (paragraphNode?.children?.some(child =>
                 child.text && child.text.includes("Replying to")
               ));
      }
    } catch (error) {
      console.error("Error checking if link is in attribution:", error);
    }
    return false;
  }, [editor, element]);

  // No special styling for links in attribution lines - make them look like regular text
  const linkStyle = isInAttribution ? {
    backgroundColor: 'transparent !important',
    color: 'inherit !important',
    borderRadius: '0 !important',
    padding: '0 !important',
    margin: '0 !important',
    display: 'inline !important',
    whiteSpace: 'normal !important',
    alignItems: 'baseline !important',
    fontSize: 'inherit !important',
    fontWeight: 'inherit !important',
    border: 'none !important',
    textDecoration: 'none !important',
    boxShadow: 'none !important',
    cursor: 'text !important'
  } : {};

  // If this is in an attribution line, render as plain text
  if (isInAttribution) {
    return (
      <span
        {...attributes}
        ref={ref}
        contentEditable={false}
        style={linkStyle}
        className="attribution-text"
        data-page-id={isPageLinkType ? (element.pageId || '') : undefined}
        data-user-id={isUserLinkType ? (element.userId || '') : undefined}
        data-link-type={linkTypeClass}
      >
        {children}
      </span>
    );
  }

  // Otherwise render as a normal pill link
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

const LinkEditor = ({ onSelect, setShowLinkEditor, initialText = "", initialPageId = null, initialPageTitle = "", initialUrl = "" }) => {
  const [displayText, setDisplayText] = useState(initialText);
  const [pageTitle, setPageTitle] = useState(initialPageTitle); // Store the original page title
  const [selectedPageId, setSelectedPageId] = useState(initialPageId);
  const [externalUrl, setExternalUrl] = useState(initialUrl);
  const [showAuthor, setShowAuthor] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);
  const { user } = useContext(AuthContext); // Get the current user from AuthContext

  // Determine if the URL is an external link and set the activeTab accordingly
  const isUrlExternal = isExternalLink(initialUrl);
  const [activeTab, setActiveTab] = useState(isUrlExternal ? "external" : "page"); // "page" or "external"

  // Add event listener for Escape key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowLinkEditor(false);
      }
    };

    // Add the event listener
    document.addEventListener("keydown", handleKeyDown);

    // Clean up
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [setShowLinkEditor]);

  // Determine if we're editing an existing link or creating a new one
  const isEditing = !!initialPageId || !!initialText;

  // Track initial state for change detection
  const initialState = React.useRef({
    displayText: initialText,
    pageTitle: initialPageTitle,
    selectedPageId: initialPageId,
    externalUrl: initialUrl,
    showAuthor: false,
    activeTab: isUrlExternal ? "external" : "page"
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

    // Always enable the save button when toggling "Show author" on an existing link
    const isEditingExistingLink = isEditing && selectedPageId;
    const showAuthorChanged = showAuthor !== initialState.current.showAuthor;

    setHasChanged(changed || (isEditingExistingLink && showAuthorChanged));
  }, [displayText, pageTitle, selectedPageId, externalUrl, showAuthor, activeTab, isEditing]);

  // Validation helpers
  const isPageValid = activeTab === 'page' && !!selectedPageId;
  const isExternalValid = activeTab === 'external' && externalUrl && (externalUrl.startsWith('http://') || externalUrl.startsWith('https://'));
  const canSave = hasChanged && ((activeTab === 'page' && isPageValid) || (activeTab === 'external' && isExternalValid));

  // Handle changes to the display text input
  const handleDisplayTextChange = (e) => {
    setDisplayText(e.target.value);
  };

  // Handle changes to the external URL input
  const handleExternalUrlChange = (e) => {
    setExternalUrl(e.target.value);
  };

  // Handle submission of external link
  const handleExternalSubmit = () => {
    if (isExternalValid) {
      onSelect({
        url: externalUrl,
        displayText: displayText,
        isExternal: true
      });
    }
  };

  // Handle submission of page link
  const handleSave = (page) => {
    if (isPageValid) {
      // If showAuthor is enabled, add the author information to the page object
      if (showAuthor) {
        // Use the current user's username or default to "Anonymous"
        const authorUsername = user?.username || "Anonymous";
        page.displayText = `${page.title} by ${authorUsername}`;
      }
      onSelect(page);
    }
  };

  const handleClose = () => {
    setShowLinkEditor(false);
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
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[400px] bg-background rounded-xl shadow-xl z-[1000] overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          {/* Header */}
          <div className="p-4 flex items-center justify-between">
            <h2 className="text-base font-medium flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              {isEditing ? 'Edit link' : 'Create link'}
            </h2>
            <button
              onClick={handleClose}
              className="p-1 rounded-full hover:bg-muted transition-colors"
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

          {activeTab === 'page' ? (
            <>
              {/* Display text section */}
              <div className="p-4">
                <div className="overflow-y-auto max-h-[40vh]">
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
                  {/* Show Author Switch - now above the button */}
                  <div className="flex items-center gap-2 mt-4 mb-4">
                    <Switch checked={showAuthor} onCheckedChange={setShowAuthor} id="show-author-switch" />
                    <label htmlFor="show-author-switch" className="text-sm font-medium select-none">Show author</label>
                  </div>
                  <button
                    onClick={() => handleSave({ id: selectedPageId, title: pageTitle })}
                    disabled={!canSave}
                    className="w-full py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isEditing ? 'Save changes' : 'Insert link'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* External link section */}
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

                <button
                  onClick={handleExternalSubmit}
                  disabled={!canSave}
                  className="w-full py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditing ? 'Save changes' : 'Add External Link'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

// Use forwardRef for EditorContent so Editable can receive the ref
const EditorContent = React.forwardRef(({
  editor,
  handleKeyDown,
  renderElement,
  setShowLinkEditor,
  setSelectedLinkElement,
  setSelectedLinkPath
}, editableRef) => {
  const { lineMode } = useLineSettings();
  const [selectedParagraph, setSelectedParagraph] = useState(null);

  // Simplified selection tracking
  useEffect(() => {
    // Only track selection when editor is available
    if (!editor) return;

    const handleSelectionChange = () => {
      try {
        // If no selection, clear the selected paragraph
        if (!editor.selection) {
          setSelectedParagraph(null);
          return;
        }

        // Get the path of the current node
        const nodeEntry = Editor.above(editor, {
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
  }, [editor]);

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
    <motion.div
      className={`p-2 ${getLineModeStyles()} w-full`}
      initial={{ opacity: 1 }} // Start fully visible
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      layout
    >
      <Editable
        ref={editableRef}
        renderElement={renderElementWithStyles}
        renderLeaf={props => <Leaf {...props} />}
        placeholder="Start typing..."
        spellCheck={true}
        autoFocus={false} // Don't auto-focus to avoid stealing focus from title
        onKeyDown={event => {
          console.log("Key pressed in editor:", event.key);
          // Always handle the @ key regardless of focus
          if (event.key === "@") {
            event.preventDefault();
            console.log("@ key pressed in onKeyDown handler");

            // Show the link editor directly
            setShowLinkEditor(true);
            setSelectedLinkElement(null);
            setSelectedLinkPath(null);
            console.log("Link editor shown directly from @ key in onKeyDown");
            return;
          }

          // For other keys, only handle if this element or its children have focus
          if (document.activeElement === editableRef.current ||
              editableRef.current?.contains(document.activeElement)) {
            handleKeyDown(event, editor);
          }
        }}
        className="outline-none min-h-[300px]"
      />
    </motion.div>
  );
});

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
