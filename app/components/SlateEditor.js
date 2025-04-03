import React, { useState, useContext, useRef, forwardRef, useImperativeHandle, useEffect, useCallback, useMemo, useLayoutEffect } from "react";
import { createEditor, Editor, Transforms, Range, Point, Path, Element as SlateElement, Node } from "slate";
import { Slate, Editable, ReactEditor, withReact, useSelected, useSlate, useSlateStatic, useReadOnly } from "slate-react";
import { withHistory } from "slate-history";
import { AnimatePresence, motion } from "framer-motion";
import { DataContext } from "../providers/DataProvider";
import { AuthContext } from "../providers/AuthProvider";
import { LineSettingsProvider, useLineSettings, LINE_MODES } from '../contexts/LineSettingsContext';

// CSS for editor modes - ensures consistent styling with TextView
const editorStyles = `
  .editor-normal {
    /* Normal mode styling */
    line-height: 1.6;
  }

  .editor-dense {
    /* Dense mode styling */
    line-height: 1.6;
  }

  /* Ensure paragraph numbers are styled consistently */
  [data-slate-editor] [contenteditable="false"] {
    pointer-events: none;
    user-select: none;
  }

  /* Match TextView styling */
  [data-slate-editor] {
    font-size: 1rem;
    color: var(--foreground);
  }

  /* Ensure proper spacing between paragraphs */
  [data-slate-editor] > div {
    margin-bottom: 0.5rem;
  }

  /* Style for code blocks */
  [data-slate-editor] code {
    background-color: var(--muted);
    padding: 0.1rem 0.3rem;
    border-radius: 0.25rem;
    font-family: monospace;
  }
`;

// Helper function to deserialize content with improved error handling
const deserialize = (content) => {
  // Default valid Slate structure
  const defaultValue = [{ type: ELEMENT_TYPES.PARAGRAPH, children: [{ text: '' }] }];

  try {
    // Return default if content is null, undefined, or empty
    if (!content) {
      console.log("No content provided, using default empty editor state");
      return defaultValue;
    }

    // Handle string content (likely JSON)
    if (typeof content === 'string') {
      try {
        // Try parsing if it's a JSON string
        const parsed = JSON.parse(content);

        // Validate parsed content structure
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) {
            // Empty array, return with at least one node
            console.log("Empty array in content, using default structure");
            return defaultValue;
          }

          // Check if the structure looks like valid Slate content
          const hasValidStructure = parsed.every(node =>
            node && typeof node === 'object' && node.type && Array.isArray(node.children)
          );

          if (hasValidStructure) {
            return parsed;
          } else {
            console.warn("Content has invalid Slate structure, using default");
            return defaultValue;
          }
        } else {
          console.warn("Parsed content is not an array, using default");
          return defaultValue;
        }
      } catch (e) {
        // If parsing fails, treat as plain text
        console.warn("Failed to parse content as JSON, treating as plain text:", e.message);
        return [{ type: ELEMENT_TYPES.LINE, children: [{ text: String(content).substring(0, 1000) }] }];
      }
    }

    // Handle array content (already parsed)
    if (Array.isArray(content)) {
      if (content.length === 0) {
        return defaultValue;
      }

      // Validate array structure
      const hasValidStructure = content.every(node =>
        node && typeof node === 'object' && node.type && Array.isArray(node.children)
      );

      if (hasValidStructure) {
        return content;
      } else {
        console.warn("Array content has invalid Slate structure, using default");
        return defaultValue;
      }
    }

    // Handle unexpected formats
    console.warn("Unexpected content format, using default:", typeof content);
    return defaultValue;
  } catch (error) {
    // Catch any unexpected errors in the deserialization process
    console.error("Error in deserialize function:", error);
    return defaultValue;
  }
};

// Element types for the editor
const ELEMENT_TYPES = {
  PARAGRAPH: 'paragraph',
  CODE: 'code',
  QUOTE: 'quote',
  HEADING: 'heading',
  LINK: 'link',
  LINE: 'line'
};

