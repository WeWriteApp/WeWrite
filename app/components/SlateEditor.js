import React, { useState, useContext, useRef, forwardRef, useImperativeHandle, useEffect, useCallback } from "react";
import { createEditor, Editor, Transforms, Range, Element as SlateElement, Node, Path } from "slate";
import { Slate, Editable, ReactEditor, withReact, useSelected, useSlate } from "slate-react";
import { withHistory } from "slate-history";
import { AnimatePresence, motion } from "framer-motion";
import { DataContext } from "../providers/DataProvider";
import { AuthContext } from "../providers/AuthProvider";
import { LineSettingsProvider, useLineSettings } from '../contexts/LineSettingsContext';

// Line modes for different types of content
const LINE_MODES = {
  NORMAL: 'normal',
  CODE: 'code',
  QUOTE: 'quote',
  HEADING: 'heading',
};

const SlateEditor = forwardRef(({ initialEditorState = null, initialContent = null, setEditorState, onSave, onDiscard, onInsert }, ref) => {
  const [editor] = useState(() => withInlines(withHistory(withReact(createEditor()))));
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkEditorPosition, setLinkEditorPosition] = useState({});
  const [selectedLinkElement, setSelectedLinkElement] = useState(null);
  const [selectedNodePath, setSelectedNodePath] = useState(null);
  const [contentInitialized, setContentInitialized] = useState(false);

  const editorRef = useRef(null);
  const editableRef = useRef(null);
  const { data } = useContext(DataContext);
  const { user } = useContext(AuthContext);
  const { hasLineSettings } = useLineSettings();

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus() {
      if (!editor || !ReactEditor.isFocused(editor)) {
        setTimeout(() => {
          try {
            ReactEditor.focus(editor);
            Transforms.select(editor, Editor.end(editor, []));
          } catch (error) {
            console.error("Error focusing editor:", error);
          }
        }, 100);
      }
    }
  }));

  // Use initialContent as the priority content source if available
  useEffect(() => {
    if (initialContent && !contentInitialized) {
      try {
        // Parse the initial content to get the editor state
        const content = Array.isArray(initialContent) ? initialContent : JSON.parse(initialContent);
        
        // Set the editor's content and mark it as initialized
        editor.children = content;
        setContentInitialized(true);
        
        // Update the parent component's state if needed
        if (setEditorState) {
          setEditorState(content);
        }
      } catch (error) {
        console.error("Error initializing content:", error, initialContent);
        // Fallback to initialEditorState if initialContent parsing fails
        if (initialEditorState && !contentInitialized) {
          editor.children = initialEditorState;
          setContentInitialized(true);
          if (setEditorState) {
            setEditorState(initialEditorState);
          }
        }
      }
    } else if (initialEditorState && !contentInitialized) {
      // Use initialEditorState if initialContent is not available
      editor.children = initialEditorState;
      setContentInitialized(true);
      if (setEditorState) {
        setEditorState(initialEditorState);
      }
    }
  }, [initialContent, initialEditorState, editor, setEditorState, contentInitialized]);

  const onChange = value => {
    if (setEditorState) {
      setEditorState(value);
    }
  };

  const handleKeyDown = (event, editor) => {
    // If the link editor is shown, close it on escape
    if (event.key === 'Escape' && showLinkEditor) {
      event.preventDefault();
      setShowLinkEditor(false);
      return;
    }

    // Check if we're on a line with special mode settings
    const { selection } = editor;
    if (selection && Range.isCollapsed(selection)) {
      const [lineNode] = Editor.nodes(editor, {
        match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'line',
        at: selection,
      });

      // If we are, handle keys based on line mode
      if (lineNode) {
        const [node, path] = lineNode;
        if (node.mode === LINE_MODES.CODE) {
          if (event.key === 'Tab') {
            event.preventDefault();
            Transforms.insertText(editor, '  ');
            return;
          }
        }

        // Add more line mode specific handlers here if needed
      }
    }

    // Handle keyboard shortcuts
    if (event.key === 'k' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      
      // Get the current selection
      const { selection } = editor;
      
      if (selection && !Range.isCollapsed(selection)) {
        // Show the link editor menu at the selection
        showLinkEditorMenu(editor, selection);
      } else {
        // If no text is selected, place cursor in link editor
        setShowLinkEditor(true);
        const domSelection = window.getSelection();
        if (domSelection.rangeCount > 0) {
          const range = domSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setLinkEditorPosition({
            left: rect.left,
            top: rect.bottom + window.scrollY,
          });
        }
      }
    }
  };

  const renderElement = props => {
    switch (props.element.type) {
      case 'link':
        return <LinkElement {...props} openLinkEditor={openLinkEditor} />;
      case 'line':
        // Apply line-specific styling here
        return <LineElement {...props} />;
      default:
        return <DefaultElement {...props} />;
    }
  };

  const showLinkEditorMenu = (editor, editorSelection) => {
    try {
      // If we already have a selection, we can show the link menu directly
      if (editorSelection) {
        const domRange = ReactEditor.toDOMRange(editor, editorSelection);
        const rect = domRange.getBoundingClientRect();
        setLinkEditorPosition({
          left: rect.left,
          top: rect.bottom + window.scrollY,
        });
        setShowLinkEditor(true);
        return;
      }

      // If we don't have a selection, we need to use the current DOM selection
      const domSelection = window.getSelection();
      if (domSelection && domSelection.rangeCount > 0) {
        const domRange = domSelection.getRangeAt(0);
        const rect = domRange.getBoundingClientRect();
        setLinkEditorPosition({
          left: rect.left,
          top: rect.bottom + window.scrollY,
        });
        setShowLinkEditor(true);
      }
    } catch (error) {
      console.error("Error showing link editor:", error);
    }
  };

  const openLinkEditor = (element, path) => {
    setSelectedLinkElement(element);
    setSelectedNodePath(path);
    const domNode = ReactEditor.toDOMNode(editor, element);
    const rect = domNode.getBoundingClientRect();
    setLinkEditorPosition({
      left: rect.left,
      top: rect.bottom + window.scrollY,
    });
    setShowLinkEditor(true);
  };

  const handleSelection = item => {
    try {
      if (selectedNodePath) {
        // If editing an existing link
        Transforms.setNodes(
          editor,
          { 
            ...item, 
            type: 'link',
            url: item.pageId ? `/page/${item.pageId}` : item.url,
            children: [{ text: item.text }] 
          },
          { at: selectedNodePath }
        );
      } else if (editor.selection) {
        // If creating a new link
        if (isLinkActive(editor)) {
          unwrapLink(editor);
        }
        
        // Insert the link with the selected text or URL
        const text = item.text || (item.pageId ? item.pageTitle : item.url);
        const url = item.pageId ? `/page/${item.pageId}` : item.url;
        
        if (Range.isCollapsed(editor.selection)) {
          // If no text is selected, insert the link text
          Transforms.insertNodes(editor, {
            type: 'link',
            url,
            pageId: item.pageId,
            pageTitle: item.pageTitle,
            children: [{ text }],
          });
        } else {
          // If text is selected, convert it to a link
          wrapLink(editor, url, item.pageId, item.pageTitle);
        }
      }
    } catch (error) {
      console.error("Error handling selection:", error);
    } finally {
      // Clean up
      setShowLinkEditor(false);
      setSelectedLinkElement(null);
      setSelectedNodePath(null);
      ReactEditor.focus(editor);
    }
  };

  return (
    <LineSettingsProvider>
      <motion.div 
        className="relative flex flex-col h-screen bg-background"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex-grow overflow-auto">
          <div 
            className="editor-container h-full pb-20" // Add bottom padding for toolbar
            ref={editorRef}
          >
            <Slate
              editor={editor}
              initialValue={initialEditorState || [{ type: 'line', children: [{ text: '' }] }]}
              onChange={onChange}
            >
              <EditorContent 
                editor={editor} 
                handleKeyDown={handleKeyDown} 
                renderElement={renderElement}
                editableRef={editableRef}
              />
              {showLinkEditor && (
                <LinkEditor
                  position={linkEditorPosition}
                  onSelect={handleSelection}
                  setShowLinkEditor={setShowLinkEditor}
                  initialText={selectedLinkElement?.children[0]?.text || ''}
                  initialPageId={selectedLinkElement?.pageId}
                  initialPageTitle={selectedLinkElement?.pageTitle}
                />
              )}
            </Slate>
          </div>
        </div>
        
        {/* Fixed toolbar at the bottom */}
        <FloatingToolbar 
          editor={editor} 
          onInsert={onInsert} 
          onDiscard={onDiscard} 
          onSave={onSave} 
        />
      </motion.div>
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

const wrapLink = (editor, url, pageId, pageTitle) => {
  if (isLinkActive(editor)) {
    unwrapLink(editor);
  }

  const { selection } = editor;
  const isCollapsed = selection && Range.isCollapsed(selection);
  const linkElement = {
    type: "link",
    url,
    pageId,
    pageTitle,
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

// Wraps component with forward ref to fix refs with function components
const InlineChromiumBugfix = forwardRef((props, ref) => (
  <span
    ref={ref}
    {...props}
    style={{
      // Prevent the problem where Chrome will collapse adjacent
      // inline elements into a single inline element
      paddingLeft: '0.1px',
    }}
  />
));

// Link element component
const LinkElement = ({ attributes, children, element, openLinkEditor }) => {
  const { url } = element;
  const editor = useSlate();
  
  const handleClick = (e) => {
    if (e.ctrlKey || e.metaKey) {
      // Allow default behavior (open link) when Ctrl/Cmd is pressed
      return;
    }
    
    e.preventDefault();
    openLinkEditor(element, ReactEditor.findPath(editor, element));
  };
  
  return (
    <a
      {...attributes}
      href={url}
      className="text-blue-500 hover:text-blue-600 underline"
      onClick={handleClick}
    >
      <InlineChromiumBugfix>{children}</InlineChromiumBugfix>
    </a>
  );
};

// Line element component with optional mode styling
const LineElement = ({ attributes, children, element }) => {
  const lineNumber = ReactEditor.findPath(useSlate(), element)[0] + 1;
  
  // Apply different styling based on line mode
  const getLineStyles = () => {
    if (element.mode === LINE_MODES.CODE) {
      return "font-mono text-amber-400 bg-gray-900/50";
    }
    return "";
  };
  
  return (
    <div 
      {...attributes} 
      className={`flex items-start py-1 ${getLineStyles()}`}
    >
      <span className="text-sm text-gray-500 w-6 mr-2 text-right flex-shrink-0 select-none">
        {lineNumber}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  );
};

// Default element component
const DefaultElement = ({ attributes, children }) => {
  return (
    <div {...attributes} className="py-1">
      {children}
    </div>
  );
};

// Check if the current selection has a link
const isLinkActive = (editor) => {
  const [link] = Editor.nodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === "link",
  });
  return !!link;
};

// Simple LinkEditor component
const LinkEditor = ({ position, onSelect, setShowLinkEditor, initialText = '', initialPageId = null, initialPageTitle = '' }) => {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState('');
  const inputRef = useRef(null);
  
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!url && !text) {
      setShowLinkEditor(false);
      return;
    }
    
    onSelect({
      text: text || url,
      url: url,
      pageId: initialPageId,
      pageTitle: initialPageTitle
    });
  };
  
  return (
    <div 
      className="absolute z-[1000] bg-gray-900 border border-gray-700 rounded-md shadow-lg p-3 w-64"
      style={{
        top: position.top + 'px',
        left: position.left + 'px',
      }}
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Link text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
          />
        </div>
        <div className="mb-3">
          <input
            type="text"
            placeholder="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={() => setShowLinkEditor(false)}
            className="px-3 py-1 bg-gray-800 text-white text-sm rounded hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-500"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

// Floating toolbar that positions itself above the keyboard
const FloatingToolbar = ({ editor, onInsert, onDiscard, onSave }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const toolbarRef = useRef(null);
  
  // Detect mobile device
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkMobile = () => setIsMobile(window.innerWidth <= 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, []);
  
  // Measure toolbar height
  useEffect(() => {
    if (toolbarRef.current) {
      setToolbarHeight(toolbarRef.current.offsetHeight);
    }
  }, []);
  
  // Use visualViewport to detect keyboard and position toolbar
  useEffect(() => {
    if (!isMobile || typeof window === 'undefined' || !window.visualViewport) return;
    
    const handleViewportResize = () => {
      if (!window.visualViewport) return;
      
      const windowHeight = window.innerHeight;
      const viewportHeight = window.visualViewport.height;
      
      // If viewport is significantly smaller than window height, keyboard is likely visible
      if (viewportHeight < windowHeight * 0.75) {
        const newKeyboardHeight = windowHeight - viewportHeight;
        setKeyboardHeight(newKeyboardHeight);
      } else {
        setKeyboardHeight(0);
      }
    };
    
    window.visualViewport.addEventListener('resize', handleViewportResize);
    window.visualViewport.addEventListener('scroll', handleViewportResize);
    
    // Initial check
    handleViewportResize();
    
    return () => {
      if (!window.visualViewport) return;
      window.visualViewport.removeEventListener('resize', handleViewportResize);
      window.visualViewport.removeEventListener('scroll', handleViewportResize);
    };
  }, [isMobile]);
  
  // Handle save
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
  
  // Calculate toolbar position style
  const getToolbarStyle = () => {
    if (keyboardHeight > 0) {
      return {
        position: 'fixed',
        bottom: `${keyboardHeight}px`,
        left: 0,
        right: 0,
        zIndex: 99999
      };
    }
    
    return {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 99999
    };
  };
  
  return (
    <div 
      ref={toolbarRef}
      style={getToolbarStyle()}
      className="bg-gray-900 border-t border-gray-800 py-2"
    >
      <div className="flex justify-center items-center py-2 px-1">
        <button
          type="button"
          onClick={onInsert}
          className="flex items-center justify-center py-3 px-5 text-white/90 hover:bg-white/5 rounded-full"
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
        
        <button
          type="button"
          onClick={onDiscard}
          className="flex items-center justify-center py-3 px-5 text-white/90 hover:bg-white/5 rounded-full"
        >
          <span className="flex items-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Discard
          </span>
        </button>
        
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="flex items-center justify-center py-3 px-6 bg-[#1a73e8] hover:bg-[#1a73e8]/90 text-white rounded-full mx-1"
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

// Custom EditorContent component to apply line mode styles
const EditorContent = ({ editor, handleKeyDown, renderElement, editableRef }) => {
  // Set up custom handling for leaf rendering
  const renderLeaf = useCallback(props => <Leaf {...props} />, []);
  
  return (
    <Editable
      ref={editableRef}
      renderElement={renderElement}
      renderLeaf={renderLeaf}
      placeholder="Write something..."
      spellCheck={false}
      autoFocus
      onKeyDown={e => handleKeyDown(e, editor)}
      className="outline-none py-4 px-4 min-h-full"
    />
  );
};

// Custom Leaf component for text formatting
const Leaf = ({ attributes, children, leaf }) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>;
  }
  if (leaf.italic) {
    children = <em>{children}</em>;
  }
  if (leaf.underline) {
    children = <u>{children}</u>;
  }
  if (leaf.code) {
    children = <code className="bg-gray-800 rounded px-1 py-0.5 text-amber-400 font-mono text-sm">{children}</code>;
  }
  return <span {...attributes}>{children}</span>;
};

export default SlateEditor;
