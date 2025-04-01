import React, { useState, useContext, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  createEditor,
  Transforms,
  Editor,
  Element as SlateElement,
  Path,
  Range,
  Node,
} from "slate";
import { Editable, withReact, useSlate, useSelected, Slate } from "slate-react";
import { ReactEditor } from "slate-react";
import { DataContext } from "../providers/DataProvider";
import { AuthContext } from "../providers/AuthProvider";
import { withHistory } from "slate-history";
import TypeaheadSearch from "./TypeaheadSearch";
import { Search, X, Link as LinkIcon, Save, FileSignature } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useLineSettings, LINE_MODES, LineSettingsProvider } from '../contexts/LineSettingsContext';
import { motion, AnimatePresence, createPortal } from "framer-motion";
import "../styles/shake-animation.css";

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
 * @param {Function} setEditorState - Function to update the parent component's state with editor changes
 * @param {Function} onSave - Function to handle save functionality
 * @param {Function} onDiscard - Function to handle discard functionality
 * @param {Function} onInsert - Function to handle insert functionality
 * @param {Ref} ref - Reference to access editor methods from parent components
 */
const SlateEditor = forwardRef(({ initialEditorState = null, initialContent = null, setEditorState, onSave, onDiscard, onInsert }, ref) => {
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
        
        // Also set the editor state if the callback is provided
        if (setEditorState) {
          console.log("Setting editorState from initialContent");
          setEditorState(initialContent);
          
          // Force update the editor with the initialContent
          editor.children = initialContent;
          editor.onChange();
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
  }, [initialContent, setEditorState, contentInitialized, editor]);

  // Make sure initialValue is properly set from initialContent
  useEffect(() => {
    if (initialContent && initialValue.length === 1 && initialValue[0].children[0].text === "") {
      console.log("Setting initialValue from initialContent in secondary effect");
      setInitialValue(initialContent);
    }
  }, [initialContent, initialValue]);

  // onchange handler
  const onChange = (newValue) => {
    setEditorState(newValue);
    setLineCount(newValue.length);
  };

  const handleKeyDown = (event, editor) => {
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

    // Regular enter should create a newline, but prevent consecutive empty paragraphs
    if (event.key === 'Enter') {
      const { selection } = editor;
      
      if (selection && Range.isCollapsed(selection)) {
        const [node, path] = Editor.node(editor, selection);
        const [parent] = Editor.parent(editor, path);
        
        // Check if current node is in a paragraph and is empty or only contains whitespace
        const isEmptyParagraph = 
          SlateElement.isElement(parent) && 
          parent.type === 'paragraph' && 
          Node.string(parent).trim() === '';
        
        // Check if previous node is also an empty paragraph
        let prevNodeIsEmpty = false;
        
        if (path[0] > 0) {
          const prevPath = [path[0] - 1];
          
          try {
            const [prevNode] = Editor.node(editor, prevPath);
            
            if (SlateElement.isElement(prevNode) && 
                prevNode.type === 'paragraph' && 
                Node.string(prevNode).trim() === '') {
              prevNodeIsEmpty = true;
            }
          } catch (e) {
            // Path might not exist, ignore
          }
        }
        
        // If current paragraph is empty and previous paragraph is also empty, prevent new line
        if (isEmptyParagraph && prevNodeIsEmpty) {
          event.preventDefault();
          return;
        }
      }
      
      // Allow default behavior which creates a newline
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
    if (selectedLinkElement && selectedLinkPath) {
      // Edit existing link
      Transforms.setNodes(
        editor,
        { 
          url: `/pages/${item.id}`,
          children: [{ text: item.displayText || item.title }],
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
        children: [{ text: item.displayText || item.title }],
        pageId: item.id,
        pageTitle: item.title // Store the original page title for reference
      };
      Transforms.insertNodes(editor, link, { at: editor.selection });
      // after insert -- move the cursor to the end of the link
      Transforms.collapse(editor, { edge: "end" });

      // position the cursor at the end of the new link
      Transforms.select(editor, Editor.end(editor, []));

      // insert a space after the link
      Transforms.insertText(editor, ' ');
    }

    ReactEditor.focus(editor);

    // hide the dropdown
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
      <AnimatePresence>
        {onSave && onDiscard && onInsert && <FloatingToolbar editor={editor} onInsert={onInsert} onDiscard={onDiscard} onSave={onSave} />}
      </AnimatePresence>
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
  const { insertData, insertText, isInline, normalizeNode } = editor

  editor.isInline = element => {
    return ['link'].includes(element.type) || isInline(element)
  }

  editor.insertText = text => {
    if (text && isUrl(text)) {
      wrapLink(editor, text)
    } else {
      insertText(text)
    }
  }

  editor.insertData = data => {
    const text = data.getData('text/plain')
    if (text && isUrl(text)) {
      wrapLink(editor, text)
    } else {
      insertData(data)
    }
  }

  // Add custom normalizer to ensure links have valid url properties
  editor.normalizeNode = entry => {
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
  }

  return editor
}

const wrapLink = (editor, url) => {
  if (isLinkActive(editor)) {
    unwrapLink(editor);
  }

  const { selection } = editor;
  const isCollapsed = selection && Range.isCollapsed(selection);
  const linkElement = {
    type: "link",
    url,
    children: isCollapsed ? [{ text: url }] : [],
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
const InlineChromiumBugfix = forwardRef((props, ref) => (
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
  const selected = useSelected();
  const editor = useSlate();
  
  const handleClick = (e) => {
    e.preventDefault();
    const path = ReactEditor.findPath(editor, element);
    openLinkEditor(element, path);
  };
  
  return (
    <a
      {...attributes}
      ref={ref}
      onClick={handleClick}
      className="inline-flex items-center my-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-[8px] transition-colors duration-200 bg-[#0057FF] text-white border-[1.5px] border-[rgba(255,255,255,0.2)] hover:bg-[#0046CC] hover:border-[rgba(255,255,255,0.3)] shadow-sm cursor-pointer"
    >
      <InlineChromiumBugfix />
      <div className="flex items-center gap-0.5 min-w-0">
        {children}
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

const LinkEditor = ({ position, onSelect, setShowLinkEditor, initialText = "", initialPageId = null, initialPageTitle = "" }) => {
  const [displayText, setDisplayText] = useState(initialText);
  const [pageTitle, setPageTitle] = useState(initialPageTitle); // Store the original page title
  const [searchActive, setSearchActive] = useState(false);
  const [activeTab, setActiveTab] = useState("page"); // "page" or "external"
  const [selectedPageId, setSelectedPageId] = useState(initialPageId);
  const [externalUrl, setExternalUrl] = useState("");
  const [isNewPageCreating, setIsNewPageCreating] = useState(false);
  
  // Safely access AuthContext with error handling
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  
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

  const resetDisplayText = () => {
    setDisplayText(pageTitle);
  };

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
                <h2 className="text-sm font-medium mb-2">Page</h2>
                <div className="overflow-y-auto max-h-[40vh]">
                  <TypeaheadSearch 
                    onSelect={(page) => handleSave(page)}
                    placeholder="Search pages..."
                    onFocus={() => setSearchActive(true)}
                    radioSelection={true}
                    selectedId={selectedPageId}
                  />
                </div>
              </div>
              
              {/* Display text input */}
              {selectedPageId && (
                <div className="px-4 pb-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium">Display Text</h2>
                    <button 
                      type="button"
                      onClick={() => {
                        setLinkText(initialText || "");
                      }}
                      className="p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground"
                      title="Reset to page title"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={displayText}
                    onChange={handleDisplayTextChange}
                    placeholder="Display text (defaults to page title)"
                    className="w-full p-2 bg-muted/50 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground text-sm"
                  />
                </div>
              )}
              
              {/* Link destination section - Radio buttons for pages */}
              <div className="px-4 pb-4 space-y-2">
                <h2 className="text-sm font-medium mb-2">Link to a page</h2>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {/* Pages are now displayed by TypeaheadSearch with radio buttons */}
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
  
  // Track the selected paragraph
  useEffect(() => {
    const handleSelectionChange = () => {
      try {
        // Get the current selection
        const { selection } = editor;
        if (selection && !Range.isCollapsed(selection)) {
          // Get the parent node at the current selection
          const [node, path] = Editor.parent(editor, selection.focus.path);
          setSelectedParagraph(path[0]); // The first element of the path is the paragraph index
        } else if (selection && Range.isCollapsed(selection)) {
          // For cursor position (collapsed selection)
          const [node, path] = Editor.parent(editor, selection.focus.path);
          setSelectedParagraph(path[0]);
        } else {
          // No selection
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
    const { element, children, attributes } = props;
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

// Editor toolbar component
const EditorToolbar = ({ editor }) => {
  return (
    <div className="flex items-center p-2 border-b">
      <ToolbarButton
        icon={<LinkIcon size={16} />}
        tooltip="Insert Link"
        onMouseDown={event => {
          event.preventDefault();
          const url = window.prompt('Enter a URL:');
          if (!url) return;
          if (!isUrl(url)) return;
          wrapLink(editor, url);
        }}
      />
    </div>
  );
};

// Toolbar button component
const ToolbarButton = ({ icon, tooltip, onMouseDown }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onMouseDown={onMouseDown}
            className="p-1 rounded-full hover:bg-accent mr-1"
          >
            {icon}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Editor toolbar that floats at the bottom of the screen for all devices
const FloatingToolbar = ({ editor, onInsert, onDiscard, onSave }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [toolbarStyle, setToolbarStyle] = useState({});
  const [mounted, setMounted] = useState(false);
  
  // Handle SSR
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  
  // Detect mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Update toolbar style - this is the main positioning logic
  useEffect(() => {
    // Different styles for mobile and desktop
    if (isMobile) {
      setToolbarStyle({
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        padding: 0,
        margin: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(128, 128, 128, 0.3)'
      });
    } else {
      setToolbarStyle({
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        borderRadius: '9999px',
        margin: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(128, 128, 128, 0.3)'
      });
    }
  }, [isMobile]);
  
  // Handle keyboard visibility
  useEffect(() => {
    if (!isMobile || typeof window === 'undefined' || !window.visualViewport) return;
    
    const handleViewportResize = () => {
      const windowHeight = window.innerHeight;
      const viewportHeight = window.visualViewport.height;
      const isKeyboardVisible = viewportHeight < windowHeight * 0.8;
      
      setKeyboardVisible(isKeyboardVisible);
      
      // Update bottom position when keyboard is visible
      if (isKeyboardVisible) {
        const keyboardHeight = windowHeight - viewportHeight;
        setToolbarStyle(current => ({
          ...current,
          bottom: `${keyboardHeight}px`
        }));
      } else {
        setToolbarStyle(current => ({
          ...current,
          bottom: 0
        }));
      }
    };
    
    // Initial setup
    handleViewportResize();
    
    // Listen for viewport changes (keyboard appearing/disappearing)
    window.visualViewport.addEventListener('resize', handleViewportResize);
    
    return () => {
      window.visualViewport.removeEventListener('resize', handleViewportResize);
    };
  }, [isMobile]);
  
  // Handle save button click
  const handleSave = async () => {
    if (!onSave) return;
    
    setIsSaving(true);
    try {
      await onSave();
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Don't render on server
  if (!mounted) return null;
  
  return (
    <div style={toolbarStyle}>
      <div 
        className="flex items-center justify-center py-2"
        style={{
          padding: isMobile ? '8px 0' : '4px 2px',
        }}
      >
        {/* Insert button */}
        <button
          type="button"
          onClick={onInsert}
          className="flex items-center justify-center py-3 px-5 text-white/90 hover:bg-white/5 rounded-full focus:outline-none transition-colors"
        >
          <span className="flex items-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
              <path d="M19 16V5C19 3.89543 18.1046 3 17 3H7C5.89543 3 5 3.89543 5 5V19C5 20.1046 5.89543 21 7 21H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 7H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 11H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 15H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Insert
          </span>
        </button>
        
        {/* Discard button */}
        <button
          type="button"
          onClick={onDiscard}
          className="flex items-center justify-center py-3 px-5 text-white/90 hover:bg-white/5 rounded-full focus:outline-none transition-colors"
        >
          <span className="flex items-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Discard
          </span>
        </button>
        
        {/* Save button */}
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="flex items-center justify-center py-3 px-6 bg-[#1a73e8] hover:bg-[#1a73e8]/90 text-white rounded-full focus:outline-none transition-colors mx-1"
        >
          {isSaving ? (
            <span className="flex items-center">
              <span className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            <span className="flex items-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                <path d="M5 12L10 17L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Save
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

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