const SlateEditor = forwardRef(({ initialContent, onContentChange, onInsert, onDiscard, onSave }, ref) => {
  const { lineMode } = useLineSettings();

  // Log initialContent and deserialized result
  console.log("SlateEditor received initialContent:", initialContent);
  const deserializedValue = useMemo(() => {
    const result = deserialize(initialContent);
    console.log("Deserialized initialContent:", JSON.stringify(result));
    return result;
  }, [initialContent]);

  // Custom plugin to ensure nodes are paragraphs by default
  const withParagraphNumbers = editor => {
    const { normalizeNode } = editor;

    editor.normalizeNode = ([node, path]) => {
      if (path.length === 0) {
        // For the top-level nodes, ensure they have a type
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          if (!child.type) {
            Transforms.setNodes(
              editor,
              { type: ELEMENT_TYPES.PARAGRAPH },
              { at: [...path, i] }
            );
          }
        }
      }

      // Fall back to the original normalizeNode
      normalizeNode([node, path]);
    };

    return editor;
  };

  const editor = useMemo(() => withParagraphNumbers(withLinks(withReact(createEditor()))), []);
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
  // We don't need hasLineSettings anymore as we're always showing paragraph numbers

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
        if (node.mode === 'code') {
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
    // Safely destructure props with fallbacks
    const { attributes = {}, children = null } = props;
    const element = props.element || {};

    try {
      // Check if element is valid before accessing properties
      if (!element || typeof element !== 'object') {
        console.error('Invalid element in renderElement:', element);
        return <div {...attributes} className="error-element bg-red-100 p-1 rounded">{children}</div>;
      }

      // Get current line mode from context
      const currentLineMode = lineMode || 'normal';

      switch (element.type) {
        case ELEMENT_TYPES.LINK:
          return (
            <a {...attributes} href={element.url || '#'} data-page-id={element.pageId} data-page-title={element.pageTitle} className="editor-link">
              {children}
            </a>
          );
        case ELEMENT_TYPES.PARAGRAPH:
          // Get paragraph number (1-based index)
          let paragraphPath, paragraphNumber;
          if (editor) {
            try {
              paragraphPath = ReactEditor.findPath(editor, element);
              if (paragraphPath && paragraphPath.length > 0) {
                paragraphNumber = paragraphPath[0] + 1; // 1-based indexing
              }
            } catch (pathError) {
              console.error("Error finding path for paragraph element:", pathError, element);
            }
          }

          return (
            <div {...attributes} className="flex items-start py-1 relative">
              {/* Paragraph number - non-editable */}
              <span
                contentEditable={false}
                className="text-muted-foreground text-sm w-6 mr-2 text-right flex-shrink-0 select-none"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {paragraphNumber}
              </span>
              {/* Paragraph content */}
              <div className="flex-1">{children}</div>
            </div>
          );
        case ELEMENT_TYPES.LINE:
          // Convert line type to paragraph for consistency
          let lineNumber;
          if (editor) {
            try {
              const path = ReactEditor.findPath(editor, element);
              if (path && path.length > 0) {
                lineNumber = path[0] + 1; // 1-based indexing
              }
            } catch (pathError) {
              console.error("Error finding path for line element:", pathError, element);
            }
          }

          return (
            <div {...attributes} className="flex items-start py-1 relative">
              {/* Line number - non-editable */}
              <span
                contentEditable={false}
                className="text-muted-foreground text-sm w-6 mr-2 text-right flex-shrink-0 select-none"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {lineNumber}
              </span>
              {/* Line content */}
              <div className="flex-1">{children}</div>
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
  }, [editor, lineMode]); // Updated dependencies

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
      {/* Add custom styles */}
      <style dangerouslySetInnerHTML={{ __html: editorStyles }} />
      {/* Conditionally render LinkEditor */}
      {showLinkEditor && linkEditorPosition && (
        <LinkEditor
          position={linkEditorPosition}
          onSelect={handleSelection}
          setShowLinkEditor={setShowLinkEditor}
          initialText={selectedLinkElement && selectedLinkElement.children && selectedLinkElement.children[0] ? selectedLinkElement.children[0].text || '' : ''}
          initialPageId={selectedLinkElement ? selectedLinkElement.pageId : null}
          initialPageTitle={selectedLinkElement ? selectedLinkElement.pageTitle : ''}
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

      {/* Fixed Bottom Toolbar */}
      <FixedBottomToolbar
        onSave={onSave}
        onDiscard={onDiscard}
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
  let lineNumber = 0;
  try {
    const editor = useSlate();
    if (editor && element) {
      const path = ReactEditor.findPath(editor, element);
      if (path && path.length > 0) {
        lineNumber = path[0] + 1;
      }
    }
  } catch (error) {
    console.error("Error finding path for line element:", error);
  }

  // Apply different styling based on line mode
  const getLineStyles = () => {
    if (element && element.mode === 'code') {
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
  const { lineMode } = useLineSettings();

  // Determine the class based on the line setting mode
  const editorClassName = useMemo(() => {
    // Base class for all modes
    let baseClass = "prose dark:prose-invert max-w-none focus:outline-none text-base";

    // Apply specific classes based on line mode
    if (lineMode === 'dense') {
      return `${baseClass} editor-dense max-w-full break-words`;
    } else {
      return `${baseClass} editor-normal`;
    }
  }, [lineMode]);

  return (
    <motion.div
      className={`editable-container p-2`}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <Editable
        ref={editableRef}
        renderElement={renderElement}
        renderLeaf={Leaf}
        placeholder="Start writing..."
        spellCheck
        autoFocus={false}
        onKeyDown={event => handleKeyDown(event, editor)}
        className={editorClassName}
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

// Fixed bottom toolbar that's always visible and doesn't get covered by keyboard
const FixedBottomToolbar = ({ onSave, onDiscard }) => {
  const { user } = useContext(AuthContext);
  const showSaveDiscard = !!onSave && !!onDiscard && user;

  if (!showSaveDiscard) return null;

  return (
    <motion.div
      className="fixed-toolbar-bottom fixed left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-t border-border py-3 px-4 flex justify-end space-x-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}

    >
      <button
        className="px-4 py-2 rounded-md border border-border bg-background hover:bg-accent/10 transition-colors"
        onClick={(event) => {
          event.preventDefault();
          onDiscard();
        }}
      >
        Cancel
      </button>
      <button
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        onClick={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        Save
      </button>
    </motion.div>
  );
};

export default SlateEditor;
