'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PillLink } from '../utils/PillLink';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertTriangle, X, Trash2, Check, Link, GripVertical } from 'lucide-react';
import LinkEditorModal from './LinkEditorModal';

interface EditorProps {
  initialContent?: any[];
  onChange: (content: any[]) => void;
  onEmptyLinesChange?: (count: number) => void;
  placeholder?: string;
  readOnly?: boolean;

  // Enhanced props for complete editing functionality
  location?: { lat: number; lng: number } | null;
  setLocation?: (location: { lat: number; lng: number } | null) => void;
  onSave?: (content?: any) => void;
  onCancel?: () => void;
  onDelete?: (() => void) | null;
  isSaving?: boolean;
  error?: string;
  isNewPage?: boolean;
  showToolbar?: boolean;

  [key: string]: any;
}

// True character-level data model - each position is either a character or a link
interface CharacterItem {
  type: 'char';
  char: string; // Single character
}

interface LinkItem {
  type: 'link';
  text: string;
  url?: string;
  pageId?: string;
  pageTitle?: string;
  isExternal?: boolean;
  isPublic?: boolean;
  isOwned?: boolean;
}

type ContentItem = CharacterItem | LinkItem;

interface EditorLine {
  id: string;
  lineNumber: number;
  items: ContentItem[]; // Array of characters and links
}

