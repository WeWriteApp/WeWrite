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
import { DataContext } from "../providers/DataProvider";
import { AuthContext } from "../providers/AuthProvider";
import { withHistory } from "slate-history";
import TypeaheadSearch from "./TypeaheadSearch";
import { Search, X, Link as LinkIcon, ExternalLink } from "lucide-react";
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
  const [contentInitialized, setContentInitialized] = useState(false);

  // Initialize editor state with proper error handling
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
        ReactEditor.focus(editor);

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
          Transforms.select(editor, point);
        }
      } catch (error) {
        console.error('Error focusing editor:', error);
      }
    }
  }));

  // Use initialContent as the priority content source if available
  useEffect(() => {
    if (initialContent && !contentInitialized) {
      console.log("SlateEditor received initialContent:", JSON.stringify(initialContent, null, 2));

      try {
        // Use initialContent as the priority source
        console.log("Setting initialValue to:", JSON.stringify(initialContent, null, 2));
        setInitialValue(initialContent);

        // Also notify the parent component if the callback is provided
        if (typeof onContentChange === 'function') {
          console.log("Notifying parent component about initialContent");
          onContentChange(initialContent);
        }

        // Set content as initialized to prevent re-initialization
        setContentInitialized(true);

        // Focus the editor after setting content
        setTimeout(() => {
          try {
            ReactEditor.focus(editor);
          } catch (error) {
            console.error("Error focusing editor after content initialization:", error);
          }
        }, 100);
      } catch (error) {
        console.error("Error setting editor content from initialContent:", error);
      }
    }
  }, [initialContent, onContentChange, contentInitialized, editor]);

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
          onContentChange(newValue);
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

      if (selection) {
        showLinkEditorMenu(editor, selection);
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
          const domSelection = ReactEditor.toDOMRange(editor, editorSelection);
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
    setSelectedLinkElement(element);
    setSelectedLinkPath(path);
    // Pass initial values to the LinkEditor
    setInitialLinkValues({
      text: element.children[0]?.text || "",
      pageId: element.pageId || null,
      pageTitle: element.pageTitle || ""
    });
    setShowLinkEditor(true);
  };

  const handleSelection = (item) => {
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

    switch (element.type) {
      case "link":
        return <LinkComponent {...props} openLinkEditor={openLinkEditor} />;
      case "paragraph":
        const index = props.element.path ? props.element.path[0] : ReactEditor.findPath(editor, element)[0];
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
            <span className="text-sm text-muted-foreground flex items-center justify-end select-none w-6 text-right flex-shrink-0" style={{ transform: 'translateY(0.15rem)' }}>
              {defaultIndex + 1}
            </span>
            <span className="flex-1">{children}</span>
          </p>
        );
    }
  };

  return (
    <LineSettingsProvider>
      <motion.div
        className="relative rounded-lg bg-background"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        <Slate editor={editor} initialValue={initialValue} onChange={onChange}>
          <div className="flex">
            <div className="flex-grow">
              <div className="relative">
                <EditorContent
                  editor={editor}
                  handleKeyDown={handleKeyDown}
                  renderElement={renderElement}
                  editableRef={editableRef}
                />
              </div>
            </div>
          </div>
        </Slate>
      </motion.div>

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
        console.error('Error in fallback insertBreak:', fallbackError);

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
  const isUserLinkType = isUserLink(element.url);
  const isPageLinkType = isPageLink(element.url);
  const isExternalLinkType = isExternalLink(element.url);

  // Determine the appropriate class based on link type
  const linkTypeClass = isUserLinkType ? 'user-link' : isPageLinkType ? 'page-link' : 'external-link';

  const handleClick = (e) => {
    e.preventDefault();
    const path = ReactEditor.findPath(editor, element);
    openLinkEditor(element, path);
  };

  // We'll handle deletion in the editor's main keydown handler instead

  return (
    <a
      {...attributes}
      ref={ref}
      onClick={handleClick}
      contentEditable={false} // Make the link non-editable
      className={`inline-flex items-center my-0.5 px-1.5 py-0.5 text-sm font-medium rounded-[8px] transition-colors duration-200 bg-[#0057FF] text-white border-[1.5px] border-[rgba(255,255,255,0.2)] hover:bg-[#0046CC] hover:border-[rgba(255,255,255,0.3)] shadow-sm cursor-pointer ${linkTypeClass}`}
      data-page-id={isPageLinkType ? element.pageId : undefined}
      data-user-id={isUserLinkType ? element.userId : undefined}
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
  // const [searchActive, setSearchActive] = useState(false);
  const [activeTab, setActiveTab] = useState("page"); // "page" or "external"
  const [selectedPageId, setSelectedPageId] = useState(initialPageId);
  const [externalUrl, setExternalUrl] = useState("");
  // const [isNewPageCreating, setIsNewPageCreating] = useState(false);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Handle cmd+enter to submit the form
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();

        if (activeTab === 'external' && externalUrl) {
          handleExternalSubmit();
        } else if (activeTab === 'page' && selectedPageId) {
          // If a page is already selected, submit it
          const page = { id: selectedPageId, title: pageTitle };
          handleSave(page);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, externalUrl, selectedPageId, pageTitle]);

  // Safely access AuthContext with error handling
  const authContext = useContext(AuthContext);
  // const user = authContext?.user;

  // Add error handling for missing auth context
  useEffect(() => {
    if (!authContext) {
      console.warn("AuthContext is not available in LinkEditor");
    }
  }, [authContext]);

  const handleClose = () => {
    setShowLinkEditor(false);
  };

  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleDisplayTextChange = (e) => {
    setDisplayText(e.target.value);
  };

  const handleExternalUrlChange = (e) => {
    setExternalUrl(e.target.value);
  };

  // Unused but kept for future reference
  // const resetDisplayText = () => {
  //   setDisplayText(pageTitle);
  // };

  const handleSave = (page) => {
    console.log("LinkEditor - handleSave:", page);

    // Handle newly created page
    if (page.id) {
      setSelectedPageId(page.id);
      setPageTitle(page.title); // Save the original page title

      // If display text is empty or not yet set, use the page title
      if (!displayText || displayText === initialText) {
        setDisplayText(page.title);
      }

      const pageLink = {
        ...page,
        url: `/pages/${page.id}`,
        displayText: displayText || page.title
      };

      console.log("Selecting page link:", pageLink);
      onSelect(pageLink);

      // Close the editor if we have a valid page
      handleClose();
    } else {
      console.error("Invalid page data:", page);
    }
  };

  const handleExternalSubmit = () => {
    if (!externalUrl) return;

    let finalUrl = externalUrl;
    // Add https:// if not present and not a relative URL
    if (!finalUrl.startsWith('/') && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    onSelect({
      url: finalUrl,
      displayText: displayText || finalUrl
    });

    handleClose();
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
              Create link
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
                className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'page'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('page')}
              >
                Page
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'external'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveTab('external')}
              >
                Link (external)
              </button>
            </div>
          </div>

          {activeTab === 'page' ? (
            <>
              {/* Display text section */}
              <div className="p-4">
                <div className="overflow-y-auto max-h-[40vh]">
                  <TypeaheadSearch
                    onSelect={(page) => handleSave(page)}
                    placeholder="Search pages..."
                    initialSelectedId={selectedPageId}
                    displayText={displayText}
                    setDisplayText={setDisplayText}
                    onInputChange={(value) => {
                      // If the input looks like a URL, switch to external tab and fill the URL field
                      if (value && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('www.'))) {
                        setActiveTab('external');
                        setExternalUrl(value);
                      }
                    }}
                  />
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
                  disabled={!externalUrl}
                  className="w-full py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add External Link
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

// Custom EditorContent component to apply line mode styles
const EditorContent = ({ editor, handleKeyDown, renderElement, editableRef }) => {
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      layout
    >
      <Editable
        ref={editableRef}
        renderElement={renderElementWithStyles}
        renderLeaf={props => <Leaf {...props} />}
        placeholder="Start typing..."
        spellCheck={true}
        autoFocus
        onKeyDown={event => handleKeyDown(event, editor)}
        className="outline-none min-h-[300px]"
      />
    </motion.div>
  );
};

// Editor toolbar component - unused but kept for reference
// const EditorToolbar = ({ editor }) => {
//   return (
//     <div className="flex items-center p-2 border-b">
//       <ToolbarButton
//         icon={<LinkIcon size={16} />}
//         tooltip="Insert Link"
//         onMouseDown={event => {
//           event.preventDefault();
//           const url = window.prompt('Enter a URL:');
//           if (!url) return;
//           if (!isUrl(url)) return;
//           wrapLink(editor, url);
//         }}
//       />
//     </div>
//   );
// };

// Toolbar button component - unused but kept for reference
// const ToolbarButton = ({ icon, tooltip, onMouseDown }) => {
//   return (
//     <TooltipProvider>
//       <Tooltip>
//         <TooltipTrigger asChild>
//           <button
//             onMouseDown={onMouseDown}
//             className="p-1 rounded-full hover:bg-accent mr-1"
//           >
//             {icon}
//           </button>
//         </TooltipTrigger>
//         <TooltipContent>
//           <p>{tooltip}</p>
//         </TooltipContent>
//       </Tooltip>
//     </TooltipProvider>
//   );
// };

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
