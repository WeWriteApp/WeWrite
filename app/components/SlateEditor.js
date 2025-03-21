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
import { Editable, withReact, useSlate, useSelected, Slate } from "slate-react";
import { ReactEditor } from "slate-react";
import { DataContext } from "../providers/DataProvider";
import { withHistory } from "slate-history";
import TypeaheadSearch from "./TypeaheadSearch";
import { Search, X, Link as LinkIcon, Settings } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useLineSettings, LINE_MODES, LineSettingsProvider } from '../contexts/LineSettingsContext';
import { LineSettingsMenu } from './LineSettingsMenu';
import { motion } from "framer-motion";

const SlateEditor = forwardRef(({ initialEditorState = null, setEditorState }, ref) => {
  const [editor] = useState(() => withInlines(withHistory(withReact(createEditor()))));
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkEditorPosition, setLinkEditorPosition] = useState({});
  const [selectedLinkElement, setSelectedLinkElement] = useState(null);
  const [selectedLinkPath, setSelectedLinkPath] = useState(null);
  const [initialLinkValues, setInitialLinkValues] = useState({}); // New state to store initial link values
  const editableRef = useRef(null);
  const [lineCount, setLineCount] = useState(0);

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

  const [initialValue, setInitialValue] = useState(initialEditorState || [
    {
      type: "paragraph",
      children: [{ text: "" }],
    },
  ]);

  // Set initial value when component mounts or when initialEditorState changes
  useEffect(() => {
    if (initialEditorState) {
      // Filter out consecutive empty paragraphs from initialEditorState
      let filteredContent = [];
      
      if (Array.isArray(initialEditorState)) {
        let lastWasEmptyParagraph = false;
        
        initialEditorState.forEach(node => {
          const isEmptyParagraph = 
            node.type === 'paragraph' && 
            (!node.children || 
             node.children.length === 0 || 
             (node.children.length === 1 && (!node.children[0].text || node.children[0].text.trim() === '')));
          
          // Only add empty paragraphs if the previous node wasn't an empty paragraph
          if (isEmptyParagraph) {
            if (!lastWasEmptyParagraph) {
              filteredContent.push(node);
              lastWasEmptyParagraph = true;
            }
          } else {
            filteredContent.push(node);
            lastWasEmptyParagraph = false;
          }
        });
        
        // Ensure we have at least one paragraph
        if (filteredContent.length === 0) {
          filteredContent = [{
            type: 'paragraph',
            children: [{ text: '' }]
          }];
        }
        
        setInitialValue(filteredContent);
      } else {
        setInitialValue(initialEditorState);
      }
    }
  }, [initialEditorState]);

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
      }
      
      // Fall back to window.getSelection()
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
    
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
            <span className="text-xs text-muted-foreground flex items-center h-6 select-none w-6 text-right flex-shrink-0 px-1.5 py-0.5 rounded-full">
              {index + 1}
            </span>
            <span className="flex-1">{children}</span>
          </p>
        );
      default:
        const defaultIndex = props.element.path ? props.element.path[0] : ReactEditor.findPath(editor, element)[0];
        return (
          <p {...attributes} className="flex items-start gap-3 py-2.5">
            <span className="text-xs text-muted-foreground flex items-center h-6 select-none w-6 text-right flex-shrink-0 px-1.5 py-0.5 rounded-full">
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
        <div className="absolute top-0 right-0 z-10 p-2">
          <LineSettingsMenu />
        </div>
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
  const { insertData, insertText, isInline, isElementReadOnly, isSelectable } =
    editor;

  // make paragraph and link elements inline
  editor.isInline = (element) => {
    return element.type === "link" || isInline(element);
  };

  editor.isElementReadOnly = (element) => {
    return element.type === "link" || isElementReadOnly(element);
  };

  editor.insertText = (text) => {
    if (text && isUrl(text)) {
      wrapLink(editor, text);
    } else {
      insertText(text);
    }
  };

  editor.insertData = (data) => {
    const text = data.getData("text/plain");

    if (text && isUrl(text)) {
      wrapLink(editor, text);
    } else {
      insertData(data);
    }
  };

  return editor;
};

const wrapLink = (editor, url) => {
  if (isLinkActive(editor)) {
    unwrapLink(editor);
  }

  const { selection } = editor;
  const isCollapsed = selection && Range.isCollapsed(selection);
  const link = {
    type: "link",
    url,
    children: isCollapsed ? [{ text: url }] : [],
  };

  if (isCollapsed) {
    Transforms.insertNodes(editor, link);
  } else {
    Transforms.wrapNodes(editor, link, { split: true });
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

  const resetDisplayText = () => {
    setDisplayText(pageTitle);
  };

  const handleSave = (page) => {
    setSelectedPageId(page.id);
    setPageTitle(page.title); // Save the original page title
    
    // If display text is empty or not yet set, use the page title
    if (!displayText) {
      setDisplayText(page.title);
    }
    
    onSelect({
      ...page,
      displayText: displayText || page.title
    });
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
                      onClick={resetDisplayText}
                      className="p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground"
                      title="Reset to page title"
                    >
                      <Settings className="h-3 w-3" />
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
                    placeholder="https://example.com"
                    className="w-full p-2 bg-muted/50 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground text-sm"
                  />
                </div>
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
      case LINE_MODES.SPACED:
        return 'space-y-8';
      case LINE_MODES.WRAPPED:
        return 'space-y-1';
      case LINE_MODES.DEFAULT:
      default:
        return 'space-y-0'; // No spacing between paragraphs
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
      className={`p-4 ${getLineModeStyles()} w-full`}
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
            className="p-1 rounded hover:bg-accent mr-1"
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