const Editor = React.forwardRef<any, EditorProps>((props, ref) => {
  const {
    initialContent = [],
    onChange,
    onEmptyLinesChange,
    placeholder = "Start typing...",
    readOnly = false,

    // Enhanced props
    location,
    setLocation,
    onSave,
    onCancel,
    onDelete,
    isSaving = false,
    error = "",
    isNewPage = false,
    showToolbar = true,

    ...otherProps
  } = props;

  const [lines, setLines] = useState<EditorLine[]>([]);
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ lineId: string; position: number } | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Drag and drop state
  const [draggedLineId, setDraggedLineId] = useState<string | null>(null);
  const [dragOverLineId, setDragOverLineId] = useState<string | null>(null);
  const [draggedLink, setDraggedLink] = useState<{ lineId: string; itemIndex: number } | null>(null);

  // Initialize lines from content
  useEffect(() => {
    if (!initialContent || initialContent.length === 0) {
      setLines([{
        id: 'line-1',
        lineNumber: 1,
        items: []
      }]);
      return;
    }

    const newLines: EditorLine[] = initialContent.map((node, index) => {
      const items: ContentItem[] = [];

      if (node?.children) {
        for (const child of node.children) {
          if (child.type === 'link') {
            // Add link as single item
            items.push({
              type: 'link',
              text: child.children?.[0]?.text || child.pageTitle || 'Link',
              url: child.url,
              pageId: child.pageId,
              pageTitle: child.pageTitle,
              isExternal: child.isExternal,
              isPublic: child.isPublic,
              isOwned: child.isOwned
            });
          } else if (child.text !== undefined) {
            // Convert text to individual characters
            for (const char of child.text) {
              items.push({
                type: 'char',
                char: char
              });
            }
          }
        }
      }

      return {
        id: `line-${index + 1}`,
        lineNumber: index + 1,
        items: items
      };
    });

    setLines(newLines);
  }, [initialContent]);

  // Convert lines back to content format
  const generateContent = useCallback((updatedLines: EditorLine[]) => {
    const contentNodes = updatedLines.map(line => {
      const children: any[] = [];
      let currentText = '';

      // Group consecutive characters into text nodes
      for (const item of line.items) {
        if (item.type === 'char') {
          currentText += item.char;
        } else if (item.type === 'link') {
          // Flush any accumulated text
          if (currentText) {
            children.push({ text: currentText });
            currentText = '';
          }
          // Add link
          children.push({
            type: 'link',
            url: item.url,
            pageId: item.pageId,
            pageTitle: item.pageTitle,
            isExternal: item.isExternal,
            isPublic: item.isPublic,
            isOwned: item.isOwned,
            children: [{ text: item.text || 'Link' }]
          });
        }
      }

      // Flush any remaining text
      if (currentText) {
        children.push({ text: currentText });
      }

      // If no content, add empty text
      if (children.length === 0) {
        children.push({ text: '' });
      }

      return {
        type: 'paragraph',
        children: children
      };
    });

    onChange?.(contentNodes);

    // Update empty lines count
    if (onEmptyLinesChange) {
      const emptyCount = updatedLines.filter(line => line.items.length === 0).length;
      onEmptyLinesChange(emptyCount);
    }

    return contentNodes;
  }, [onChange, onEmptyLinesChange]);

  // Smart text input handler that PRESERVES LINKS as bulletproof objects
  const handleTextInput = useCallback((lineId: string, newText: string, cursorPos: number) => {
    setLines(prevLines => {
      const updatedLines = prevLines.map(line => {
        if (line.id === lineId) {
          // This handler is called by the keyboard input, so we trust it
          // The keyboard handler already ensures links are protected
          // Just convert the text to character items
          const newItems: ContentItem[] = [];
          for (const char of newText) {
            if (char === '█') {
              // This shouldn't happen from keyboard input, but skip if it does
              continue;
            }
            newItems.push({ type: 'char', char });
          }
          return { ...line, items: newItems };
        }
        return line;
      });

      generateContent(updatedLines);
      return updatedLines;
    });
  }, [generateContent]);

  // Handle Enter key to create new line
  const handleEnter = useCallback((lineId: string) => {
    const lineIndex = lines.findIndex(line => line.id === lineId);
    if (lineIndex === -1) return;

    setLines(prevLines => {
      const newLines = [...prevLines];
      const newLine: EditorLine = {
        id: `line-${Date.now()}`,
        lineNumber: lineIndex + 2,
        items: []
      };

      newLines.splice(lineIndex + 1, 0, newLine);

      // Renumber all lines
      const renumberedLines = newLines.map((line, index) => ({
        ...line,
        lineNumber: index + 1,
        id: `line-${index + 1}`
      }));

      generateContent(renumberedLines);

      // Set focus and cursor to the new line after state update
      setTimeout(() => {
        const newLineId = `line-${lineIndex + 2}`;
        setFocusedLineId(newLineId);
        setCursorPosition({ lineId: newLineId, position: 0 });
      }, 0);

      return renumberedLines;
    });
  }, [lines, generateContent]);

  // Insert link at cursor position
  const insertLink = useCallback((url: string, text: string, options?: any) => {
    if (!focusedLineId || cursorPosition === null) return false;

    setLines(prevLines => {
      const updatedLines = prevLines.map(line => {
        if (line.id === focusedLineId) {
          const newItems = [...line.items];

          // Create link item
          const linkItem: LinkItem = {
            type: 'link',
            text: text,
            url: url,
            pageId: options?.pageId,
            pageTitle: options?.pageTitle,
            isExternal: options?.type === 'external',
            isPublic: options?.isPublic,
            isOwned: options?.isOwned
          };

          // Insert link at cursor position
          newItems.splice(cursorPosition.position, 0, linkItem);

          return { ...line, items: newItems };
        }
        return line;
      });

      generateContent(updatedLines);
      return updatedLines;
    });

    return true;
  }, [focusedLineId, cursorPosition, generateContent]);

  // Line drag handlers
  const handleLineDragStart = useCallback((event: React.DragEvent, lineId: string) => {
    event.dataTransfer.setData('text/plain', lineId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedLineId(lineId);
  }, []);

  const handleLineDragEnd = useCallback(() => {
    setDraggedLineId(null);
    setDragOverLineId(null);
  }, []);

  const handleLineDragOver = useCallback((event: React.DragEvent, targetLineId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverLineId(targetLineId);
  }, []);

  const handleLineDrop = useCallback((event: React.DragEvent, targetLineId: string) => {
    event.preventDefault();
    const draggedLineId = event.dataTransfer.getData('text/plain');

    if (draggedLineId === targetLineId) return;

    setLines(prevLines => {
      const draggedIndex = prevLines.findIndex(line => line.id === draggedLineId);
      const targetIndex = prevLines.findIndex(line => line.id === targetLineId);

      if (draggedIndex === -1 || targetIndex === -1) return prevLines;

      const updatedLines = [...prevLines];
      const [draggedLine] = updatedLines.splice(draggedIndex, 1);
      updatedLines.splice(targetIndex, 0, draggedLine);

      // Renumber all lines
      const renumberedLines = updatedLines.map((line, index) => ({
        ...line,
        lineNumber: index + 1,
        id: `line-${index + 1}`
      }));

      generateContent(renumberedLines);
      return renumberedLines;
    });
  }, [generateContent]);

  // Handle vertical cursor movement between lines
  const handleVerticalMove = useCallback((direction: 'up' | 'down', currentPosition: number) => {
    const currentLineIndex = lines.findIndex(line => line.id === focusedLineId);
    if (currentLineIndex === -1) return;

    let targetLineIndex: number;
    if (direction === 'up') {
      targetLineIndex = currentLineIndex - 1;
    } else {
      targetLineIndex = currentLineIndex + 1;
    }

    // Check bounds
    if (targetLineIndex < 0 || targetLineIndex >= lines.length) return;

    const targetLine = lines[targetLineIndex];
    if (!targetLine) return;

    // Calculate the best cursor position in the target line
    // Try to maintain the same horizontal position, but clamp to line length
    const targetPosition = Math.min(currentPosition, targetLine.items.length);

    // Update focus and cursor position
    setFocusedLineId(targetLine.id);
    setCursorPosition({ lineId: targetLine.id, position: targetPosition });
  }, [lines, focusedLineId, setCursorPosition]);

  // Handle link insertion from modal
  const handleInsertLink = useCallback((linkData: any) => {
    console.log('🔵 [DEBUG] Link insertion from modal:', linkData);

    const linkText = linkData.text || linkData.pageTitle || linkData.url || 'Link';
    const url = linkData.url || (linkData.pageId ? `/${linkData.pageId}` : '');

    const options = {
      pageId: linkData.pageId,
      pageTitle: linkData.pageTitle,
      type: linkData.type,
      isPublic: linkData.isPublic,
      isOwned: linkData.isOwned
    };

    const success = insertLink(url, linkText, options);
    if (success) {
      setShowLinkModal(false);
    }
  }, [insertLink]);

  // Expose API methods
  React.useImperativeHandle(ref, () => ({
    insertLink,
    focus: () => {
      const firstLine = lines[0];
      if (firstLine) {
        setFocusedLineId(firstLine.id);
        return true;
      }
      return false;
    }
  }));

  return (
    <div className="character-editor" style={{ fontFamily: 'inherit' }}>
      {lines.map((line) => {
        const isDragging = draggedLineId === line.id;
        const isDropTarget = dragOverLineId === line.id;

        return (
          <React.Fragment key={line.id}>
            {/* Drop zone indicator */}
            {isDropTarget && draggedLineId && draggedLineId !== line.id && (
              <div
                style={{
                  height: '2px',
                  backgroundColor: 'rgb(59, 130, 246)',
                  margin: '4px 0',
                  borderRadius: '1px',
                  width: '100%',
                  opacity: 0.8,
                  boxShadow: '0 0 4px rgba(59, 130, 246, 0.4)',
                  transition: 'all 0.2s ease'
                }}
              />
            )}

            <LineComponent
              line={line}
              isDragging={isDragging}
              readOnly={readOnly}
              placeholder={lines.length === 1 && line.items.length === 0 ? placeholder : ''}
              onTextInput={handleTextInput}
              onEnter={handleEnter}
              onFocus={() => setFocusedLineId(line.id)}
              onCursorChange={(position) => setCursorPosition({ lineId: line.id, position })}
              onLineDragStart={handleLineDragStart}
              onLineDragEnd={handleLineDragEnd}
              onLineDragOver={handleLineDragOver}
              onLineDrop={handleLineDrop}
              setLines={setLines}
              generateContent={generateContent}
              isFocused={focusedLineId === line.id}
              onVerticalMove={handleVerticalMove}
            />
          </React.Fragment>
        );
      })}

      {/* Toolbar */}
      {showToolbar && (
        <div className="mt-4 flex flex-col gap-3">
          {/* Add Link button */}
          <Button
            variant="outline"
            size="lg"
            onClick={() => setShowLinkModal(true)}
            className="gap-2 w-full rounded-2xl font-medium"
          >
            <Link className="h-5 w-5" />
            Add Link
          </Button>

          {/* Error display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Save Changes button */}
          {onSave && (
            <Button
              variant="success"
              size="lg"
              onClick={() => onSave()}
              disabled={isSaving}
              className="gap-2 w-full rounded-2xl font-medium"
            >
              {isSaving ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Check className="h-5 w-5" />
              )}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}

          {/* Delete Page button */}
          {onDelete && (
            <Button
              variant="destructive"
              size="lg"
              onClick={onDelete}
              className="gap-2 w-full rounded-2xl font-medium text-white"
            >
              <Trash2 className="h-5 w-5" />
              Delete Page
            </Button>
          )}
        </div>
      )}

      {/* Link Editor Modal */}
      <LinkEditorModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onInsertLink={handleInsertLink}
      />
    </div>
  );
});

