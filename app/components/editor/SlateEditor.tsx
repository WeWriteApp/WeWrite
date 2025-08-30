/**
 * SlateEditor - A proper rich text editor with inline link support using Slate.js
 *
 * This replaces the hacky textarea + overlay approach with proper inline elements
 * that are treated as first-class citizens in the text flow.
 *
 * Features:
 * - Proper inline link elements using Slate's inline support
 * - Cursor can move around links naturally
 * - Links are editable objects within the text
 * - No overlay hacks or positioning issues
 *
 * @author WeWrite Team
 * @version 3.0.0
 */

'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createEditor, Descendant, Element as SlateElement, Text, Transforms, Editor, Range, Point, Node, Location } from 'slate';
import { Slate, Editable, withReact, ReactEditor, useSlateStatic, RenderElementProps, RenderLeafProps } from 'slate-react';
import { withHistory } from 'slate-history';
import PillLink from '../utils/PillLink';
import { Button } from '../ui/button';
import { Link, Trash2 } from 'lucide-react';
import LinkEditorModal from './LinkEditorModal';
import LinkSuggestionEditorModal from './LinkSuggestionEditorModal';
import { useLinkSuggestions } from '../../hooks/useLinkSuggestions';
import { LinkSuggestionModal } from '../modals/LinkSuggestionModal';
import { LinkSuggestion } from '../../services/linkSuggestionService';
import { useAuth } from '../../providers/AuthProvider';
import { getPageById } from '../../utils/apiClient';
import { LinkNodeHelper } from '../../types/linkNode';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Custom Slate element types
 */
type ParagraphElement = {
  type: 'paragraph';
  children: Descendant[];
};

type LinkElement = {
  type: 'link';
  url?: string;
  pageId?: string;
  pageTitle?: string;
  originalPageTitle?: string; // Track original title for propagation
  isExternal: boolean;
  isPublic: boolean;
  isOwned: boolean;
  isSuggestion?: boolean; // New flag for link suggestions
  suggestionData?: any; // Store original suggestion data for confirmation
  isNew?: boolean; // Flag for new pages that need to be created
  children: Descendant[];
};

type CustomElement = ParagraphElement | LinkElement;

type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

declare module 'slate' {
  interface CustomTypes {
    Editor: ReactEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

// ============================================================================
// SLATE EDITOR CONFIGURATION
// ============================================================================

/**
 * Custom plugin to handle link deletion as single units
 * Links should only be deleted when the cursor is immediately adjacent to them
 */
const withLinkDeletion = (editor: ReactEditor) => {
  const { deleteBackward, deleteForward } = editor;

  editor.deleteBackward = (unit) => {
    const { selection } = editor;

    if (selection && Range.isCollapsed(selection)) {
      // Check if we're inside a link and at the start - delete the whole link
      const [linkMatch] = Editor.nodes(editor, {
        match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'link',
        mode: 'highest',
      });

      if (linkMatch) {
        const [, linkPath] = linkMatch;
        const start = Editor.start(editor, linkPath);

        // If cursor is at the start of a link, delete the entire link
        if (Point.equals(selection.anchor, start)) {
          Transforms.removeNodes(editor, { at: linkPath });
          return;
        }
      }

      // FIXED: Only delete link if cursor is IMMEDIATELY after it (offset 0 in next text node)
      try {
        const [parentNode, parentPath] = Editor.parent(editor, selection);
        if (SlateElement.isElement(parentNode) && parentNode.type === 'paragraph') {
          const currentIndex = selection.anchor.path[selection.anchor.path.length - 1];
          const currentOffset = selection.anchor.offset;

          // Only proceed if we're at the very beginning of a text node (offset 0)
          if (currentOffset === 0 && currentIndex > 0) {
            const prevSiblingPath = [...parentPath, currentIndex - 1];
            const [prevSibling] = Editor.node(editor, prevSiblingPath);

            if (SlateElement.isElement(prevSibling) && prevSibling.type === 'link') {
              // We're at the very beginning of text immediately after a link
              Transforms.removeNodes(editor, { at: prevSiblingPath });
              return;
            }
          }
        }
      } catch (e) {
        // Continue with normal deletion if path operations fail
      }
    }

    deleteBackward(unit);
  };

  editor.deleteForward = (unit) => {
    const { selection } = editor;

    if (selection && Range.isCollapsed(selection)) {
      // Check if we're inside a link and at the end - delete the whole link
      const [linkMatch] = Editor.nodes(editor, {
        match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'link',
        mode: 'highest',
      });

      if (linkMatch) {
        const [, linkPath] = linkMatch;
        const end = Editor.end(editor, linkPath);

        // If cursor is at the end of a link, delete the entire link
        if (Point.equals(selection.anchor, end)) {
          Transforms.removeNodes(editor, { at: linkPath });
          return;
        }
      }

      // FIXED: Only delete link if cursor is IMMEDIATELY before it (at end of previous text node)
      try {
        const [parentNode, parentPath] = Editor.parent(editor, selection);
        if (SlateElement.isElement(parentNode) && parentNode.type === 'paragraph') {
          const currentIndex = selection.anchor.path[selection.anchor.path.length - 1];

          // Check if we're at the end of a text node and there's a next sibling that's a link
          const currentNode = Editor.node(editor, selection.anchor.path)[0];
          if (currentNode && typeof currentNode === 'object' && 'text' in currentNode) {
            const textLength = currentNode.text.length;

            // Only proceed if we're at the very end of the current text node
            if (selection.anchor.offset === textLength) {
              const nextSiblingPath = [...parentPath, currentIndex + 1];
              try {
                const [nextSibling] = Editor.node(editor, nextSiblingPath);

                if (SlateElement.isElement(nextSibling) && nextSibling.type === 'link') {
                  // We're at the very end of text immediately before a link
                  Transforms.removeNodes(editor, { at: nextSiblingPath });
                  return;
                }
              } catch (e) {
                // Next sibling doesn't exist, continue with normal deletion
              }
            }
          }
        }
      } catch (e) {
        // Continue with normal deletion if path operations fail
      }
    }

    deleteForward(unit);
  };

  return editor;
};

/**
 * Create a Slate editor with React and History plugins
 */
const createSlateEditor = () => {
  const editor = withLinkDeletion(withHistory(withReact(createEditor())));

  // Override isInline to treat link elements as inline
  const { isInline } = editor;
  editor.isInline = (element) => {
    return element.type === 'link' ? true : isInline(element);
  };

  // Override isVoid - links are not void, they contain text
  const { isVoid } = editor;
  editor.isVoid = (element) => {
    return element.type === 'link' ? false : isVoid(element);
  };

  return editor;
};

/**
 * Convert our content format to Slate format
 */
const contentToSlate = (content: any): Descendant[] => {
  console.log('🔍 contentToSlate: Input content:', { content, type: typeof content, isArray: Array.isArray(content) });

  // Handle non-array content
  if (!content) {
    console.log('🔍 contentToSlate: Null/undefined content, returning default paragraph');
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }

  // Convert non-array content to array
  if (!Array.isArray(content)) {
    console.log('🔍 contentToSlate: Non-array content, converting to array');
    if (typeof content === 'string') {
      // CRITICAL FIX: Try to parse JSON string first
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          console.log('🔧 contentToSlate: Successfully parsed JSON string to array');
          return parsed;
        } else {
          console.log('🔧 contentToSlate: Parsed JSON but not array, treating as text');
          return [{ type: 'paragraph', children: [{ text: content }] }];
        }
      } catch (e) {
        // Not JSON, treat as plain text
        console.log('🔧 contentToSlate: Not JSON, treating as plain text');
        return [{ type: 'paragraph', children: [{ text: content }] }];
      }
    } else if (typeof content === 'object') {
      // Handle object content - try to extract meaningful data
      if (content.type === 'paragraph' && content.children) {
        return [content];
      } else if (content.text !== undefined) {
        return [{ type: 'paragraph', children: [{ text: content.text }] }];
      } else {
        // Fallback for unknown object structure
        console.warn('🔍 contentToSlate: Unknown object structure, using fallback');
        return [{ type: 'paragraph', children: [{ text: JSON.stringify(content) }] }];
      }
    } else {
      // Fallback for other types
      console.warn('🔍 contentToSlate: Unknown content type, using fallback');
      return [{ type: 'paragraph', children: [{ text: String(content) }] }];
    }
  }

