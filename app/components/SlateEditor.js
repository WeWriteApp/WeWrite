import React, { useState, useContext, useRef, forwardRef, useImperativeHandle, useEffect, useCallback, useMemo } from "react";
import { createEditor, Editor, Transforms, Range, Point, Path, Element as SlateElement, Node } from "slate";
import { Slate, Editable, ReactEditor, withReact, useSelected, useSlate, useSlateStatic, useReadOnly } from "slate-react";
import { withHistory } from "slate-history";
import { AnimatePresence, motion } from "framer-motion";
import { DataContext } from "../providers/DataProvider";
import { AuthContext } from "../providers/AuthProvider";
import { LineSettingsProvider, useLineSettings } from '../contexts/LineSettingsContext';

// Helper function to deserialize content
const deserialize = (content) => {
  if (!content) {
    // Return a default value if content is null or undefined
    return [{ type: 'line', children: [{ text: '' }] }];
  }
  if (typeof content === 'string') {
    try {
      // Try parsing if it's a JSON string
      const parsed = JSON.parse(content);
      // Basic validation if it looks like Slate structure
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type && parsed[0].children) {
        return parsed;
      }
    } catch (e) {
      // If parsing fails or it's not valid structure, treat as plain text
      console.warn("Failed to parse initialContent JSON, treating as plain text:", content, e);
      return [{ type: 'line', children: [{ text: content }] }];
    }
  }
  // If it's already an object/array (assumed Slate structure)
  if (Array.isArray(content) && content.length > 0) {
      return content;
  }
  // Fallback for unexpected formats
  console.warn("Unexpected initialContent format, using default:", content);
  return [{ type: 'line', children: [{ text: '' }] }];
};

// Line modes for different types of content
const LINE_MODES = {
  NORMAL: 'normal',
  CODE: 'code',
  QUOTE: 'quote',
  HEADING: 'heading',
};

