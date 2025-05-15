"use client";
import React, { useState, useContext, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import {
  createEditor,
  Transforms,
  Editor,
  Element as SlateElement,
  Range,
  Node,
  Path,
} from "slate";
import { Editable, withReact, useSlate, Slate } from "slate-react";
import { ReactEditor } from "slate-react";
import { withHistory } from "slate-history";
import { Link as LinkIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useLineSettings, LineSettingsProvider } from '../contexts/LineSettingsContext';

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

/**
 * BasicSlateEditor Component
 *
 * A simplified version of SlateEditor that only supports:
 * - Plain text editing with line numbers
 * - Link insertion
 * - Consistent cursor position
 *
 * @param {string} initialContent - The initial HTML content to load
 * @param {Function} onChange - Function to update the parent component's state with editor changes
 * @param {string} placeholder - Placeholder text to show when editor is empty
 */
const BasicSlateEditor = forwardRef(({ initialContent = "", onChange, placeholder = "Start typing..." }, ref) => {
  const [editor] = useState(() => withInlines(withHistory(withReact(createEditor()))));
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkEditorPosition, setLinkEditorPosition] = useState({});
  const editableRef = useRef(null);
  const [lineCount, setLineCount] = useState(0);

  // Parse HTML content to Slate format or use empty paragraph
  const [initialValue, setInitialValue] = useState(() => {
    try {
      if (initialContent) {
        // For simplicity, we'll just create a single paragraph with the content
        return [{ type: "paragraph", children: [{ text: initialContent.replace(/<[^>]*>/g, '') }] }];
      }
      return [{ type: "paragraph", children: [{ text: "" }] }];
    } catch (error) {
      console.error("Error initializing editor state:", error);
      return [{ type: "paragraph", children: [{ text: "" }] }];
    }
  });

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    focus: () => {
      try {
        safeReactEditor.focus(editor);
      } catch (error) {
        console.error('Error focusing editor:', error);
      }
    },
    openLinkEditor: () => {
      try {
        safeReactEditor.focus(editor);
        const { selection } = editor;
        if (selection) {
          showLinkEditorMenu(editor, selection);
        } else {
          const end = Editor.end(editor, []);
          Transforms.select(editor, end);
          showLinkEditorMenu(editor, editor.selection);
        }
      } catch (error) {
        console.error('Error opening link editor:', error);
      }
    }
  }));

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
  const debouncedContentChange = React.useCallback(
    debounce((value) => {
      if (typeof onChange === 'function') {
        // Store the current selection before calling onChange
        const currentSelection = editor.selection;

        // Convert Slate value to HTML for storage
        let html = '';
        value.forEach(node => {
          if (node.type === 'paragraph') {
            html += '<p>';
            node.children.forEach(child => {
              if (child.type === 'link') {
                html += `<a href="${child.url}">${child.children[0].text}</a>`;
              } else {
                html += child.text;
              }
            });
            html += '</p>';
          }
        });

        // Call the parent's onChange
        onChange(html);

        // Restore the selection after a short delay
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
    }, 300),
    [onChange, editor] // onChange is the prop passed to the component
  );

  // handleEditorChange - handler with error handling and debouncing
  const handleEditorChange = (newValue) => {
    try {
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
      }
    } catch (error) {
      console.error('Error in handleEditorChange handler:', error);
    }
  };

  const handleKeyDown = (event, editor) => {
    // Handle Enter key to create new paragraphs
    if (event.key === 'Enter') {
      event.preventDefault();
      try {
        // Create a new paragraph
        Transforms.splitNodes(editor, {
          always: true,
          match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'paragraph'
        });
      } catch (error) {
        console.error('Error handling Enter key:', error);
        // Fallback: insert a new paragraph directly
        try {
          const newParagraph = { type: 'paragraph', children: [{ text: '' }] };
          Transforms.insertNodes(editor, newParagraph);
        } catch (fallbackError) {
          console.error('Fallback error:', fallbackError);
        }
      }
    }
  };

  const showLinkEditorMenu = (editor, editorSelection) => {
    try {
      if (editor && editorSelection) {
        const domSelection = safeReactEditor.toDOMRange(editor, editorSelection);
        if (domSelection) {
          const rect = domSelection.getBoundingClientRect();
          setLinkEditorPosition({
            top: rect.bottom + window.pageYOffset,
            left: rect.left + window.pageXOffset,
          });
          setShowLinkEditor(true);
          return;
        }
      }

      // Fallback to window.getSelection()
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0).cloneRange();
        const rect = range.getBoundingClientRect();
        setLinkEditorPosition({
          top: rect.bottom + window.pageYOffset,
          left: rect.left + window.pageXOffset,
        });
      } else {
        // Position in center as last resort
        setLinkEditorPosition({
          top: window.innerHeight / 2,
          left: window.innerWidth / 2,
        });
      }
      setShowLinkEditor(true);
    } catch (error) {
      console.error("Error showing link editor menu:", error);
    }
  };

  const handleInsertLink = () => {
    const url = prompt('Enter link URL:');
    if (url) {
      const text = prompt('Enter link text:', url);
      if (text) {
        const link = {
          type: "link",
          url: url,
          children: [{ text: text }],
        };

        // Make sure we have a valid selection
        if (!editor.selection) {
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
  };

  const renderElement = (props) => {
    const { attributes, children, element } = props;

    switch (element.type) {
      case "link":
        return (
          <a
            {...attributes}
            href={element.url}
            className="text-primary underline"
          >
            {children}
          </a>
        );
      case "paragraph":
        const index = props.element.path ? props.element.path[0] : ReactEditor.findPath(editor, element)[0];
        return (
          <div {...attributes} className="paragraph-with-number py-2.5">
            <span className="paragraph-number-inline select-none" style={{ pointerEvents: 'none' }}>
              {index + 1}
            </span>
            <p className="inline">{children}</p>
          </div>
        );
      default:
        const defaultIndex = props.element.path ? props.element.path[0] : ReactEditor.findPath(editor, element)[0];
        return (
          <div {...attributes} className="paragraph-with-number py-2.5">
            <span className="paragraph-number-inline select-none" style={{ pointerEvents: 'none' }}>
              {defaultIndex + 1}
            </span>
            <p className="inline">{children}</p>
          </div>
        );
    }
  };

  // Make sure we have a valid editor and initialValue
  const validEditor = editor || createEditor();
  const validInitialValue = Array.isArray(initialValue) && initialValue.length > 0
    ? initialValue
    : [{ type: "paragraph", children: [{ text: "" }] }];

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="bg-muted p-2 border-b border-border flex flex-wrap gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleInsertLink}
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert Link</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <LineSettingsProvider>
        <div
          className="relative rounded-lg bg-background"
          style={{
            height: '300px',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Slate
            editor={validEditor}
            initialValue={validInitialValue}
            onChange={handleEditorChange}
            key="basic-slate-editor-instance"
          >
            <div className="flex-grow flex flex-col">
              <div className="relative flex-grow">
                <Editable
                  ref={editableRef}
                  renderElement={renderElement}
                  placeholder={placeholder}
                  spellCheck={true}
                  onKeyDown={event => handleKeyDown(event, validEditor)}
                  className="outline-none h-full p-2"
                />
              </div>
            </div>
          </Slate>
        </div>
      </LineSettingsProvider>
    </div>
  );
});

BasicSlateEditor.displayName = 'BasicSlateEditor';

const withInlines = (editor) => {
  const { isInline } = editor;

  // Override isInline to handle link elements
  editor.isInline = element => {
    return ['link'].includes(element.type) || isInline(element);
  };

  return editor;
};

export default BasicSlateEditor;