  if (content.length === 0) {
    console.log('🔍 contentToSlate: Empty array, returning default paragraph');
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }

  return content.map((node, index) => {
    console.log(`🔍 contentToSlate: Processing node ${index}:`, { node, type: typeof node });

    // Safety check to prevent hydration mismatches
    if (!node || typeof node !== 'object') {
      console.warn(`🔍 contentToSlate: Invalid node at index ${index}, creating default paragraph`);
      return { type: 'paragraph', children: [{ text: '' }] };
    }

    if (node.type === 'paragraph') {
      const children: Descendant[] = [];

      // Handle new format with children array
      if (node.children && Array.isArray(node.children) && node.children.length > 0) {
        node.children.forEach((child: any, childIndex: number) => {
          console.log(`🔍 contentToSlate: Processing child ${childIndex}:`, { child });

          // Safety check for child objects
          if (!child || typeof child !== 'object') {
            console.warn(`🔍 contentToSlate: Invalid child at index ${childIndex}, skipping`);
            return;
          }

          if (child.type === 'link') {
            children.push({
              type: 'link',
              url: child.url,
              pageId: child.pageId,
              pageTitle: child.pageTitle,
              isExternal: child.isExternal || false,
              isPublic: child.isPublic || true,
              isOwned: child.isOwned || false,
              children: [{ text: child.text || child.children?.[0]?.text || 'Link' }]
            });
          } else if (child.text !== undefined) {
            children.push({ text: child.text });
          }
        });
      }
      // Handle legacy format where text might be directly on the paragraph
      else if (node.text !== undefined) {
        console.log('🔍 contentToSlate: Legacy format detected - text directly on paragraph');
        children.push({ text: node.text });
      }
      // Handle legacy format where content might be a string
      else if (typeof node.content === 'string') {
        console.log('🔍 contentToSlate: Legacy format detected - content as string');
        children.push({ text: node.content });
      }

      if (children.length === 0) {
        console.log('🔍 contentToSlate: No children found, adding empty text');
        children.push({ text: '' });
      }

      console.log(`🔍 contentToSlate: Created paragraph with ${children.length} children:`, children);
      return {
        type: 'paragraph',
        children
      };
    }

    // Handle legacy format where node might be a string
    if (typeof node === 'string') {
      console.log('🔍 contentToSlate: Legacy format detected - node is string');
      return {
        type: 'paragraph',
        children: [{ text: node }]
      };
    }

    // Fallback for other node types
    console.log('🔍 contentToSlate: Unknown node type, using fallback');
    return {
      type: 'paragraph',
      children: [{ text: typeof node === 'string' ? node : '' }]
    };
  });
};

