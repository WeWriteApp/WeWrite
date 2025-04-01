import React, { useState, useContext, useRef, forwardRef, useImperativeHandle, useEffect, useCallback, useMemo } from "react";
import { createEditor, Editor, Transforms, Range, Point, Path, Element as SlateElement, Node } from "slate";
import { Slate, Editable, ReactEditor, withReact, useSelected, useSlate, useSlateStatic, useReadOnly } from "slate-react";
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

const SlateEditor = forwardRef(({ initialContent, onContentChange, onInsert, onDiscard, onSave }, ref) => {
  const { lineSettings } = useLineSettings();
  const initialEditorState = useMemo(() => deserialize(initialContent), [initialContent]);
  const editor = useMemo(() => withLinks(withReact(createEditor())), []); // Removed withLineNumbers wrapper
  const [linkEditorPosition, setLinkEditorPosition] = useState(null);
  const [showLinkEditor, setShowLinkEditor] = useState(false);
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
        if (onContentChange) {
          onContentChange(content);
        }
      } catch (error) {
        console.error("Error initializing content:", error, initialContent);
        // Fallback to initialEditorState if initialContent parsing fails
        if (initialEditorState && !contentInitialized) {
          editor.children = initialEditorState;
          setContentInitialized(true);
          if (onContentChange) {
            onContentChange(initialEditorState);
          }
        }
      }
    } else if (initialEditorState && !contentInitialized) {
      // Use initialEditorState if initialContent is not available
      editor.children = initialEditorState;
      setContentInitialized(true);
      if (onContentChange) {
        onContentChange(initialEditorState);
      }
    }
  }, [initialContent, initialEditorState, editor, onContentChange, contentInitialized]);

  const onChange = value => {
    if (onContentChange) {
      onContentChange(value);
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

  // Render Elements with Line Numbers
  const renderElement = useCallback(({ attributes, children, element }) => {
    switch (element.type) {
      case 'link':
        return (
          <a {...attributes} href={element.url || '#'} data-page-id={element.pageId} data-page-title={element.pageTitle} className="editor-link">
            {children}
          </a>
        );
      case 'line':
        // Explicitly handle 'line' type for line numbers
        try {
          const path = ReactEditor.findPath(editor, element);
          const lineNumber = path[0] + 1; // 1-based indexing
          
          // Basic check for valid path
          if (!path || path.length === 0) {
            console.warn("Invalid path found for element:", element);
            // Render without line number if path is invalid
            return <div {...attributes} style={{ position: 'relative', paddingLeft: '40px' }}>{children}</div>;
          }
          
          return (
            <div {...attributes} style={{ position: 'relative', paddingLeft: '40px' }}>
              <span
                contentEditable={false}
                style={{
                  position: 'absolute',
                  left: '0',
                  top: '0',
                  width: '30px',
                  textAlign: 'right',
                  color: '#aaa',
                  fontSize: '0.9em',
                  userSelect: 'none',
                  paddingRight: '10px',
                }}
              >
                {lineNumber}
              </span>
              {children}
            </div>
          );
        } catch (e) {
           // Handle cases where path might not be found temporarily during intense ops
           console.warn("Could not find path for element", element, e);
           // Render a simple div for unknown types or errors
           return <div {...attributes}>{children}</div>;
        }
      default:
        // Handle any other element types or default case
        return <div {...attributes}>{children}</div>;
    }
  }, [editor]);

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
      <div className="editor-container" 
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'relative',
          // Removed overflow: hidden which can interfere with fixed children
        }}
      >
        <div className="editor-content" 
          style={{
            flex: '1 1 auto',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: '70px', // Keep space for the toolbar
            position: 'relative' // Needed for absolute positioned line numbers
          }}
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
        
        {/* Keyboard-aware toolbar */}
        <KeyboardAwareToolbar 
          onInsert={onInsert} 
          onDiscard={onDiscard} 
          onSave={onSave} 
        />
      </div>
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

const withLinks = (editor) => {
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

// Keyboard-aware toolbar that stays above the keyboard
const KeyboardAwareToolbar = ({ onInsert, onDiscard, onSave }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const toolbarRef = useRef(null);
  
  // Use iOS-specific technique to detect keyboard and adjust position
  useEffect(() => {
    // Only run on mobile browsers
    if (typeof window === 'undefined' || window.innerWidth > 768) return;
    
    // Add viewport meta tag to prevent zooming and ensure proper keyboard handling
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    document.getElementsByTagName('head')[0].appendChild(meta);
    
    // Focus on input to trigger keyboard
    const triggerKeyboard = () => {
      const inputs = document.querySelectorAll('input, [contenteditable="true"]');
      if (inputs.length > 0) {
        inputs[0].focus();
      }
    };
    
    // Listen for viewport changes (iOS specific)
    const detectKeyboard = () => {
      // visualViewport is the most reliable source for the visible area
      if (!window.visualViewport) {
        setKeyboardHeight(0); // Fallback if visualViewport is not supported
        return;
      }
      
      const windowHeight = window.innerHeight; // Height of the layout viewport
      const viewportHeight = window.visualViewport.height;
      
      console.log(`detectKeyboard: windowH=${windowHeight.toFixed(0)}, visualH=${viewportHeight.toFixed(0)}, keyboardH=${keyboardHeight.toFixed(0)}`);
      
      // Compare visual viewport height with the initial window height to detect keyboard
      // Using a threshold helps avoid minor fluctuations
      const isKeyboardVisible = viewportHeight < windowHeight - 70; // Assume keyboard is at least 70px
      
      if (isKeyboardVisible) {
        const keyboardHeight = Math.max(0, windowHeight - viewportHeight);
        setKeyboardHeight(keyboardHeight);
      } else {
        setKeyboardHeight(0);
      }
    };
    
    // Only listen to resize events for keyboard height changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', detectKeyboard);
      // No need to listen to scroll, as fixed position handles it
    }
    
    // Initial detection
    detectKeyboard();
    
    return () => {
      // Cleanup
      document.head.removeChild(meta);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', detectKeyboard);
      }
    };
  }, []);
  
  // Handle save button
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
  
  // Get styles to position above keyboard
  const getToolbarStyle = () => {
    const baseStyle = {
      position: 'fixed',
      left: 0,
      right: 0,
      backgroundColor: '#f8f9fa',
      borderTop: '1px solid #e1e4e8',
      padding: '8px 10px', // Slightly adjusted padding
      zIndex: 10000,
      display: 'flex',
      justifyContent: 'center',
      boxSizing: 'border-box', // Ensure padding is included in width
      WebkitTransform: 'translateZ(0)', // Force hardware acceleration
      transform: 'translateZ(0)'
    };
    
    // Position above keyboard when it's visible
    if (keyboardHeight > 0) {
      return {
        ...baseStyle,
        bottom: `${keyboardHeight}px`,
        transition: 'bottom 0.15s ease-out', // Faster transition
        willChange: 'bottom' // Hint for performance
      };
    }
    
    // Default position at bottom
    return {
      ...baseStyle,
      bottom: 0
    };
  };
  
  return (
    <div 
      ref={toolbarRef}
      style={getToolbarStyle()}
    >
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={onInsert}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '20px',
            background: '#f1f3f5',
            color: '#333',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
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
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '20px',
            background: '#f1f3f5',
            color: '#333',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Discard
          </span>
        </button>
        
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '20px',
            background: '#1a73e8',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          {isSaving ? (
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span
                style={{ 
                  width: '16px', 
                  height: '16px', 
                  marginRight: '8px',
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              />
              Saving...
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
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
