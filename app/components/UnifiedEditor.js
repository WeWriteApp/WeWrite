"use client";

import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useCallback } from "react";
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
  },
  findPath: (editor, node) => {
    try {
      if (ReactEditor && typeof ReactEditor.findPath === 'function') {
        return ReactEditor.findPath(editor, node);
      }
    } catch (error) {
      console.error('Error in safeReactEditor.findPath:', error);
    }
    return [0];
  }
};

// Helper to create a default paragraph
const createDefaultParagraph = () => ({
  type: 'paragraph',
  children: [{ text: '' }]
});

// Helper to ensure valid editor content
const ensureValidContent = (content) => {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return [createDefaultParagraph()];
  }
  return content;
};

/**
 * UnifiedEditor Component
 *
 * A rich text editor component that provides a consistent editing experience
 * across different content types (wiki pages, group about pages, user bios).
 *
 * @param {Object} props - Component props
 * @param {Array} props.initialContent - Initial content for the editor
 * @param {Function} props.onChange - Callback when content changes
 * @param {string} props.placeholder - Placeholder text when editor is empty
 * @param {string} props.contentType - Type of content being edited (wiki, about, bio)
 */
const UnifiedEditor = forwardRef(({
  initialContent = [createDefaultParagraph()],
  onChange,
  placeholder = "Start typing...",
  contentType = "wiki"
}, ref) => {
  // Create editor instance
  const [editor] = useState(() => withHistory(withReact(createEditor())));
  const [editorValue, setEditorValue] = useState(ensureValidContent(initialContent));
  const [selection, setSelection] = useState(null);
  const editableRef = useRef(null);
  const lastSelectionRef = useRef(null);

  // Track if we've already set up the editor
  const isInitializedRef = useRef(false);

  // Initialize editor with content
  useEffect(() => {
    if (!isInitializedRef.current && initialContent) {
      const validContent = ensureValidContent(initialContent);
      setEditorValue(validContent);
      isInitializedRef.current = true;
    }
  }, [initialContent]);

  // Expose methods to parent components via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      try {
        safeReactEditor.focus(editor);
        return true;
      } catch (error) {
        console.error('Error focusing editor:', error);
        return false;
      }
    },
    getContent: () => editorValue,
    insertText: (text) => {
      try {
        editor.insertText(text);
        return true;
      } catch (error) {
        console.error('Error inserting text:', error);
        return false;
      }
    },
    // Add any other methods you want to expose
  }));

  // Handle editor changes
  const handleEditorChange = useCallback((value) => {
    // Store the current selection to prevent cursor jumps
    if (editor.selection) {
      lastSelectionRef.current = editor.selection;
    }

    setEditorValue(value);

    // Call the onChange callback if provided
    if (onChange) {
      onChange(value);
    }
  }, [editor, onChange]);

  // Render a paragraph element
  const renderElement = useCallback(({ attributes, children, element }) => {
    switch (element.type) {
      case 'paragraph':
        return <p {...attributes}>{children}</p>;
      default:
        return <p {...attributes}>{children}</p>;
    }
  }, []);

  // Render a leaf (text with formatting)
  const renderLeaf = useCallback(({ attributes, children, leaf }) => {
    let leafProps = { ...attributes };

    if (leaf.bold) {
      children = <strong>{children}</strong>;
    }

    if (leaf.italic) {
      children = <em>{children}</em>;
    }

    if (leaf.underline) {
      children = <u>{children}</u>;
    }

    return <span {...leafProps}>{children}</span>;
  }, []);

  // Handle key down events
  const handleKeyDown = useCallback((event) => {
    // Store the current selection before any key event
    if (editor.selection) {
      lastSelectionRef.current = editor.selection;
    }

    // Add any key handling logic here
  }, [editor]);

  return (
    <div className="unified-editor relative rounded-lg bg-background">
      <Slate
        editor={editor}
        initialValue={editorValue}
        onChange={handleEditorChange}
      >
        <Editable
          ref={editableRef}
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          placeholder={placeholder}
          spellCheck={true}
          autoFocus={false}
          onKeyDown={handleKeyDown}
          className="min-h-[200px] p-3 outline-none"
          // Critical fix: Preserve selection on blur to prevent cursor jumps
          onBlur={() => {
            if (editor.selection) {
              lastSelectionRef.current = editor.selection;
            }
          }}
          // Critical fix: Restore selection on focus to prevent cursor jumps
          onFocus={() => {
            if (lastSelectionRef.current && !editor.selection) {
              try {
                Transforms.select(editor, lastSelectionRef.current);
              } catch (error) {
                console.error('Error restoring selection on focus:', error);
              }
            }
          }}
        />
      </Slate>
    </div>
  );
});

UnifiedEditor.displayName = 'UnifiedEditor';

export default UnifiedEditor;