/**
 * Convert Slate format back to our content format
 */
const slateToContent = (value: Descendant[]): any[] => {
  return value.map((node) => {
    if (SlateElement.isElement(node) && node.type === 'paragraph') {
      const children: any[] = [];

      node.children.forEach((child) => {
        if (SlateElement.isElement(child) && child.type === 'link') {
          const linkText = child.children.map((c: any) => c.text).join('');
          children.push({
            type: 'link',
            text: linkText,
            url: child.url,
            pageId: child.pageId,
            pageTitle: child.pageTitle,
            isExternal: child.isExternal,
            isPublic: child.isPublic,
            isOwned: child.isOwned,
            children: [{ text: linkText }]
          });
        } else if (Text.isText(child)) {
          children.push({ text: child.text });
        }
      });

      return {
        type: 'paragraph',
        children
      };
    }

    return {
      type: 'paragraph',
      children: [{ text: '' }]
    };
  });
};

// ============================================================================
// RENDER COMPONENTS
// ============================================================================

/**
 * Render text leaves (for formatting like bold, italic, and link suggestions)
 */
const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>;
  }

  if (leaf.italic) {
    children = <em>{children}</em>;
  }

  // Highlight text that has link suggestions
  if ((leaf as any).linkSuggestion) {
    children = (
      <span
        className="bg-primary/10 border-b-2 border-primary cursor-pointer hover:bg-primary/20 transition-colors"
        title="Click to see link suggestions"
      >
        {children}
      </span>
    );
  }

  return <span {...attributes}>{children}</span>;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface SlateEditorProps {
  initialContent?: any;
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
  onInsertLinkRequest?: (triggerFn: () => void) => void; // Callback to register link insertion trigger

  // Page context for link suggestions
  pageId?: string;
}