const SlateEditor = forwardRef(({ initialContent, onContentChange, onInsert, onDiscard, onSave }, ref) => {
  const { lineSettings } = useLineSettings();
  
  // Log initialContent and deserialized result
  console.log("SlateEditor received initialContent:", initialContent);
  const deserializedValue = useMemo(() => {
    const result = deserialize(initialContent);
    console.log("Deserialized initialContent:", JSON.stringify(result));
    return result;
  }, [initialContent]);
  
  const editor = useMemo(() => withLinks(withReact(createEditor())), []); // Removed withLineNumbers wrapper
  const [linkEditorPosition, setLinkEditorPosition] = useState(null);
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [selectedLinkElement, setSelectedLinkElement] = useState(null);
  const [selectedNodePath, setSelectedNodePath] = useState(null);

  // Use local state for editor value, initialized from the prop
  const [value, setValue] = useState(deserializedValue);

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

  // Sync internal state (`value`) with external prop (`initialContent` -> `deserializedValue`)
  useEffect(() => {
    // Only update if the incoming deserialized prop value is different
    // from the current internal state. Avoids loops and unnecessary updates.
    // Basic string comparison; consider deep equality for complex cases if needed.
    if (JSON.stringify(deserializedValue) !== JSON.stringify(value)) {
      console.log("External initialContent prop changed, updating internal editor value.");
      setValue(deserializedValue); // Update internal state
      // Notify parent immediately about the externally triggered change
      if (onContentChange) {
        onContentChange(deserializedValue);
      }
    }
  // Run this effect when the source prop (via deserializedValue) changes.
  }, [deserializedValue]); // Removed dependencies like `value` and `onContentChange` to prevent loops

  const onChange = value => {
    setValue(value); // Update internal state first
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

  // Log state right before rendering Slate component
  console.log('[SlateEditor Render] Editor instance:', editor);
  console.log('[SlateEditor Render] Value state for initialValue:', JSON.stringify(value));

  // Render Elements with Line Numbers
  const renderElement = useCallback((props) => {
    const { attributes, children, element } = props;
    try {
      switch (element.type) {
        case 'link':
          return (
            <a {...attributes} href={element.url || '#'} data-page-id={element.pageId} data-page-title={element.pageTitle} className="editor-link">
              {children}
            </a>
          );
        case 'line':
          // Explicitly handle 'line' type for line numbers
          let path, lineNumber, showLineNumbers = false;
          if (editor) {
            try {
              path = ReactEditor.findPath(editor, element);
              if (path && path.length > 0) {
                lineNumber = path[0] + 1; // 1-based indexing
                showLineNumbers = lineSettings[lineNumber] !== undefined ? lineSettings[lineNumber] : hasLineSettings;
              } else {
                console.warn("Invalid path found for element:", element);
              }
            } catch (pathError) {
              console.error("Error finding path for line element:", pathError, element);
            }
          } else {
             console.warn("Editor instance not available for path finding.");
          }

          return (
            <div {...attributes} style={{ position: 'relative', paddingLeft: showLineNumbers ? '40px' : '0px' }}>
              {showLineNumbers && lineNumber && (
                <span
                  contentEditable={false}
                  className="line-number"
                  style={{
                    position: 'absolute',
                    left: '0',
                    userSelect: 'none',
                    opacity: 0.5,
                  }}
                >
                  {lineNumber}
                </span>
              )}
              {children}
            </div>
          );
        default:
          // Use paragraph as a safe default
          return <p {...attributes}>{children}</p>;
      }
    } catch (error) {
      console.error("Error rendering element:", error, "Element:", JSON.stringify(element));
      // Fallback rendering on error
      return <div {...attributes} style={{ backgroundColor: 'rgba(255,0,0,0.1)', border: '1px solid red', padding: '2px' }}>Error rendering node. {children}</div>;
    }
  }, [editor, lineSettings, hasLineSettings]); // Added editor dependency

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
    // No need for extra provider here if EditPage already has one
    <Slate editor={editor} initialValue={value} onChange={onChange}>
      {/* Conditionally render LinkEditor */}
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
      {/* Custom EditorContent */}
      <EditorContent 
        editor={editor} 
        handleKeyDown={handleKeyDown} 
        renderElement={renderElement} 
        editableRef={editableRef} 
      /> 
      {/* Floating Toolbar */}
      <KeyboardAwareToolbar 
        onInsert={onInsert} 
        onDiscard={onDiscard} 
        onSave={onSave} 
      />
    </Slate>
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
  if (!editor || !editor.selection) return false;
  try {
    const [link] = Editor.nodes(editor, {
      match: (n) =>
        !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'link',
    });
    return !!link;
  } catch (error) {
    console.error("Error checking if link is active:", error);
    return false;
  }
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
  const editor = useSlateStatic();
  const [toolbarPosition, setToolbarPosition] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false); // Basic state, might need refinement
  const toolbarRef = useRef(null);
  const saveButtonRef = useRef(null); // Ref for the save button
  const { user } = useContext(AuthContext); // Get user context


  // Effect to show/hide toolbar based on selection and focus
  useLayoutEffect(() => {
    const { selection } = editor;
    const editableElement = document.querySelector('[data-slate-editor="true"]'); // Find the editable area

    if (
      !selection ||
      !ReactEditor.isFocused(editor) ||
      Range.isCollapsed(selection) ||
      Editor.string(editor, selection) === ''
    ) {
      // Hide toolbar if no selection, not focused, selection collapsed, or selection is empty
      // setToolbarPosition(null); // Keep toolbar visible but maybe disabled/differently styled? Let's try keeping it.
      return;
    }

    const domSelection = window.getSelection();
    if (domSelection.rangeCount === 0) {
      // setToolbarPosition(null); // Keep toolbar visible
      return;
    }

    const domRange = domSelection.getRangeAt(0);
    const rect = domRange.getBoundingClientRect();

    // --- Logging added ---
    const scrollY = window.scrollY || window.pageYOffset;
    console.log("Toolbar positioning: rect=", rect, "scrollY=", scrollY); 
    // --- End Logging ---


    if (rect.width === 0 && rect.height === 0) {
        // Avoid positioning based on invalid rect
        return;
    }

    // Position toolbar above the selection
    // Add scrollY to account for page scrolling when using fixed positioning
    const calculatedTop = rect.top + scrollY - (toolbarRef.current?.offsetHeight || 50) - 8; // Position above selection
    const calculatedLeft = rect.left + scrollY; // Use scrollY for left too if needed, depends on layout

    // Check if positioning near top edge, potentially flip below
    // Simplified logic: Always position above for now
    setToolbarPosition({ 
      // Ensure top is not negative
      top: Math.max(0, calculatedTop), 
      left: rect.left // Left relative to viewport seems correct for fixed
    }); 

  }, [editor.selection, editor]); // Re-run when selection changes

  // Simplified keyboard detection (example, may need library for reliability)
  useEffect(() => {
    const handleResize = () => {
      // Basic check: if window height significantly decreases, assume keyboard
      // This is unreliable; a dedicated library is better
      const newHeight = window.innerHeight;
      // Store initial height or use threshold logic
    };
    window.addEventListener('resize', handleResize);
    // Add listeners for virtual keyboard APIs if available/needed
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  if (!toolbarPosition) {
    // Don't render if position is not set (or selection is invalid)
    // return null; // Let's keep it rendered but maybe visually hidden or disabled
  }

  // Conditionally render Save/Discard/Insert based on user auth and context
  const showSaveDiscard = !!onSave && !!onDiscard && user; // Only show if user is logged in
  const showInsert = !!onInsert; // Show if insert handler is provided


  return (
    <AnimatePresence>
    {toolbarPosition && ( // Only render with animation if position is set
      <motion.div
        ref={toolbarRef}
        className="absolute z-50 bg-background border border-border rounded-md shadow-lg p-1 flex items-center space-x-1"
        style={{
          position: 'fixed', // Keep fixed positioning for now
          top: `${toolbarPosition.top}px`,
          left: `${toolbarPosition.left}px`,
          opacity: 1, // Ensure visible
        }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.1 }}
      >
        {/* Toolbar buttons */}
        {/* Example Button: Bold */}
        {/* <button 
            className="p-1 hover:bg-muted rounded"
            onMouseDown={(event) => {
              event.preventDefault(); // Prevent editor losing focus
              // Toggle Bold Mark Command
            }}
          >
            B
          </button> */}
          
        {/* Add other formatting buttons here */}

        {/* Separator */}
        {/* <div className="border-l border-border h-4 mx-1"></div> */}

        {/* Insert/Save/Discard Buttons */}
        {showInsert && (
           <button 
             className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
             onMouseDown={(event) => {
                 event.preventDefault();
                 onInsert(); // Call the insert handler passed via props
             }}
           >
             Insert
           </button>
        )}
         {showSaveDiscard && (
           <>
             <button 
                ref={saveButtonRef} // Assign ref to save button
                className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                onMouseDown={(event) => {
                  event.preventDefault();
                  console.log("Save button clicked");
                  onSave(); // Call the save handler passed via props
                }}
              >
                Save
              </button>
              <button 
                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                onMouseDown={(event) => {
                    event.preventDefault();
                    onDiscard(); // Call the discard handler
                }}
              >
                Discard
              </button>
           </>
         )}
      </motion.div>
     )}
    </AnimatePresence>
  );
};

// Custom EditorContent component to apply line mode styles
const EditorContent = ({ editor, handleKeyDown, renderElement, editableRef }) => {
  const { lineSettings } = useLineSettings();

  // Determine the class based on the line setting mode
  const editorClassName = useMemo(() => {
    let baseClass = "prose dark:prose-invert max-w-none focus:outline-none";
    // Apply spacing based on mode - These might need adjustment based on recent padding changes
    if (lineSettings.mode === 'spaced') {
      return `${baseClass} editor-spaced`; // Add specific class for spaced
    } else if (lineSettings.mode === 'wrapped') {
      return `${baseClass} editor-wrapped`; // Add specific class for wrapped
    } else {
      return `${baseClass} editor-default`; // Default class
    }
  }, [lineSettings.mode]);


  return (
    <motion.div 
      className={`editable-container p-2`} // Reduced padding from p-4
      initial={{ opacity: 0, y: 5 }} // Subtle slide up and fade in
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }} // Quick fade in
    >
      <Editable
        ref={editableRef}
        renderElement={renderElement}
        renderLeaf={Leaf} // Use custom Leaf component
        placeholder="Start writing..."
        spellCheck
        autoFocus={false} // Manage focus via ref if needed
        onKeyDown={event => handleKeyDown(event, editor)}
        className={editorClassName} // Apply dynamic class name
      />
    </motion.div>
  );
};

// Custom Leaf component for text formatting
const Leaf = ({ attributes, children, leaf }) => {
  try {
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
  } catch (error) {
     console.error("Error applying leaf format:", error, "Leaf:", JSON.stringify(leaf));
     // Render children without formatting on error
  }
  return <span {...attributes}>{children}</span>;
};

export default SlateEditor;
