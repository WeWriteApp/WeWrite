'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PillLink } from '../utils/PillLink';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertTriangle, X, Trash2, Check, Link, GripVertical } from 'lucide-react';
import LinkEditorModal from './LinkEditorModal';
import { useLogRocket } from '../../providers/LogRocketProvider';

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

  // LogRocket tracking
  const { trackDragDropLink, trackPageEdit } = useLogRocket();

  // Drag and drop state
  const [draggedLineId, setDraggedLineId] = useState<string | null>(null);
  const [dragOverLineId, setDragOverLineId] = useState<string | null>(null);

  // Link drag state
  const [draggedLink, setDraggedLink] = useState<{
    lineId: string;
    linkIndex: number;
    linkData: LinkItem;
  } | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<{
    lineId: string;
    position: number;
  } | null>(null);

  // Animation state for smooth character repositioning
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [isSqueezing, setIsSqueezing] = useState(false);

  // Physics-based animation state
  const [elementAnimations, setElementAnimations] = useState<Map<string, {
    x: number;
    targetX: number;
    velocity: number;
  }>>(new Map());

  // Undo/Redo history state
  const [history, setHistory] = useState<EditorLine[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedoOperation, setIsUndoRedoOperation] = useState(false);

  // Animation loop for smooth physics
  useEffect(() => {
    let animationFrame: number;

    const animate = () => {
      setElementAnimations(prev => {
        const newAnimations = new Map(prev);
        let hasChanges = false;

        for (const [key, animation] of newAnimations) {
          const spring = 0.15; // Spring strength
          const damping = 0.8;  // Damping factor

          const force = (animation.targetX - animation.x) * spring;
          animation.velocity = (animation.velocity + force) * damping;
          animation.x += animation.velocity;

          // Stop animation when close enough
          if (Math.abs(animation.targetX - animation.x) < 0.1 && Math.abs(animation.velocity) < 0.1) {
            animation.x = animation.targetX;
            animation.velocity = 0;
          } else {
            hasChanges = true;
          }
        }

        if (hasChanges) {
          animationFrame = requestAnimationFrame(animate);
        }

        return newAnimations;
      });
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [elementAnimations.size]);

  // Save state to history for undo functionality
  const saveToHistory = useCallback((newLines: EditorLine[]) => {
    if (isUndoRedoOperation) return; // Don't save during undo/redo operations

    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1); // Remove any future history
      newHistory.push(JSON.parse(JSON.stringify(newLines))); // Deep copy

      // Limit history to 50 entries
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }

      return newHistory;
    });

    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex, isUndoRedoOperation]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      console.log('🔄 Undo operation');
      setIsUndoRedoOperation(true);
      const previousState = history[historyIndex - 1];
      setLines(JSON.parse(JSON.stringify(previousState))); // Deep copy
      setHistoryIndex(prev => prev - 1);

      // Re-enable history saving after a brief delay
      setTimeout(() => setIsUndoRedoOperation(false), 100);
    }
  }, [history, historyIndex]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      console.log('🔄 Redo operation');
      setIsUndoRedoOperation(true);
      const nextState = history[historyIndex + 1];
      setLines(JSON.parse(JSON.stringify(nextState))); // Deep copy
      setHistoryIndex(prev => prev + 1);

      // Re-enable history saving after a brief delay
      setTimeout(() => setIsUndoRedoOperation(false), 100);
    }
  }, [history, historyIndex]);

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
      // Save current state to history before making changes
      saveToHistory(prevLines);

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
  }, [generateContent, saveToHistory]);

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

    // Track line drag start in LogRocket
    trackDragDropLink({
      action: 'start',
      linkId: lineId,
      pageId: 'current_page' // Could be enhanced with actual page ID
    });
  }, [trackDragDropLink]);

  const handleLineDragEnd = useCallback(() => {
    setDraggedLineId(null);
    setDragOverLineId(null);
  }, []);

  // Link drag handlers
  const handleLinkDragStart = useCallback((event: React.DragEvent, lineId: string, linkIndex: number) => {
    const line = lines.find(l => l.id === lineId);
    if (!line || !line.items[linkIndex] || line.items[linkIndex].type !== 'link') return;

    const linkData = line.items[linkIndex] as LinkItem;

    console.log('🔗 Link drag start:', { lineId, linkIndex, linkText: linkData.text });
    console.log('🔗 Setting draggedLink state...');

    // Track link drag start in LogRocket
    trackDragDropLink({
      action: 'start',
      linkId: linkData.pageId || linkData.text,
      fromPosition: linkIndex,
      pageId: 'current_page' // Could be enhanced with actual page ID
    });

    // Disable text selection during link drag
    document.body.style.userSelect = 'none';

    setDraggedLink({
      lineId,
      linkIndex,
      linkData
    });

    // Set drag data
    event.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'link',
      lineId,
      linkIndex,
      linkData
    }));
    event.dataTransfer.effectAllowed = 'move';

    // Prevent line drag when dragging a link
    event.stopPropagation();

    console.log('🔗 Drag start complete');
  }, [lines]);

  const handleLinkDragEnd = useCallback(() => {
    console.log('🔗 Link drag end - collapsing all gaps');

    // Track link drag end in LogRocket
    trackDragDropLink({
      action: 'drop',
      pageId: 'current_page' // Could be enhanced with actual page ID
    });

    setDraggedLink(null);
    setDragOverPosition(null);

    // Reset all animations to 0 to collapse any gaps
    setElementAnimations(prev => {
      const newAnimations = new Map(prev);
      for (const [, animation] of newAnimations) {
        animation.targetX = 0; // Collapse back to natural position
      }
      console.log(`🔗 Resetting ${newAnimations.size} element animations to collapse gaps`);
      return newAnimations;
    });

    // Re-enable text selection
    document.body.style.userSelect = '';
  }, [trackDragDropLink]);

  // Function to trigger physics animations
  const triggerElementAnimations = useCallback((lineId: string, dropPosition: number) => {
    console.log('🔗 Triggering physics animations for line:', lineId, 'position:', dropPosition);

    setElementAnimations(prev => {
      const newAnimations = new Map(prev);

      // First, reset all other lines to natural positions (collapse any gaps)
      lines.forEach(line => {
        if (line.id !== lineId) {
          line.items.forEach((item, index) => {
            const elementKey = `${line.id}-${index}`;
            const current = newAnimations.get(elementKey) || { x: 0, targetX: 0, velocity: 0 };
            current.targetX = 0; // Reset to natural position
            newAnimations.set(elementKey, current);
          });
        }
      });

      // Find the target line and animate elements
      const targetLine = lines.find(l => l.id === lineId);
      if (!targetLine) return prev;

      const linkWidth = draggedLink ? Math.max(60, (draggedLink.linkData.text?.length || 4) * 8) : 60;

      targetLine.items.forEach((item, index) => {
        const elementKey = `${lineId}-${index}`;

        let targetX = 0;
        if (index >= dropPosition) {
          // Elements after drop position move right
          targetX = linkWidth + 10;
        }

        // Initialize or update animation
        const current = newAnimations.get(elementKey) || { x: 0, targetX: 0, velocity: 0 };
        current.targetX = targetX;

        newAnimations.set(elementKey, current);

        console.log(`🔗 Element ${index} target position: ${targetX}px`);
      });

      return newAnimations;
    });
  }, [lines, draggedLink]);

  const handleLinkDragOver = useCallback((event: React.DragEvent, lineId: string, position: number) => {
    if (!draggedLink) {
      console.log('🔗 Link drag over: No draggedLink');
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    console.log('🔗 Link drag over:', {
      lineId,
      position,
      draggedLink: draggedLink.linkData.text,
      currentDragOverPosition: dragOverPosition
    });
    setDragOverPosition({ lineId, position });

    // Trigger physics animations
    triggerElementAnimations(lineId, position);

    // Prevent line drag over when dragging a link
    event.stopPropagation();
  }, [draggedLink, dragOverPosition]);

  const handleLinkDrop = useCallback((event: React.DragEvent, targetLineId: string, targetPosition: number) => {
    if (!draggedLink) return;

    event.preventDefault();
    event.stopPropagation();

    const { lineId: sourceLineId, linkIndex: sourceLinkIndex, linkData } = draggedLink;

    console.log('🔗 Link drop:', {
      from: { lineId: sourceLineId, index: sourceLinkIndex },
      to: { lineId: targetLineId, position: targetPosition },
      linkText: linkData.text
    });

    // Don't drop on the same position
    if (sourceLineId === targetLineId && sourceLinkIndex === targetPosition) {
      console.log('🔗 Drop cancelled: same position');
      setDraggedLink(null);
      setDragOverPosition(null);
      return;
    }

    console.log('🔗 Starting squeeze-back animation...');

    // Apply the DOM change immediately and store the result
    let finalUpdatedLines: EditorLine[] = [];

    setLines(prevLines => {
      const updatedLines = [...prevLines];

      // Remove link from source position
      const sourceLineIndex = updatedLines.findIndex(l => l.id === sourceLineId);
      if (sourceLineIndex === -1) return prevLines;

      const sourceLine = updatedLines[sourceLineIndex];
      if (!sourceLine || !sourceLine.items) return prevLines;

      const newSourceItems = [...sourceLine.items];
      newSourceItems.splice(sourceLinkIndex, 1);
      updatedLines[sourceLineIndex] = {
        ...sourceLine,
        items: newSourceItems
      };

      // Insert link at target position
      const targetLineIndex = updatedLines.findIndex(l => l.id === targetLineId);
      if (targetLineIndex === -1) return prevLines;

      const targetLine = updatedLines[targetLineIndex];
      if (!targetLine || !targetLine.items) return prevLines;

      const newTargetItems = [...targetLine.items];

      // Adjust target position if we're moving within the same line and the target is after the source
      let adjustedTargetPosition = targetPosition;
      if (sourceLineId === targetLineId && targetPosition > sourceLinkIndex) {
        adjustedTargetPosition = targetPosition - 1;
      }

      newTargetItems.splice(adjustedTargetPosition, 0, linkData);
      updatedLines[targetLineIndex] = {
        ...targetLine,
        items: newTargetItems
      };

      finalUpdatedLines = updatedLines;
      return updatedLines;
    });

    // Reset animations for both source and target lines to collapse characters
    setElementAnimations(prev => {
      const newAnimations = new Map(prev);

      // Reset all elements in source line to collapse the gap
      const sourceLine = finalUpdatedLines.find(l => l.id === sourceLineId);
      if (sourceLine) {
        sourceLine.items.forEach((item, index) => {
          const elementKey = `${sourceLineId}-${index}`;
          const current = newAnimations.get(elementKey) || { x: 0, targetX: 0, velocity: 0 };
          current.targetX = 0; // Collapse back to natural position
          newAnimations.set(elementKey, current);
        });
        console.log(`🔗 Resetting ${sourceLine.items.length} elements in source line ${sourceLineId} to collapse`);
      }

      // Reset all elements in target line to natural positions
      if (sourceLineId !== targetLineId) {
        const targetLine = finalUpdatedLines.find(l => l.id === targetLineId);
        if (targetLine) {
          targetLine.items.forEach((item, index) => {
            const elementKey = `${targetLineId}-${index}`;
            const current = newAnimations.get(elementKey) || { x: 0, targetX: 0, velocity: 0 };
            current.targetX = 0; // Natural position
            newAnimations.set(elementKey, current);
          });
          console.log(`🔗 Resetting ${targetLine.items.length} elements in target line ${targetLineId} to natural positions`);
        }
      }

      return newAnimations;
    });

    // Call generateContent after state update completes
    setTimeout(() => {
      generateContent(finalUpdatedLines);
    }, 0);

    // Trigger squeeze-back animation
    setIsSqueezing(true);

    // Reset squeeze animation after completion
    setTimeout(() => {
      setIsSqueezing(false);
    }, 1000); // 1 second for squeeze animation

    setDraggedLink(null);
    setDragOverPosition(null);
  }, [draggedLink, generateContent]);

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

  // Keyboard handler for undo/redo at the main Editor level
  const handleEditorKeyDown = (event: React.KeyboardEvent) => {
    // Cmd+Z: Undo
    if (event.key === 'z' && event.metaKey && !event.shiftKey) {
      event.preventDefault();
      handleUndo();
      return;
    }

    // Cmd+Shift+Z: Redo
    if (event.key === 'z' && event.metaKey && event.shiftKey) {
      event.preventDefault();
      handleRedo();
      return;
    }
  };

  return (
    <div
      className="character-editor"
      style={{ fontFamily: 'inherit' }}
      onKeyDown={handleEditorKeyDown}
      tabIndex={-1} // Make div focusable for keyboard events
    >
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
              // Link drag handlers
              onLinkDragStart={handleLinkDragStart}
              onLinkDragEnd={handleLinkDragEnd}
              onLinkDragOver={handleLinkDragOver}
              onLinkDrop={handleLinkDrop}
              draggedLink={draggedLink}
              dragOverPosition={dragOverPosition}
              // Animation state
              isRepositioning={isRepositioning}
              isSqueezing={isSqueezing}
              elementAnimations={elementAnimations}
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

          {/* Cancel button */}
          {onCancel && (
            <Button
              variant="outline"
              size="lg"
              onClick={onCancel}
              disabled={isSaving}
              className="gap-2 w-full rounded-2xl font-medium border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              Cancel
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
  // Link drag handlers
  onLinkDragStart: (event: React.DragEvent, lineId: string, linkIndex: number) => void;
  onLinkDragEnd: () => void;
  onLinkDragOver: (event: React.DragEvent, lineId: string, position: number) => void;
  onLinkDrop: (event: React.DragEvent, lineId: string, position: number) => void;
  draggedLink: { lineId: string; linkIndex: number; linkData: LinkItem } | null;
  dragOverPosition: { lineId: string; position: number } | null;
  // Animation state
  isRepositioning: boolean;
  isSqueezing: boolean;
  elementAnimations: Map<string, { x: number; targetX: number; velocity: number }>;
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
  onVerticalMove,
  // Link drag handlers
  onLinkDragStart,
  onLinkDragEnd,
  onLinkDragOver,
  onLinkDrop,
  draggedLink,
  dragOverPosition,
  // Animation state
  isRepositioning,
  isSqueezing,
  elementAnimations
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if line has links
  const hasLinks = line.items.some(item => item.type === 'link');

  return (
    <div
      className={(() => {
        const classes = [];
        if (isFocused) classes.push('editor-line-focused');
        if (draggedLink) {
          classes.push('dragging-link');
          console.log(`🔗 Line ${line.id} has dragging-link class`);
        }
        if (isRepositioning) classes.push('repositioning');
        if (isSqueezing) classes.push('squeezing');
        return `editor-line ${classes.join(' ')}`;
      })()}
      data-line-id={line.id}
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
      draggable={!readOnly && !draggedLink} // Don't make line draggable when dragging a link
      onDragStart={(e) => {
        if (!draggedLink) {
          onLineDragStart(e, line.id);
        }
      }}
      onDragEnd={onLineDragEnd}
      onDragOver={(e) => {
        if (draggedLink) {
          // When dragging a link, treat the whole line as a drop zone for the end position
          onLinkDragOver(e, line.id, line.items.length);
        } else {
          onLineDragOver(e, line.id);
        }
      }}
      onDrop={(e) => {
        if (draggedLink) {
          console.log('🔗 Line onDrop triggered (fallback):', { lineId: line.id, position: line.items.length });
          onLinkDrop(e, line.id, line.items.length);
        } else {
          onLineDrop(e, line.id);
        }
      }}
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

      {/* Content area with smooth animations */}
      <div style={{
        flex: 1,
        minHeight: '1.5rem',
        transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      }}>
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
          onLinkDragStart={onLinkDragStart}
          onLinkDragEnd={onLinkDragEnd}
          onLinkDragOver={onLinkDragOver}
          onLinkDrop={onLinkDrop}
          draggedLink={draggedLink}
          dragOverPosition={dragOverPosition}
          elementAnimations={elementAnimations}
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
  // Link drag handlers
  onLinkDragStart: (event: React.DragEvent, lineId: string, linkIndex: number) => void;
  onLinkDragEnd: () => void;
  onLinkDragOver: (event: React.DragEvent, lineId: string, position: number) => void;
  onLinkDrop: (event: React.DragEvent, lineId: string, position: number) => void;
  draggedLink: { lineId: string; linkIndex: number; linkData: LinkItem } | null;
  dragOverPosition: { lineId: string; position: number } | null;
  elementAnimations: Map<string, { x: number; targetX: number; velocity: number }>;

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
  isFocused,
  onLinkDragStart,
  onLinkDragEnd,
  onLinkDragOver,
  onLinkDrop,
  draggedLink,
  dragOverPosition,
  elementAnimations
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

    // Option+Delete: Delete whole word
    if (event.key === 'Backspace' && event.altKey) {
      event.preventDefault();
      console.log('🔗 Option+Delete: Deleting whole word');

      // Find the start of the current word
      let wordStart = cursorPosition;
      while (wordStart > 0) {
        const item = line.items[wordStart - 1];
        if (item && item.type === 'char' && /\s/.test(item.char)) {
          break; // Stop at whitespace
        }
        if (item && item.type === 'link') {
          break; // Stop at links (don't delete them)
        }
        wordStart--;
      }

      // Delete characters from wordStart to cursor (but preserve links)
      if (wordStart < cursorPosition) {
        setLines(prevLines => {
          // History saving handled at the main Editor level

          const updatedLines = prevLines.map(lineItem => {
            if (lineItem.id === line.id) {
              const newItems = [...lineItem.items];
              // Only delete characters, skip links
              for (let i = cursorPosition - 1; i >= wordStart; i--) {
                const item = newItems[i];
                if (item && item.type === 'char') {
                  newItems.splice(i, 1);
                }
              }
              return { ...lineItem, items: newItems };
            }
            return lineItem;
          });

          generateContent(updatedLines);
          return updatedLines;
        });

        // Move cursor to word start
        setCursorPosition(wordStart);
        onCursorChange(wordStart);
      }
      return;
    }

    // Cmd+Delete: Delete whole line
    if (event.key === 'Backspace' && event.metaKey) {
      event.preventDefault();
      console.log('🔗 Cmd+Delete: Deleting whole line');

      // Clear all items in the line (but preserve the line structure)
      setLines(prevLines => {
        // History saving handled at the main Editor level

        const updatedLines = prevLines.map(lineItem => {
          if (lineItem.id === line.id) {
            return { ...lineItem, items: [] };
          }
          return lineItem;
        });

        generateContent(updatedLines);
        return updatedLines;
      });

      // Move cursor to start of line
      setCursorPosition(0);
      onCursorChange(0);
      return;
    }

    // Undo/Redo handled at the main Editor level, not here

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
        const isLinkBeingDragged = draggedLink && draggedLink.lineId === line.id && draggedLink.linkIndex === index;
        const isDropZone = dragOverPosition && dragOverPosition.lineId === line.id && dragOverPosition.position === index;

        return (
          <React.Fragment key={index}>
            {/* Blue cursor drop indicator */}
            {draggedLink && isDropZone && (
              <span
                style={{
                  display: 'inline-block',
                  width: '2px',
                  height: '20px',
                  backgroundColor: '#3b82f6',
                  marginRight: '2px',
                  verticalAlign: 'baseline',
                  animation: 'pulse 1s infinite'
                }}
                onDragOver={(e) => {
                  if (!readOnly && draggedLink) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    onLinkDragOver(e, line.id, index);
                  }
                }}
                onDrop={(e) => {
                  console.log('🔗 Drop zone onDrop triggered:', { lineId: line.id, position: index, draggedLink: !!draggedLink });
                  if (!readOnly && draggedLink) {
                    onLinkDrop(e, line.id, index);
                  }
                }}
              />
            )}

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



            <div
              data-item-index={index}
              style={(() => {
                const elementKey = `${line.id}-${index}`;
                const animation = elementAnimations.get(elementKey);
                const translateX = animation ? animation.x : 0;

                if (translateX !== 0) {
                  console.log(`🔗 Animating element ${index}: translateX(${translateX}px)`);
                }

                return {
                  display: 'inline',
                  transform: `translateX(${translateX}px)`,
                  transition: 'none', // Disable CSS transitions, use physics instead
                  willChange: 'transform', // Optimize for animations
                  whiteSpace: 'pre-wrap', // Allow wrapping within elements
                  wordWrap: 'break-word' // Break long words if needed
                };
              })()}
            >
              {item.type === 'link' ? (
                <PillLink
                  href={item.url || `/${item.pageId}`}
                  isPublic={item.isPublic}
                  isOwned={item.isOwned}
                  clickable={!readOnly}
                  style={{
                    cursor: readOnly ? 'pointer' : (isLinkBeingDragged ? 'grabbing' : 'grab'),
                    margin: '0 1px',
                    userSelect: 'none', // Prevent text selection
                    pointerEvents: 'auto', // Always keep interactive for dragging
                    border: '1px solid transparent', // Subtle border for bulletproof indication
                    borderRadius: '4px',
                    // Completely hide the source link when dragging
                    visibility: isLinkBeingDragged ? 'hidden' : 'visible',
                    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                  }}
                  draggable={!readOnly}
                  onDragStart={(e: React.DragEvent) => {
                    console.log('🔗 PillLink onDragStart called', { readOnly, lineId: line.id, index });
                    if (!readOnly) {
                      onLinkDragStart(e, line.id, index);
                    } else {
                      console.log('🔗 Preventing drag in read-only mode');
                      e.preventDefault(); // Prevent drag in read-only mode
                    }
                  }}
                  onDragEnd={(e: React.DragEvent) => {
                    if (!readOnly) {
                      onLinkDragEnd();
                    }
                  }}
                  onDragOver={(e: React.DragEvent) => {
                    if (!readOnly && draggedLink) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      onLinkDragOver(e, line.id, index);
                    }
                  }}
                  onDrop={(e: React.DragEvent) => {
                    console.log('🔗 PillLink onDrop triggered:', { lineId: line.id, index, draggedLink: !!draggedLink });
                    if (!readOnly && draggedLink) {
                      onLinkDrop(e, line.id, index);
                    }
                  }}
                  onClick={(e: any) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Position cursor after the link
                    handleClick(e, index + 1);
                  }}
                  onDoubleClick={(e: any) => {
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
                    cursor: readOnly ? 'default' : 'text',
                    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    display: 'inline-block'
                  }}
                  onClick={(e) => handleClick(e, index)}
                  onDragOver={(e) => {
                    if (!readOnly && draggedLink) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      onLinkDragOver(e, line.id, index);
                    }
                  }}
                  onDrop={(e) => {
                    console.log('🔗 Span onDrop triggered:', { lineId: line.id, index, draggedLink: !!draggedLink });
                    if (!readOnly && draggedLink) {
                      onLinkDrop(e, line.id, index);
                    }
                  }}
                >
                  {item.char}
                </span>
              )}
            </div>
          </React.Fragment>
        );
      })}

      {/* Blue cursor at end of line */}
      {draggedLink && dragOverPosition && dragOverPosition.lineId === line.id && dragOverPosition.position >= line.items.length && (
        <span
          style={{
            display: 'inline-block',
            width: '2px',
            height: '20px',
            backgroundColor: '#3b82f6',
            marginRight: '2px',
            verticalAlign: 'baseline',
            animation: 'pulse 1s infinite'
          }}
          onDragOver={(e) => {
            if (!readOnly && draggedLink) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              onLinkDragOver(e, line.id, line.items.length);
            }
          }}
          onDrop={(e) => {
            console.log('🔗 End drop zone onDrop triggered:', { lineId: line.id, position: line.items.length, draggedLink: !!draggedLink });
            if (!readOnly && draggedLink) {
              onLinkDrop(e, line.id, line.items.length);
            }
          }}
        />
      )}

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
        onDragOver={(e) => {
          if (!readOnly && draggedLink) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            onLinkDragOver(e, line.id, line.items.length);
          }
        }}
        onDrop={(e) => {
          console.log('🔗 End-of-line area onDrop triggered:', { lineId: line.id, position: line.items.length, draggedLink: !!draggedLink });
          if (!readOnly && draggedLink) {
            onLinkDrop(e, line.id, line.items.length);
          }
        }}
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

        /* Drag and drop animations */
        @keyframes cursor-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }



        /* Smooth transitions for all elements */
        :global(.pill-link) {
          transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        /* Visual feedback during drag */
        :global(.pill-link[draggable="true"]:hover) {
          transform: scale(1.02);
        }

        /* Real-time drag animations - smooth and responsive */
        .editor-line {
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .editor-line * {
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        /* Enhanced drop zone animations with spring effect */
        .drop-zone-container {
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* Real-time character spreading during drag */
        .editor-line.dragging-link [data-item-index] {
          transition: transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        /* Characters move apart when drop zone appears */
        .editor-line.dragging-link [data-item-index].push-right {
          transform: translateX(var(--push-distance, 80px));
        }

        .editor-line.dragging-link [data-item-index].push-left {
          transform: translateX(var(--push-distance, -20px));
        }

        /* Squeeze back together after drop - spring animation */
        .editor-line.squeezing [data-item-index] {
          transition: transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
          transform: translateX(0) !important;
        }

        /* Staggered squeeze animation for natural flow */
        .editor-line.squeezing [data-item-index]:nth-child(1) { transition-delay: 0ms; }
        .editor-line.squeezing [data-item-index]:nth-child(2) { transition-delay: 50ms; }
        .editor-line.squeezing [data-item-index]:nth-child(3) { transition-delay: 100ms; }
        .editor-line.squeezing [data-item-index]:nth-child(4) { transition-delay: 150ms; }
        .editor-line.squeezing [data-item-index]:nth-child(5) { transition-delay: 200ms; }
        .editor-line.squeezing [data-item-index]:nth-child(6) { transition-delay: 250ms; }
        .editor-line.squeezing [data-item-index]:nth-child(7) { transition-delay: 300ms; }
        .editor-line.squeezing [data-item-index]:nth-child(8) { transition-delay: 350ms; }
        .editor-line.squeezing [data-item-index]:nth-child(9) { transition-delay: 400ms; }
        .editor-line.squeezing [data-item-index]:nth-child(10) { transition-delay: 450ms; }

        @keyframes characterSlide {
          0% {
            transform: translateX(-20px) scale(0.95);
            opacity: 0.6;
            background-color: rgba(59, 130, 246, 0.1);
          }
          25% {
            transform: translateX(10px) scale(1.05);
            opacity: 0.8;
            background-color: rgba(59, 130, 246, 0.2);
          }
          75% {
            transform: translateX(-5px) scale(1.02);
            opacity: 0.9;
            background-color: rgba(59, 130, 246, 0.1);
          }
          100% {
            transform: translateX(0) scale(1);
            opacity: 1;
            background-color: transparent;
          }
        }

        /* Make repositioning VERY obvious */
        .editor-line.repositioning {
          background-color: rgba(59, 130, 246, 0.05) !important;
          border-left: 3px solid rgba(59, 130, 246, 0.3) !important;
          padding-left: 8px !important;
          margin-left: -8px !important;
          border-radius: 4px !important;
        }

        /* Blue cursor pulse animation */
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* Word wrapping for editor lines */
        .editor-line {
          word-wrap: break-word;
          overflow-wrap: break-word;
          white-space: pre-wrap;
          max-width: 100%;
        }

        /* Ensure inline elements can wrap */
        .editor-line [data-item-index] {
          display: inline;
          white-space: pre-wrap;
        }

        /* Prevent text selection during link drag */
        .editor-line.dragging-link {
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        /* Ensure pill links are always draggable */
        :global(.pill-link) {
          -webkit-user-drag: element;
          -khtml-user-drag: element;
          -moz-user-drag: element;
          -o-user-drag: element;
          user-drag: element;
        }
      `}</style>
    </div>
  );
};

Editor.displayName = 'Editor';

export default Editor;