const SlateEditor: React.FC<SlateEditorProps> = ({
  initialContent = null,
  onChange,
  onEmptyLinesChange,
  placeholder = 'Start writing...',
  readOnly = false,
  location,
  setLocation,
  onSave,
  onCancel,
  onDelete,
  isSaving = false,
  error,
  isNewPage = false,
  showToolbar = true,
  onInsertLinkRequest,
  pageId
}) => {
  console.warn('🔗 SLATE_EDITOR: Component initialized with props:', {
    pageId,
    readOnly,
    placeholder,
    hasInitialContent: !!initialContent?.length
  });

  // Remove any editing indicators from title for clean UX
  if (typeof window !== 'undefined') {
    document.title = document.title.replace('🔗 EDITING: ', '');
  }

  // Prevent hydration mismatches by ensuring client-side rendering
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  const editor = useMemo(() => createSlateEditor(), []);
  // Create safe initial value for Slate
  const safeInitialValue = useMemo(() => {
    console.log('🔍 SlateEditor: Creating safe initial value', { initialContent, type: typeof initialContent });
    try {
      const slateValue = contentToSlate(initialContent);
      console.log('🔍 SlateEditor: Slate value after conversion', { slateValue, length: slateValue.length });
      // Ensure we always have at least one paragraph
      const result = slateValue.length > 0 ? slateValue : [{ type: 'paragraph', children: [{ text: '' }] }];
      console.log('🔍 SlateEditor: Final safe initial value', { result });
      return result;
    } catch (error) {
      console.error('❌ SlateEditor: Error initializing Slate value:', error);
      // Fallback to empty paragraph
      const fallback = [{ type: 'paragraph', children: [{ text: '' }] }];
      console.log('🔍 SlateEditor: Using fallback value', { fallback });
      return fallback;
    }
  }, [initialContent]);

  // Track current value for controlled updates
  const [value, setValue] = useState<Descendant[]>(() => {
    console.log('🔍 SlateEditor: Initializing useState with', { safeInitialValue });
    return safeInitialValue;
  });
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState<LinkSuggestion | null>(null);
  const [suggestionMatchedText, setSuggestionMatchedText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Get current user for link suggestions
  const { user } = useAuth();

  // RE-ENABLED: Simple link suggestion functionality (manual trigger only)
  const {
    state: linkSuggestionState,
    actions: linkSuggestionActions
  } = useLinkSuggestions({
    enabled: !readOnly, // Always enabled when not read-only (focus not required)
    minConfidence: 0.6,
    debounceDelay: 1000, // Longer delay to prevent excessive API calls
    onSuggestionSelected: (suggestion) => {
      console.log('🔗 SLATE_EDITOR: Suggestion selected:', suggestion);
      // Handle suggestion selection here
    }
  });

  // Debug link suggestion state
  console.warn('🔗 SLATE_EDITOR: Link suggestion hook initialized:', {
    enabled: !readOnly && isFocused,
    readOnly,
    isFocused,
    isEnabled: linkSuggestionState.isEnabled,
    activeSuggestion: linkSuggestionState.activeSuggestion,
    isLoading: linkSuggestionState.isLoading,
    pageId
  });

  // Flag to suppress onChange when inserting suggestions
  const [suppressNextChange, setSuppressNextChange] = useState(false);

  // DISABLED: Remove all complex auto-insertion logic
  // Link suggestions will be handled manually via context menu or modal
  // This prevents interference with existing confirmed links



  // SIMPLIFIED: Just log suggestions for debugging
  useEffect(() => {
    console.log('🔗 SLATE_EDITOR: Suggestion state update:', {
      readOnly,
      isEnabled: linkSuggestionState.isEnabled,
      suggestionsCount: linkSuggestionState.allSuggestions.length,
      suggestions: linkSuggestionState.allSuggestions.map(s => ({
        matchedText: s.matchedText,
        title: s.title,
        confidence: s.confidence
      }))
    });
  }, [linkSuggestionState.allSuggestions, linkSuggestionState.isEnabled, readOnly]);

  // Trigger initial link analysis when component mounts
  useEffect(() => {
    console.warn('🔗 SLATE_EDITOR: Initial analysis effect triggered:', {
      isClient,
      readOnly,
      hasContent: safeInitialValue.length > 0,
      isEnabled: linkSuggestionState.isEnabled,
      hasUser: !!user?.uid,
      hasPageId: !!pageId
    });

    if (isClient && !readOnly && safeInitialValue.length > 0) {
      const plainText = safeInitialValue
        .map(node => Node.string(node))
        .join('\n')
        .trim();

      console.warn('🔗 SLATE_EDITOR: Triggering initial link analysis on mount:', {
        plainTextLength: plainText.length,
        text: plainText.substring(0, 100) + (plainText.length > 100 ? '...' : '')
      });

      // RE-ENABLED: Simple link analysis (no content modification)
      if (plainText.length > 10) {
        console.warn('🔗 SLATE_EDITOR: Analyzing text for suggestions (display only)');
        linkSuggestionActions.analyzeText(plainText, user?.uid, pageId);
      }
    }
  }, [isClient, readOnly, safeInitialValue, linkSuggestionState.isEnabled, linkSuggestionActions, user?.uid, pageId]);

  // Handle link suggestion selection
  function handleLinkSuggestionSelected(suggestion: LinkSuggestion) {
    try {
      console.log('🔗 SLATE_EDITOR: Inserting link from suggestion:', suggestion);

      // Find the text that matches the suggestion
      const textToReplace = suggestion.matchedText;

      // Search for the text in the current editor content
      const [match] = Editor.nodes(editor, {
        at: [],
        match: n => Text.isText(n) && n.text.includes(textToReplace)
      });

      if (match) {
        const [textNode, path] = match;
        const text = (textNode as Text).text;
        const startIndex = text.indexOf(textToReplace);

        if (startIndex !== -1) {
          const endIndex = startIndex + textToReplace.length;

          // Create the range to replace
          const start = { path, offset: startIndex };
          const end = { path, offset: endIndex };
          const range = { anchor: start, focus: end };

          // Select the text
          Transforms.select(editor, range);

          // CLEAN: Insert suggestion link (with dotted underline)
          const hasCustomText = textToReplace !== suggestion.title;

          const linkElement: LinkElement = hasCustomText
            ? LinkNodeHelper.createCustomLink(suggestion.id, suggestion.title, `/${suggestion.id}`, textToReplace)
            : LinkNodeHelper.createAutoLink(suggestion.id, suggestion.title, `/${suggestion.id}`);

          // Add suggestion-specific properties
          (linkElement as any).isExternal = false;
          (linkElement as any).isPublic = true;
          (linkElement as any).isOwned = false;
          (linkElement as any).isSuggestion = true; // This will show the dotted underline
          (linkElement as any).suggestionData = suggestion; // Store original suggestion data

          Transforms.insertNodes(editor, linkElement);

          // Move cursor after the link
          Transforms.move(editor, { distance: 1, unit: 'offset' });

          console.log('✅ SLATE_EDITOR: Successfully inserted link from suggestion');
        }
      }
    } catch (error) {
      console.error('🔴 SLATE_EDITOR: Error inserting link from suggestion:', error);
    }
  }



  // Element component - defined inside to access state
  const Element = useCallback(({ attributes, children, element }: RenderElementProps) => {
    const editor = useSlateStatic();

    switch (element.type) {
      case 'link':
        // Handle suggestions differently from confirmed links
        if (element.isSuggestion) {
          return (
            <span
              {...attributes}
              contentEditable={false}
              className="cursor-pointer text-primary border-b-2 border-dotted border-primary/60 hover:bg-primary/10 transition-colors"
              onClick={() => {
                // Show suggestion editor modal with pre-loaded search
                console.warn('🔗 Clicked suggestion:', element.suggestionData);
                if (element.suggestionData) {
                  setCurrentSuggestion(element.suggestionData);
                  setSuggestionMatchedText(element.children[0]?.text || '');
                  setShowSuggestionModal(true);
                }
              }}
            >
              {children}
            </span>
          );
        }

        // Normal confirmed pill links - NEVER treat these as suggestions
        // The PillLink component handles deleted page detection automatically

        return (
          <span
            {...attributes}
            contentEditable={false}
            className="inline-block"
            draggable={true}
            onDragStart={(e) => {
              const path = ReactEditor.findPath(editor, element);
              e.dataTransfer.setData('application/x-slate-element', JSON.stringify({
                type: 'link',
                element,
                path
              }));
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.clearData('text/uri-list');
              e.dataTransfer.clearData('text/plain');
              e.dataTransfer.clearData('text/html');
            }}
          >
            <PillLink
              href={element.pageTitle ? `/${element.pageTitle}` : (element.url || '#')}
              pageId={element.pageId}
              isPublic={element.isPublic}
              className="cursor-pointer"
              isEditing={true}
              onEditLink={() => setShowLinkModal(true)}
              draggable={false}
            >
              {children}
            </PillLink>
          </span>
        );
      case 'paragraph':
        // Get the path to this element to determine line number
        const path = ReactEditor.findPath(editor, element);
        const lineNumber = path[0] + 1; // Convert 0-based to 1-based

        return (
          <div
            {...attributes}
            className="flex items-start group"
            style={{
              minHeight: '1.5rem',
              marginBottom: '0.5rem'
            }}
          >
            {/* Line number - NO EXCESSIVE SPACING */}
            <span
              className="text-xs text-muted-foreground/60 font-mono select-none mr-2 flex-shrink-0"
              style={{
                lineHeight: '1.5rem',
                paddingTop: '0.125rem'
              }}
              contentEditable={false}
            >
              {lineNumber}
            </span>

            {/* Paragraph content - NO LEFT PADDING */}
            <div style={{ flex: 1, minHeight: '1.5rem' }}>
              {children}
            </div>
          </div>
        );
      default:
        return <div {...attributes}>{children}</div>;
    }
  }, [setShowLinkModal]);

  // Update value when initialContent changes
  useEffect(() => {
    try {
      const newValue = contentToSlate(initialContent);
      // Ensure we always have at least one paragraph
      const safeValue = newValue.length > 0 ? newValue : [{ type: 'paragraph', children: [{ text: '' }] }];
      setValue(safeValue);
    } catch (error) {
      console.error('Error converting initial content:', error);
      // Fallback to empty content
      setValue([{ type: 'paragraph', children: [{ text: '' }] }]);
    }
  }, [initialContent]);

  // REMOVED: All complex link update logic - now handled directly in ContentPageView

  // Handle content changes
  const handleChange = useCallback((newValue: Descendant[]) => {
    try {
      setValue(newValue);

      // Check if we should suppress this change (e.g., when inserting suggestions)
      if (suppressNextChange) {
        console.warn('🔗 SLATE_EDITOR: Suppressing onChange for suggestion insertion');
        setSuppressNextChange(false);
        return; // Don't call onChange, preventing save card from appearing
      }

      const content = slateToContent(newValue);
      onChange(content);

      // DEBUG: Check link suggestion conditions
      console.log('🔗 SLATE_EDITOR: Link suggestion conditions:', {
        readOnly,
        isFocused,
        isEnabled: linkSuggestionState.isEnabled,
        shouldAnalyze: !readOnly && isFocused && linkSuggestionState.isEnabled
      });

      // Analyze content for link suggestions (when not read-only)
      if (!readOnly && linkSuggestionState.isEnabled) {
        // Extract plain text from Slate content for analysis
        const plainText = newValue
          .map(node => Node.string(node))
          .join('\n')
          .trim();

        console.log('🔗 SLATE_EDITOR: Analyzing text for link suggestions:', {
          plainTextLength: plainText.length,
          plainText: plainText.substring(0, 100) + (plainText.length > 100 ? '...' : ''),
          isEnabled: linkSuggestionState.isEnabled,
          readOnly,
          userId: user?.uid
        });

        // RE-ENABLED: Simple link analysis (no content modification)
        if (plainText.length > 10) {
          console.log('🔗 SLATE_EDITOR: Analyzing text for suggestions (display only)');
          linkSuggestionActions.analyzeText(plainText, user?.uid, pageId);
        }
      } else {
        console.log('🔗 SLATE_EDITOR: Link suggestions disabled:', {
          readOnly,
          isEnabled: linkSuggestionState.isEnabled
        });
      }
    } catch (error) {
      console.error('Error handling content change:', error);
      // Don't update if conversion fails
    }
  }, [onChange, readOnly, linkSuggestionState.isEnabled, linkSuggestionActions, user?.uid, suppressNextChange]);

  // Helper function to ensure proper spacing around links
  const ensureSpacing = useCallback((at: Location) => {
    const [node, path] = Editor.node(editor, at);
    const parentPath = path.slice(0, -1);
    const [parentNode] = Editor.node(editor, parentPath);

    if (!SlateElement.isElement(parentNode) || parentNode.type !== 'paragraph') {
      return;
    }

    const nodeIndex = path[path.length - 1];
    const siblings = parentNode.children;

    // Check what's before this position
    const prevSibling = nodeIndex > 0 ? siblings[nodeIndex - 1] : null;
    const nextSibling = nodeIndex < siblings.length - 1 ? siblings[nodeIndex + 1] : null;

    // Add space before if needed (previous element exists and isn't a space)
    if (prevSibling) {
      if (SlateElement.isElement(prevSibling) && prevSibling.type === 'link') {
        // Previous is a link, ensure space between
        Transforms.insertText(editor, ' ', { at: [...parentPath, nodeIndex] });
      } else if (Text.isText(prevSibling) && !prevSibling.text.endsWith(' ')) {
        // Previous is text that doesn't end with space
        Transforms.insertText(editor, ' ', { at: [...parentPath, nodeIndex] });
      }
    }

    // Add space after if needed (next element exists and isn't a space)
    if (nextSibling) {
      if (SlateElement.isElement(nextSibling) && nextSibling.type === 'link') {
        // Next is a link, ensure space between
        Transforms.insertText(editor, ' ', { at: [...parentPath, nodeIndex + 1] });
      } else if (Text.isText(nextSibling) && !nextSibling.text.startsWith(' ')) {
        // Next is text that doesn't start with space
        Transforms.insertText(editor, ' ', { at: [...parentPath, nodeIndex + 1] });
      }
    }
  }, [editor]);

  // Insert link at current selection
  const insertLink = useCallback((linkData: any) => {
    console.log('🔗 insertLink called with:', linkData);
    console.log('🔗 Current selection:', editor.selection);

    const { selection } = editor;

    if (!selection) {
      console.warn('🔗 No selection available for link insertion');
      return;
    }

    const isCollapsed = Range.isCollapsed(selection);
    console.log('🔗 Selection is collapsed:', isCollapsed);

    // Store the current selection to restore it if needed
    const currentSelection = { ...selection };

    if (isCollapsed) {
      // CLEAN: Create link using helper function
      const displayText = linkData.text || linkData.pageTitle || 'Link';
      const hasCustomText = linkData.text && linkData.text !== linkData.pageTitle;

      const link: LinkElement = hasCustomText
        ? LinkNodeHelper.createCustomLink(
            linkData.pageId,
            linkData.pageTitle,
            linkData.url || (linkData.isNew ? `/new?title=${encodeURIComponent(linkData.pageTitle)}` : `/${linkData.pageId}`),
            linkData.text
          )
        : LinkNodeHelper.createAutoLink(
            linkData.pageId,
            linkData.pageTitle,
            linkData.url || (linkData.isNew ? `/new?title=${encodeURIComponent(linkData.pageTitle)}` : `/${linkData.pageId}`)
          );

      // Add additional properties for Slate
      (link as any).isExternal = linkData.type === 'external';
      (link as any).isPublic = true;
      (link as any).isOwned = false;
      (link as any).isNew = linkData.isNew;

      console.log('🔗 Inserting link at collapsed selection:', link);

      // Insert the link directly without spacing modifications that could disrupt content
      Transforms.insertNodes(editor, link, { at: currentSelection });

      // Move cursor to after the inserted link
      const afterLinkPoint = Editor.after(editor, currentSelection.anchor);
      if (afterLinkPoint) {
        Transforms.select(editor, afterLinkPoint);
      }
    } else {
      // Wrap selected text in link
      console.log('🔗 Wrapping selected text in link');

      // Get the selected text to determine if it's custom
      const selectedText = Editor.string(editor, currentSelection);
      const hasCustomText = selectedText !== linkData.pageTitle;

      // CLEAN: Create base link structure
      const baseLinkData = hasCustomText
        ? LinkNodeHelper.createCustomLink(
            linkData.pageId,
            linkData.pageTitle,
            linkData.url || (linkData.isNew ? `/new?title=${encodeURIComponent(linkData.pageTitle)}` : `/${linkData.pageId}`),
            selectedText
          )
        : LinkNodeHelper.createAutoLink(
            linkData.pageId,
            linkData.pageTitle,
            linkData.url || (linkData.isNew ? `/new?title=${encodeURIComponent(linkData.pageTitle)}` : `/${linkData.pageId}`)
          );

      Transforms.wrapNodes(
        editor,
        {
          ...baseLinkData,
          isExternal: linkData.type === 'external',
          isPublic: true,
          isOwned: false,
          isNew: linkData.isNew,
          children: [] // Slate will populate this with selected content
        },
        { split: true, at: currentSelection }
      );
    }

    console.log('🔗 Link insertion completed');
    setShowLinkModal(false);
  }, [editor]);

  // Handle link creation from suggestion modal
  const handleSuggestionLinkInsert = useCallback((linkData: any) => {
    try {
      console.log('🔗 SLATE_EDITOR: Inserting confirmed link from suggestion:', linkData);

      if (linkData.replaceSuggestion && linkData.matchedText) {
        // Find the specific suggestion element that matches the text
        const matches = Array.from(Editor.nodes(editor, {
          at: [],
          match: n => SlateElement.isElement(n) &&
                     n.type === 'link' &&
                     n.isSuggestion &&
                     n.children[0]?.text === linkData.matchedText
        }));

        console.log('🔗 SLATE_EDITOR: Found suggestion matches:', matches.length);

        if (matches.length > 0) {
          const [, path] = matches[0]; // Use the first match

          // CLEAN: Create confirmed link element
          const displayText = linkData.text || linkData.pageTitle || 'Link';
          const hasCustomText = linkData.text && linkData.text !== linkData.pageTitle;

          const linkElement: LinkElement = hasCustomText
            ? LinkNodeHelper.createCustomLink(linkData.pageId, linkData.pageTitle, `/${linkData.pageId}`, linkData.text)
            : LinkNodeHelper.createAutoLink(linkData.pageId, linkData.pageTitle, `/${linkData.pageId}`);

          // Add Slate-specific properties
          (linkElement as any).isExternal = linkData.type === 'external';
          (linkElement as any).isPublic = true;
          (linkElement as any).isOwned = false;

          // Replace the suggestion with the confirmed link
          Transforms.setNodes(editor, linkElement, { at: path });
          console.log('✅ SLATE_EDITOR: Successfully replaced suggestion with confirmed link');
        } else {
          console.warn('🔴 SLATE_EDITOR: No matching suggestion element found for text:', linkData.matchedText);
        }
      } else {
        // Fallback to regular link insertion
        insertLink(linkData);
      }
    } catch (error) {
      console.error('🔴 SLATE_EDITOR: Error inserting link from suggestion:', error);
    }
  }, [editor, insertLink]);

  // Extract linked page IDs from current content
  const getLinkedPageIds = useCallback(() => {
    const linkedPageIds = new Set<string>();

    const extractLinksFromNode = (node: any) => {
      if (SlateElement.isElement(node)) {
        if (node.type === 'link' && node.pageId) {
          linkedPageIds.add(node.pageId);
        }
        if (node.children) {
          node.children.forEach(extractLinksFromNode);
        }
      }
    };

    value.forEach(extractLinksFromNode);
    return Array.from(linkedPageIds);
  }, [value]);

  // Get selected text from editor
  // This is used to pre-populate the link search with selected text
  const getSelectedText = useCallback(() => {
    const { selection } = editor;
    if (!selection || Range.isCollapsed(selection)) {
      return '';
    }

    try {
      return Editor.string(editor, selection);
    } catch (error) {
      console.warn('Error getting selected text:', error);
      return '';
    }
  }, [editor]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey) {
      switch (event.key) {
        case 'k':
          event.preventDefault();
          setShowLinkModal(true);
          break;
        case 's':
          event.preventDefault();
          console.log('🚨 SLATE_KEYBOARD_DEBUG: Cmd+S pressed in SlateEditor!', {
            hasOnSave: !!onSave,
            onSaveType: typeof onSave,
            timestamp: new Date().toISOString()
          });
          if (onSave) {
            console.log('🚨 SLATE_KEYBOARD_DEBUG: About to call onSave function');
            onSave();
            console.log('🚨 SLATE_KEYBOARD_DEBUG: onSave function called successfully');
          } else {
            console.log('🚨 SLATE_KEYBOARD_DEBUG: No onSave function provided!');
          }
          break;
      }
    }
  }, [onSave]);

  // State for drop indicator
  const [dropIndicator, setDropIndicator] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false
  });

  // Handle drag over for drop zones
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    // Only show drop indicator when actually dragging a link element
    const slateData = event.dataTransfer.types.includes('application/x-slate-element');
    if (slateData) {
      // Show drop indicator at cursor position
      const rect = event.currentTarget.getBoundingClientRect();
      setDropIndicator({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        visible: true
      });
    }
  }, []);

  // Handle drop for moving link elements
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    // Hide drop indicator
    setDropIndicator(prev => ({ ...prev, visible: false }));

    const slateData = event.dataTransfer.getData('application/x-slate-element');
    if (!slateData) return;

    try {
      const { type, element, path: sourcePath } = JSON.parse(slateData);

      if (type === 'link') {
        // Get the drop location
        let range = ReactEditor.findEventRange(editor, event);

        // If no range found (dropped outside content), insert at end of last line
        if (!range) {
          const lastPath = Editor.last(editor, [])[1];
          const lastNode = Node.get(editor, lastPath);

          // Find the end of the last text node in the last paragraph
          if (SlateElement.isElement(lastNode) && lastNode.children) {
            const lastChildIndex = lastNode.children.length - 1;
            const lastChild = lastNode.children[lastChildIndex];

            if (Text.isText(lastChild)) {
              // Insert at the end of the last text node
              range = {
                anchor: { path: [...lastPath, lastChildIndex], offset: lastChild.text.length },
                focus: { path: [...lastPath, lastChildIndex], offset: lastChild.text.length }
              };
            } else {
              // Insert after the last child element
              range = {
                anchor: { path: [...lastPath, lastChildIndex + 1], offset: 0 },
                focus: { path: [...lastPath, lastChildIndex + 1], offset: 0 }
              };
            }
          } else {
            // Fallback: insert at the very end
            range = Editor.end(editor, []);
          }
        } else {
          // COLLISION DETECTION: Check if we're trying to drop inside another link
          const [node] = Editor.node(editor, range.anchor.path);
          const parentPath = range.anchor.path.slice(0, -1);
          const [parentNode] = Editor.node(editor, parentPath);

          // If the target is inside a link element, find a safe position next to it
          if (SlateElement.isElement(parentNode) && parentNode.type === 'link') {
            console.log('🚫 Collision detected: Cannot drop link inside another link');

            // Find the path of the link we're trying to drop into
            const linkPath = parentPath;
            const linkParentPath = linkPath.slice(0, -1);
            const linkIndex = linkPath[linkPath.length - 1];

            // Determine if we should place before or after the existing link
            const rect = event.currentTarget.getBoundingClientRect();
            const dropX = event.clientX - rect.left;

            // Get the existing link element's position
            const linkElement = ReactEditor.toDOMNode(editor, parentNode);
            const linkRect = linkElement.getBoundingClientRect();
            const linkCenterX = linkRect.left + linkRect.width / 2 - rect.left;

            // Physics-based positioning: place before or after based on drop position
            if (dropX < linkCenterX) {
              // Drop before the existing link
              range = {
                anchor: { path: [...linkParentPath, linkIndex], offset: 0 },
                focus: { path: [...linkParentPath, linkIndex], offset: 0 }
              };
              console.log('📍 Placing link BEFORE existing link at:', range);
            } else {
              // Drop after the existing link
              range = {
                anchor: { path: [...linkParentPath, linkIndex + 1], offset: 0 },
                focus: { path: [...linkParentPath, linkIndex + 1], offset: 0 }
              };
              console.log('📍 Placing link AFTER existing link at:', range);
            }
          }
        }

        // Remove the element from its original location
        Transforms.removeNodes(editor, { at: sourcePath });

        // Ensure proper spacing at the drop location
        ensureSpacing(range.anchor);

        // Insert the element at the new location
        Transforms.select(editor, range);
        Transforms.insertNodes(editor, element);

        console.log('Link moved successfully to:', range);
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  }, [editor, ensureSpacing]);

  // Handle drag leave to hide drop indicator
  const handleDragLeave = useCallback((event: React.DragEvent) => {
    // Only hide if we're leaving the editor entirely
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setDropIndicator(prev => ({ ...prev, visible: false }));
    }
  }, []);

  // Handle drag end to ensure drop indicator is hidden
  const handleDragEnd = useCallback(() => {
    setDropIndicator(prev => ({ ...prev, visible: false }));
  }, []);

  // Handle external link insertion request
  useEffect(() => {
    if (onInsertLinkRequest) {
      onInsertLinkRequest(() => {
        setShowLinkModal(true);
      });
    }
  }, [onInsertLinkRequest]);

  // REMOVED: Complex title update system - now handled by fresh content loading

  // Prevent hydration mismatches by only rendering on client
  if (!isClient) {
    return (
      <div className="w-full">
        <div className="p-4 text-center text-muted-foreground">
          Loading editor...
        </div>
      </div>
    );
  }

  return (
    <div className="wewrite-editor-container">
      {showToolbar && (
        <div className="flex items-center gap-2 p-2 border-b-only bg-muted/30">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowLinkModal(true)}
            disabled={readOnly}
          >
            <Link className="w-4 h-4 mr-1" />
            Link
          </Button>

          {onSave && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                // CRITICAL FIX: Pass current content to onSave function
                const currentContent = slateToContent(value);
                console.log('🔵 DEBUG: SlateEditor Save button clicked, passing content:', {
                  hasContent: !!currentContent,
                  contentLength: currentContent ? currentContent.length : 0,
                  contentSample: currentContent ? JSON.stringify(currentContent).substring(0, 100) : 'null'
                });
                onSave(currentContent);
              }}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          )}

          {onCancel && (
            <Button variant="secondary" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}

          {onDelete && (
            <Button variant="destructive" size="sm" onClick={() => onDelete()}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {error && (
        <div className="p-2 text-sm text-destructive bg-destructive/10 border-theme-medium rounded">
          {error}
        </div>
      )}

      <Slate
        editor={editor}
        initialValue={safeInitialValue || [{ type: 'paragraph', children: [{ text: '' }] }]}
        onChange={handleChange}
      >
        <div className={`relative w-full max-w-none wewrite-input ${isFocused ? 'wewrite-active-input' : ''}`}>
          <Editable
            renderElement={Element}
            renderLeaf={Leaf}
            placeholder={placeholder}
            readOnly={readOnly}
            onKeyDown={handleKeyDown}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDragEnd={handleDragEnd}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="wewrite-slate-editable"
            style={{
              lineHeight: '1.5',
              fontSize: '1rem',
              fontFamily: 'inherit'
              // Removed transform: translateZ(0) as it creates stacking context that breaks modal positioning
            }}
          />

          {/* Drop Indicator - Simple line to avoid cursor confusion */}
          {dropIndicator.visible && (
            <div
              className="absolute pointer-events-none z-50"
              style={{
                left: dropIndicator.x - 1,
                top: dropIndicator.y - 8,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="w-0.5 h-4 bg-green-500 shadow-lg rounded-full opacity-80"></div>
            </div>
          )}
        </div>
      </Slate>

      {showLinkModal && typeof document !== 'undefined' && createPortal(
        <LinkEditorModal
          isOpen={showLinkModal}
          onClose={() => setShowLinkModal(false)}
          onInsertLink={(linkData) => {
            console.log('SlateEditor: onInsertLink called with:', linkData);
            console.log('SlateEditor: insertLink function:', insertLink);
            insertLink(linkData);
          }}
          editingLink={null}
          selectedText={getSelectedText()}
          linkedPageIds={getLinkedPageIds()}
          currentPageId={pageId}
        />,
        document.body
      )}
      {/* Link Suggestion Editor Modal */}
      {showSuggestionModal && currentSuggestion && typeof document !== 'undefined' && createPortal(
        <LinkSuggestionEditorModal
          isOpen={showSuggestionModal}
          onClose={() => {
            setShowSuggestionModal(false);
            setCurrentSuggestion(null);
            setSuggestionMatchedText('');
          }}
          onInsertLink={handleSuggestionLinkInsert}
          suggestion={currentSuggestion}
          matchedText={suggestionMatchedText}
          currentPageId={pageId}
        />,
        document.body
      )}







      {/* Link Suggestion Modal */}
      {typeof document !== 'undefined' && createPortal(
        <LinkSuggestionModal
          isOpen={linkSuggestionState.showModal}
          onClose={linkSuggestionActions.hideSuggestionModal}
          suggestions={linkSuggestionState.activeSuggestion?.suggestions || []}
          matchedText={linkSuggestionState.activeSuggestion?.matchedText || ''}
          onSelectPage={linkSuggestionActions.selectSuggestion}
          onDismiss={() => {
            if (linkSuggestionState.activeSuggestion) {
              linkSuggestionActions.dismissSuggestion(linkSuggestionState.activeSuggestion.matchedText);
            }
          }}
        />,
        document.body
      )}
    </div>
  );
};

export default SlateEditor;