// Individual line component with drag support
interface LineComponentProps {
  line: EditorLine;
  isDragging: boolean;
  readOnly: boolean;
  placeholder: string;
  onTextInput: (lineId: string, text: string, position: number) => void;
  onEnter: (lineId: string) => void;
  onFocus: () => void;
  onCursorChange: (position: number) => void;
  onLineDragStart: (event: React.DragEvent, lineId: string) => void;
  onLineDragEnd: () => void;
  onLineDragOver: (event: React.DragEvent, lineId: string) => void;
  onLineDrop: (event: React.DragEvent, lineId: string) => void;
  setLines: React.Dispatch<React.SetStateAction<EditorLine[]>>;
  generateContent: (lines: EditorLine[]) => any[];
  isFocused: boolean;
  onVerticalMove?: (direction: 'up' | 'down', currentPosition: number) => void;
}

const LineComponent: React.FC<LineComponentProps> = ({
  line,
  isDragging,
  readOnly,
  placeholder,
  onTextInput,
  onEnter,
  onFocus,
  onCursorChange,
  onLineDragStart,
  onLineDragEnd,
  onLineDragOver,
  onLineDrop,
  setLines,
  generateContent,
  isFocused,
  onVerticalMove
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if line has links
  const hasLinks = line.items.some(item => item.type === 'link');

  return (
    <div
      className={`editor-line ${isFocused ? 'editor-line-focused' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        minHeight: '1.5rem',
        marginBottom: '0.25rem',
        lineHeight: '1.5',
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.15s ease',
        borderRadius: '4px',
        padding: '2px 4px',
        margin: '0 -4px 0.25rem -4px'
      }}
      draggable={!readOnly}
      onDragStart={(e) => onLineDragStart(e, line.id)}
      onDragEnd={onLineDragEnd}
      onDragOver={(e) => onLineDragOver(e, line.id)}
      onDrop={(e) => onLineDrop(e, line.id)}
    >
      {/* Drag handle */}
      {!readOnly && (
        <GripVertical
          size={12}
          style={{
            color: 'rgb(107, 114, 128)',
            opacity: 0.6,
            cursor: isDragging ? 'grabbing' : 'grab',
            marginRight: '0.25rem',
            marginTop: '0.25rem',
            flexShrink: 0
          }}
          title="Drag to reorder"
        />
      )}

      {/* Line number */}
      <span
        style={{
          color: 'rgb(107, 114, 128)',
          fontSize: '0.75rem',
          opacity: 0.7,
          userSelect: 'none',
          marginRight: '0.5rem',
          lineHeight: '1.5',
          marginTop: '0.125rem',
          flexShrink: 0,
          minWidth: '1.5rem'
        }}
      >
        {line.lineNumber}
      </span>

      {/* Content area */}
      <div style={{ flex: 1, minHeight: '1.5rem' }}>
        <LineContent
          line={line}
          readOnly={readOnly}
          placeholder={placeholder}
          onTextInput={onTextInput}
          onEnter={onEnter}
          onFocus={onFocus}
          onCursorChange={onCursorChange}
          setLines={setLines}
          generateContent={generateContent}
          onVerticalMove={onVerticalMove}
          isFocused={isFocused}
        />
      </div>
    </div>
  );
};

// Line content component that handles mixed character/link content
interface LineContentProps {
  line: EditorLine;
  readOnly: boolean;
  placeholder: string;
  onTextInput: (lineId: string, text: string, position: number) => void;
  onEnter: (lineId: string) => void;
  onFocus: () => void;
  onCursorChange: (position: number) => void;
  setLines: React.Dispatch<React.SetStateAction<EditorLine[]>>;
  generateContent: (lines: EditorLine[]) => any[];
  onVerticalMove?: (direction: 'up' | 'down', currentPosition: number) => void;
  isFocused: boolean;
}

const LineContent: React.FC<LineContentProps> = ({
  line,
  readOnly,
  placeholder,
  onTextInput,
  onEnter,
  onFocus,
  onCursorChange,
  setLines,
  generateContent,
  onVerticalMove,
  isFocused
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showCursor, setShowCursor] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Focus the line when it becomes focused (e.g., after Enter creates a new line)
  useEffect(() => {
    if (isFocused && containerRef.current && !readOnly) {
      containerRef.current.focus();
      setShowCursor(true);
    }
  }, [isFocused, readOnly]);

  // Handle click to position cursor
  const handleClick = useCallback((event: React.MouseEvent, position: number) => {
    event.preventDefault();
    setCursorPosition(position);
    onCursorChange(position);
    onFocus();
    setShowCursor(true);
  }, [onCursorChange, onFocus]);

  // Handle keyboard input - BULLETPROOF LINK PROTECTION
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (readOnly) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      onEnter(line.id);
      return;
    }

    // BULLETPROOF: Never allow any key to break links
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (cursorPosition > 0) {
        // Check if we're trying to delete a link - FORBIDDEN
        const itemAtPosition = line.items[cursorPosition - 1];
        if (itemAtPosition && itemAtPosition.type === 'link') {
          // NEVER delete links - they are bulletproof objects
          console.log('🔒 BULLETPROOF: Cannot delete link with Backspace');
          return;
        }

        // Only allow deleting characters
        if (itemAtPosition && itemAtPosition.type === 'char') {
          setLines(prevLines => {
            const updatedLines = prevLines.map(lineItem => {
              if (lineItem.id === line.id) {
                const newItems = [...lineItem.items];
                newItems.splice(cursorPosition - 1, 1);
                return { ...lineItem, items: newItems };
              }
              return lineItem;
            });

            generateContent(updatedLines);
            return updatedLines;
          });

          setCursorPosition(cursorPosition - 1);
          onCursorChange(cursorPosition - 1);
        }
      }
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      // Check if we're trying to delete a link - FORBIDDEN
      const itemAtPosition = line.items[cursorPosition];
      if (itemAtPosition && itemAtPosition.type === 'link') {
        // NEVER delete links - they are bulletproof objects
        console.log('🔒 BULLETPROOF: Cannot delete link with Delete key');
        return;
      }

      // Only allow deleting characters
      if (itemAtPosition && itemAtPosition.type === 'char') {
        setLines(prevLines => {
          const updatedLines = prevLines.map(lineItem => {
            if (lineItem.id === line.id) {
              const newItems = [...lineItem.items];
              newItems.splice(cursorPosition, 1);
              return { ...lineItem, items: newItems };
            }
            return lineItem;
          });

          generateContent(updatedLines);
          return updatedLines;
        });
      }
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const newPos = Math.max(0, cursorPosition - 1);
      setCursorPosition(newPos);
      onCursorChange(newPos);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const maxPos = line.items.length;
      const newPos = Math.min(maxPos, cursorPosition + 1);
      setCursorPosition(newPos);
      onCursorChange(newPos);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (onVerticalMove) {
        onVerticalMove('up', cursorPosition);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (onVerticalMove) {
        onVerticalMove('down', cursorPosition);
      }
      return;
    }

    // Handle character input - INSERT ONLY, NEVER REPLACE LINKS
    if (event.key.length === 1) {
      event.preventDefault();

      // Directly update the line items to insert character at cursor position
      setLines(prevLines => {
        const updatedLines = prevLines.map(lineItem => {
          if (lineItem.id === line.id) {
            const newItems = [...lineItem.items];
            // Insert character at cursor position
            newItems.splice(cursorPosition, 0, { type: 'char', char: event.key });
            return { ...lineItem, items: newItems };
          }
          return lineItem;
        });

        generateContent(updatedLines);
        return updatedLines;
      });

      // Update cursor position
      setCursorPosition(cursorPosition + 1);
      onCursorChange(cursorPosition + 1);
    }
  }, [readOnly, line.id, line.items, cursorPosition, onEnter, onTextInput, onCursorChange]);

  // Render the line as individual clickable elements
  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        minHeight: '1.5rem',
        width: '100%',
        outline: 'none',
        cursor: readOnly ? 'default' : 'text'
      }}
      tabIndex={readOnly ? -1 : 0}
      onKeyDown={handleKeyDown}
      onFocus={() => {
        onFocus();
        setShowCursor(true);
      }}
      onBlur={() => setShowCursor(false)}
    >
      {line.items.length === 0 && (
        <span
          style={{
            color: '#999',
            fontStyle: 'italic',
            cursor: readOnly ? 'default' : 'text'
          }}
          onClick={(e) => handleClick(e, 0)}
        >
          {placeholder}
        </span>
      )}

      {line.items.map((item, index) => {
        const isAtCursor = showCursor && cursorPosition === index;

        return (
          <React.Fragment key={index}>
            {/* Cursor before this item */}
            {isAtCursor && (
              <span
                className="editor-cursor"
                style={{
                  borderLeft: '2px solid var(--cursor-color)',
                  height: '1.2em',
                  animation: 'cursor-blink 1s infinite',
                  position: 'relative',
                  display: 'inline-block',
                  width: '0px',
                  marginLeft: '0px',
                  marginRight: '0px'
                }}
              />
            )}

            {item.type === 'link' ? (
              <PillLink
                href={item.url || `/${item.pageId}`}
                isPublic={item.isPublic}
                isOwned={item.isOwned}
                clickable={!readOnly}
                style={{
                  cursor: readOnly ? 'pointer' : 'grab',
                  margin: '0 1px',
                  userSelect: 'none', // Prevent text selection
                  pointerEvents: 'auto', // Ensure it's clickable
                  border: '1px solid transparent', // Subtle border for bulletproof indication
                  borderRadius: '4px'
                }}
                draggable={!readOnly}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Position cursor after the link
                  handleClick(e, index + 1);
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (readOnly) return;
                  // BULLETPROOF: Links can ONLY be edited through the modal
                  // NEVER convert to text - they are bulletproof objects
                  console.log('🔒 BULLETPROOF LINK: Double-click detected but conversion blocked');
                  console.log('💡 Use the Link Editor Modal to edit this link');
                  // TODO: Open link editor modal for this specific link
                }}
              >
                {item.text || 'Link'}
              </PillLink>
            ) : (
              <span
                style={{
                  whiteSpace: 'pre',
                  cursor: readOnly ? 'default' : 'text'
                }}
                onClick={(e) => handleClick(e, index)}
              >
                {item.char}
              </span>
            )}
          </React.Fragment>
        );
      })}

      {/* Cursor at end */}
      {showCursor && cursorPosition >= line.items.length && (
        <span
          className="editor-cursor"
          style={{
            borderLeft: '2px solid var(--cursor-color)',
            height: '1.2em',
            animation: 'cursor-blink 1s infinite',
            position: 'relative',
            display: 'inline-block',
            width: '0px',
            marginLeft: '0px',
            marginRight: '0px'
          }}
        />
      )}

      {/* Clickable area at end of line */}
      <span
        style={{
          flex: 1,
          minHeight: '1.5rem',
          cursor: readOnly ? 'default' : 'text'
        }}
        onClick={(e) => handleClick(e, line.items.length)}
      />

      <style jsx>{`
        .editor-cursor {
          --cursor-color: #000;
        }

        :global(.dark) .editor-cursor {
          --cursor-color: #fff;
        }

        .editor-line {
          transition: background-color 0.15s ease;
        }

        .editor-line-focused {
          background-color: hsl(var(--primary) / 0.05);
        }

        :global(.dark) .editor-line-focused {
          background-color: hsl(var(--primary) / 0.1);
        }

        @keyframes cursor-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

Editor.displayName = 'Editor';

export default Editor;
