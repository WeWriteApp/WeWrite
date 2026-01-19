/**
 * Editor - WeWrite's rich text editor with inline link functionality
 *
 * Built on Slate.js, this editor provides:
 * - Rich text editing with formatting (bold, italic, headings, lists)
 * - Inline pill links for pages, users, and external URLs
 * - Keyboard shortcuts (Ctrl+K for links, Ctrl+S for save)
 * - Link editing and suggestions
 * - Reliable error handling and data preservation
 *
 * Architecture:
 * - Simple, maintainable codebase following documented requirements
 * - Direct operations without complex timing dependencies
 * - Single error boundary with graceful recovery
 * - Consistent use of LinkNodeHelper for link creation
 *
 * @version 5.0.0 - Production Architecture
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/button';
import { AnimatedPresenceItem } from '@/components/ui/AnimatedStack';
import { createEditor, Descendant, Editor as SlateEditor, Element, Element as SlateElement, Node as SlateNode, Range, Text, Transforms, Path, NodeEntry } from 'slate';
import { Editable, ReactEditor, Slate, withReact } from 'slate-react';
import { withHistory } from 'slate-history';
import { cn } from '../../lib/utils';
import { LinkElement, LinkNodeHelper } from '../../types/linkNode';
import LinkNode from './LinkNode';
import LinkEditorModal from './LinkEditorModal';
import { useLineSettings } from '../../contexts/LineSettingsContext';
import { createPortal } from 'react-dom';
import { useLinkSuggestions, LinkSuggestionState, LinkSuggestionActions } from '../../hooks/useLinkSuggestions';
import { useAuth } from '../../providers/AuthProvider';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { LinkSuggestion } from '../../services/linkSuggestionService';
import { PillLink } from '../utils/PillLink';
import { UsernameBadge } from '../ui/UsernameBadge';
import { useMediaQuery } from '../../hooks/use-media-query';
import { InlineError } from '../ui/InlineError';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '../ui/drawer';

// Simple error boundary - no complex recovery mechanisms
class SimpleErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Error logged by React
  }

  render() {
    if (this.state.hasError) {
      const error = this.state.error;
      const errorDetails = error
        ? `${error.name}: ${error.message}\n\nStack trace:\n${error.stack || 'No stack trace available'}`
        : 'Unknown error occurred';

      return (
        <InlineError
          message="Editor encountered an error. Please refresh the page."
          variant="error"
          size="lg"
          errorDetails={errorDetails}
          showCopy={true}
          showCollapsible={true}
          onRetry={() => this.setState({ hasError: false, error: undefined })}
          retryLabel="Try again"
        />
      );
    }
    return this.props.children;
  }
}

// Editor props - essential functionality for rich text editing
interface EditorProps {
  initialContent?: any;
  onChange: (content: any[]) => void;
  placeholder?: string;
  readOnly?: boolean;
  pageId?: string;
  className?: string;
  onInsertLinkRequest?: (triggerFn: () => void) => void;
  initialSelectionPath?: Path; // Optional initial cursor position
  showLinkSuggestions?: boolean; // Show link suggestion underlines when enabled
  onLinkSuggestionCountChange?: (count: number) => void; // Callback when suggestion count changes
  isSaving?: boolean; // When true, prevents link modal from closing during save
  pageCreatedAt?: string | Date | null; // For external link paywall grandfathering

  // Link modal state - lifted from Editor to survive remounts during save
  // When provided, these override the local state
  linkModalOpen?: boolean;
  setLinkModalOpen?: (open: boolean) => void;
  linkModalEditingLink?: any;
  setLinkModalEditingLink?: (link: any) => void;
  linkModalSelectedText?: string;
  setLinkModalSelectedText?: (text: string) => void;
}

const Editor: React.FC<EditorProps> = ({
  initialContent,
  onChange,
  placeholder = "Start writing...",
  readOnly = false,
  pageId,
  className,
  onInsertLinkRequest,
  initialSelectionPath,
  showLinkSuggestions = false,
  onLinkSuggestionCountChange,
  isSaving = false,
  pageCreatedAt,
  linkModalOpen: linkModalOpenProp,
  setLinkModalOpen: setLinkModalOpenProp,
  linkModalEditingLink: linkModalEditingLinkProp,
  setLinkModalEditingLink: setLinkModalEditingLinkProp,
  linkModalSelectedText: linkModalSelectedTextProp,
  setLinkModalSelectedText: setLinkModalSelectedTextProp
}) => {
  const { lineFeaturesEnabled = false } = useLineSettings() ?? {};
  const { user } = useAuth();
  const { hasActiveSubscription } = useSubscription();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Simple state management - no complex state
  // These are fallback local states when lifted state is not provided
  const [showLinkModalLocal, setShowLinkModalLocal] = useState(false);
  const [editingLinkLocal, setEditingLinkLocal] = useState<any>(null);
  const [selectedTextLocal, setSelectedTextLocal] = useState('');

  // Use lifted state when provided, otherwise fallback to local state
  // This allows the modal state to survive component remounts during save
  const isLiftedState = setLinkModalOpenProp !== undefined;
  const showLinkModal = isLiftedState ? (linkModalOpenProp ?? false) : showLinkModalLocal;
  const setShowLinkModal = isLiftedState ? setLinkModalOpenProp! : setShowLinkModalLocal;
  const editingLink = isLiftedState ? linkModalEditingLinkProp : editingLinkLocal;
  const setEditingLink = isLiftedState ? setLinkModalEditingLinkProp! : setEditingLinkLocal;
  const selectedText = isLiftedState ? (linkModalSelectedTextProp ?? '') : selectedTextLocal;
  const setSelectedText = isLiftedState ? setLinkModalSelectedTextProp! : setSelectedTextLocal;

  // Save selection when opening link modal (selection is lost when modal takes focus)
  const savedSelectionRef = useRef<Range | null>(null);

  // DEBUG: Track Editor mount/unmount and showLinkModal state changes
  useEffect(() => {
    console.log('[Editor] Component MOUNTED, isLiftedState:', isLiftedState);
    return () => {
      console.log('[Editor] Component UNMOUNTED');
    };
  }, [isLiftedState]);

  useEffect(() => {
    console.log('[Editor] showLinkModal state is now:', showLinkModal, 'isSaving:', isSaving, 'isLiftedState:', isLiftedState);
  }, [showLinkModal, isSaving, isLiftedState]);

  // Link suggestions state
  const [activeSuggestionForModal, setActiveSuggestionForModal] = useState<LinkSuggestion | null>(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);

  // Link suggestions hook - always enabled for counting, visibility controlled by showLinkSuggestions prop
  // Note: insertLinkFromSuggestion is defined later but referenced via callback
  const insertLinkFromSuggestionRef = useRef<((suggestion: LinkSuggestion) => void) | null>(null);
  const { state: linkSuggestionState, actions: linkSuggestionActions } = useLinkSuggestions({
    enabled: true, // Always enabled to get counts for the button
    minConfidence: 0.3,
    debounceDelay: 1500,
    onSuggestionSelected: (suggestion) => {
      // When a suggestion is selected, insert the link via ref
      insertLinkFromSuggestionRef.current?.(suggestion);
    }
  });


  // Link deletion plugin - allows deleting links with backspace/delete keys
  const withLinkDeletion = useCallback((editor: ReactEditor) => {
    const { deleteBackward, deleteForward } = editor;

    editor.deleteBackward = (unit) => {
      const { selection } = editor;

      if (selection && Range.isCollapsed(selection)) {
        // Prevent merging into attribution rows (reply prefill) which can corrupt structure
        try {
          const blockEntry = SlateEditor.above(editor, {
            at: selection.anchor,
            match: n => SlateEditor.isBlock(editor, n)
          });

          if (blockEntry) {
            const [blockNode, blockPath] = blockEntry;
            if (SlateEditor.isStart(editor, selection.anchor, blockPath)) {
              const prevBlockEntry = SlateEditor.previous(editor, {
                at: blockPath,
                match: n => SlateEditor.isBlock(editor, n)
              });

              if (prevBlockEntry) {
                const [prevBlock] = prevBlockEntry;
                if ((prevBlock as any)?.isAttribution) {
                  // Simply ignore backspace at the start of the paragraph after attribution
                  return;
                }
              }
            }
          }
        } catch (e) {
          // fallback to normal behavior if path lookup fails
        }

        // Only delete link if cursor is IMMEDIATELY after it (offset 0 in next text node)
        try {
        const [parentNode, parentPath] = SlateEditor.parent(editor, selection);
          if (parentNode && typeof parentNode === 'object' && 'type' in parentNode && parentNode.type === 'paragraph') {
            const currentIndex = selection.anchor.path[selection.anchor.path.length - 1];
            const currentOffset = selection.anchor.offset;

            // Only proceed if we're at the very beginning of a text node (offset 0)
            if (currentOffset === 0 && currentIndex > 0) {
              const prevSiblingPath = [...parentPath, currentIndex - 1];
              const [prevSibling] = SlateEditor.node(editor, prevSiblingPath);

              if (prevSibling && typeof prevSibling === 'object' && 'type' in prevSibling && prevSibling.type === 'link') {
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
        // Only delete link if cursor is IMMEDIATELY before it (at end of previous text node)
        try {
        const [parentNode, parentPath] = SlateEditor.parent(editor, selection);
          if (parentNode && typeof parentNode === 'object' && 'type' in parentNode && parentNode.type === 'paragraph') {
            const currentIndex = selection.anchor.path[selection.anchor.path.length - 1];

            // Check if we're at the end of a text node and there's a next sibling that's a link
            const currentNode = SlateEditor.node(editor, selection.anchor.path)[0];
            if (currentNode && typeof currentNode === 'object' && 'text' in currentNode) {
              const textLength = currentNode.text.length;

              // Only proceed if we're at the very end of the current text node
              if (selection.anchor.offset === textLength) {
                const nextSiblingPath = [...parentPath, currentIndex + 1];
                try {
                  const [nextSibling] = SlateEditor.node(editor, nextSiblingPath);

                  if (nextSibling && typeof nextSibling === 'object' && 'type' in nextSibling && nextSibling.type === 'link') {
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
  }, []);

  // Create editor with minimal plugins and error handling
  const editor = useMemo(() => {
    const baseEditor = withLinkDeletion(withHistory(withReact(createEditor())));

    // Configure inline elements - links should be inline
    baseEditor.isInline = (element) => {
      return element.type === 'link';
    };

    // Configure void elements - links are not void (they have children)
    baseEditor.isVoid = (element) => {
      return false;
    };

    // Add custom normalization for link elements + error handling
    const originalNormalizeNode = baseEditor.normalizeNode;
    baseEditor.normalizeNode = (entry) => {
      const [node, path] = entry;

      // Fix link elements that have both 'text' and 'children' properties
      if (Element.isElement(node) && node.type === 'link' && 'text' in node) {
        // Remove the invalid 'text' property from link elements
        const fixedNode = { ...node };
        delete (fixedNode as any).text;

        Transforms.setNodes(baseEditor, fixedNode, { at: path });
        return;
      }

      try {
        originalNormalizeNode(entry);
      } catch (error) {
        // Skip normalization if it fails to prevent crashes
      }
    };

    return baseEditor;
  }, [withLinkDeletion]);

  // Optionally place the cursor at a specific path on mount (e.g., the blank paragraph after attribution)
  useEffect(() => {
    if (readOnly || !initialSelectionPath) return;

    const resolveInitialPoint = () => {
      if (initialSelectionPath) {
        try {
          if (SlateNode.has(editor, initialSelectionPath)) {
            // Use start of the target path so we always land on a valid text node
            return SlateEditor.start(editor, initialSelectionPath);
          }
        } catch (error) {
          // Failed to resolve initial selection path, falling back
        }
      }

      // Fallback to end of document to keep focus inside the editor
      try {
        return SlateEditor.end(editor, []);
      } catch {
        return null;
      }
    };

    const point = resolveInitialPoint();
    if (!point) return;

    requestAnimationFrame(() => {
      try {
        Transforms.select(editor, { anchor: point, focus: point });
        ReactEditor.focus(editor);
      } catch (e) {
        // Error setting initial selection
      }
    });
  }, [editor, initialSelectionPath, readOnly]);

  // Safe initial value with proper normalization
  const normalizeContent = useCallback((content: any): Descendant[] => {
    if (!content || !Array.isArray(content) || content.length === 0) {
      return [{ type: 'paragraph', children: [{ text: '' }] }];
    }

    const normalizeNode = (node: any): any => {
      if (typeof node === 'string') {
        return { text: node };
      }

      if (!node || typeof node !== 'object') {
        return { text: '' };
      }

      if (node.text !== undefined) {
        return { text: node.text || '' };
      }

      if (node.type) {
        const normalizedChildren = Array.isArray(node.children)
          ? node.children.map(normalizeNode).filter(child => child !== null)
          : [{ text: '' }];

        if (normalizedChildren.length === 0) {
          normalizedChildren.push({ text: '' });
        }

        if (node.type === 'link') {
          const linkElement = {
            type: 'link',
            pageId: node.pageId,
            pageTitle: node.pageTitle,
            originalPageTitle: node.originalPageTitle || node.pageTitle,
            url: node.url,
            // Compound link properties
            showAuthor: node.showAuthor || false,
            authorUsername: node.authorUsername,
            authorUserId: node.authorUserId,
            authorTier: node.authorTier,
            authorSubscriptionStatus: node.authorSubscriptionStatus,
            authorSubscriptionAmount: node.authorSubscriptionAmount,
            // Custom text properties
            isCustomText: node.isCustomText,
            customText: node.customText,
            // Link type properties
            isExternal: node.isExternal,
            isPageLink: node.isPageLink,
            isPublic: node.isPublic,
            isOwned: node.isOwned,
            children: normalizedChildren
          };

          delete (linkElement as any).text;
          return linkElement;
        }

        return {
          type: node.type || 'paragraph',
          children: normalizedChildren
        };
      }

      return { text: '' };
    };

    try {
      const normalized = content.map(normalizeNode);

      if (normalized.length === 0) {
        return [{ type: 'paragraph', children: [{ text: '' }] }];
      }

      const validated = normalized.map((node, index) => {
        if (!node || typeof node !== 'object') {
          return { type: 'paragraph', children: [{ text: '' }] };
        }

        if (!node.children || !Array.isArray(node.children) || node.children.length === 0) {
          return { ...node, children: [{ text: '' }] };
        }

        return node;
      });

      return validated;
    } catch (error) {
      return [{ type: 'paragraph', children: [{ text: '' }] }];
    }
  }, []);

  const normalizedInitialContent = useMemo(
    () => normalizeContent(initialContent ?? []),
    [initialContent, normalizeContent]
  );

  const [editorValue, setEditorValue] = useState<Descendant[]>(normalizedInitialContent);

  // Track the previous content to detect external changes
  const prevContentRef = useRef<string>(JSON.stringify(normalizedInitialContent));

  // Track if the change originated from the editor itself (to prevent resetting on own changes)
  const isInternalChangeRef = useRef(false);

  // Extract all page IDs that are already linked in the content
  // IMPORTANT: This must come AFTER editorValue is defined to avoid TDZ errors in production
  const existingLinkedPageIds = useMemo(() => {
    const pageIds = new Set<string>();
    if (!editorValue) return pageIds;

    // Recursively find all link elements and extract their pageIds
    const findLinks = (nodes: Descendant[]) => {
      for (const node of nodes) {
        if (Element.isElement(node)) {
          if (node.type === 'link' && 'pageId' in node && node.pageId) {
            pageIds.add(node.pageId);
          }
          if ('children' in node) {
            findLinks(node.children as Descendant[]);
          }
        }
      }
    };

    findLinks(editorValue);
    return pageIds;
  }, [editorValue]);

  // Filter suggestions to exclude already-linked pages
  const filteredSuggestions = useMemo(() => {
    return linkSuggestionState.allSuggestions.filter(
      suggestion => !existingLinkedPageIds.has(suggestion.id)
    );
  }, [linkSuggestionState.allSuggestions, existingLinkedPageIds]);

  // Notify parent when suggestion count changes (using filtered count)
  useEffect(() => {
    onLinkSuggestionCountChange?.(filteredSuggestions.length);
  }, [filteredSuggestions.length, onLinkSuggestionCountChange]);

  useEffect(() => {
    const currentContentStr = JSON.stringify(normalizedInitialContent);

    // Only update if content actually changed (not just reference)
    // AND if the change was NOT initiated by the editor itself
    if (prevContentRef.current !== currentContentStr) {
      // If this change was triggered by the editor's own onChange, skip the reset
      if (isInternalChangeRef.current) {
        prevContentRef.current = currentContentStr;
        isInternalChangeRef.current = false;
        return;
      }

      prevContentRef.current = currentContentStr;

      // Update state
      setEditorValue(normalizedInitialContent);

      // CRITICAL: Slate.js only reads initialValue on mount.
      // To update content externally, we must directly modify editor.children
      editor.children = normalizedInitialContent;

      // REMOVED: Selection reset was causing focus loss and modal closures during saves
      // Previously we would reset selection on structure changes, but this caused issues:
      // - Focus lost when saving new pages
      // - Link modals closing unexpectedly
      // Slate handles stale selection paths automatically via normalization,
      // so explicit reset is not needed and was doing more harm than good.

      // Trigger a re-render by changing the editor
      editor.onChange();
    }
  }, [normalizedInitialContent, editor]);

  // Optimized change handler - synchronous to prevent selection issues
  const handleChange = useCallback((newValue: Descendant[]) => {
    // Update local state immediately for instant UI feedback
    setEditorValue(newValue);

    // Mark this as an internal change to prevent the useEffect from resetting the editor
    isInternalChangeRef.current = true;

    // Update prevContentRef immediately to prevent the useEffect from detecting this as an external change
    prevContentRef.current = JSON.stringify(newValue);

    // Call parent onChange synchronously to avoid race conditions with selection
    try {
      onChange(newValue);
    } catch (error) {
      // Error in onChange callback
    }
  }, [onChange]);

  // Extract plain text from editor content for link suggestion analysis
  // Excludes text inside links since those are already linked
  const extractPlainText = useCallback((nodes: Descendant[]): string => {
    return nodes.map(node => {
      if (Text.isText(node)) {
        return node.text;
      }
      // Skip link nodes - their text shouldn't be analyzed for link suggestions
      if ('type' in node && node.type === 'link') {
        return '';
      }
      if ('children' in node && Array.isArray(node.children)) {
        return extractPlainText(node.children as Descendant[]);
      }
      return '';
    }).join(' ');
  }, []);

  // Analyze text for link suggestions when content changes
  // Always runs to populate count for the button, regardless of showLinkSuggestions visibility toggle
  // Note: linkSuggestionActions.analyzeText is stable (memoized with useCallback), so we use a ref
  // to avoid having linkSuggestionActions in deps which could cause infinite render loops
  const analyzeTextRef = useRef(linkSuggestionActions.analyzeText);
  analyzeTextRef.current = linkSuggestionActions.analyzeText;

  useEffect(() => {
    if (!editorValue || readOnly) {
      return;
    }

    const plainText = extractPlainText(editorValue);

    if (plainText.length >= 10) {
      analyzeTextRef.current(plainText, user?.uid, pageId);
    }
  }, [editorValue, user?.uid, pageId, readOnly, extractPlainText]);

  // Helper function to insert a link from a suggestion
  const insertLinkFromSuggestion = useCallback((suggestion: LinkSuggestion) => {
    // Find the text in the editor and wrap it with a link (case-insensitive)
    const searchText = suggestion.matchedText;
    const searchTextLower = searchText.toLowerCase();

    // Search through all text nodes to find the matched text
    for (const [node, path] of SlateNode.texts(editor)) {
      const text = node.text;
      const textLower = text.toLowerCase();
      const index = textLower.indexOf(searchTextLower);

      if (index !== -1) {
        // Found the text, select it and insert a link
        const start = { path, offset: index };
        const end = { path, offset: index + searchText.length };

        Transforms.select(editor, { anchor: start, focus: end });

        // Create and insert the link
        const linkElement = LinkNodeHelper.createAutoLink(
          suggestion.id,
          suggestion.title,
          `/${suggestion.id}`
        );

        Transforms.wrapNodes(editor, linkElement, { split: true });
        Transforms.collapse(editor, { edge: 'end' });

        // Dismiss this suggestion since it's been applied
        linkSuggestionActions.dismissSuggestion(searchText);
        setShowSuggestionModal(false);
        setActiveSuggestionForModal(null);

        break;
      }
    }
  }, [editor, linkSuggestionActions]);

  // Update the ref so the hook callback can use the function
  useEffect(() => {
    insertLinkFromSuggestionRef.current = insertLinkFromSuggestion;
  }, [insertLinkFromSuggestion]);

  // Handle clicking on a suggestion underline
  const handleSuggestionClick = useCallback((suggestion: LinkSuggestion) => {
    setActiveSuggestionForModal(suggestion);
    setShowSuggestionModal(true);
  }, []);

  // Check if a path is inside a link element
  const isPathInsideLink = useCallback((path: Path): boolean => {
    // Walk up the path to check ancestors
    for (let i = path.length - 1; i >= 0; i--) {
      const ancestorPath = path.slice(0, i);
      try {
        const node = SlateNode.get(editor, ancestorPath);
        if (Element.isElement(node) && node.type === 'link') {
          return true;
        }
      } catch {
        // Path doesn't exist, continue
      }
    }
    return false;
  }, [editor]);

  // Decorate function to add suggestion underlines
  const decorate = useCallback(([node, path]: NodeEntry): Range[] => {
    const ranges: Range[] = [];

    if (!showLinkSuggestions || !Text.isText(node) || !filteredSuggestions.length) {
      return ranges;
    }

    // Don't decorate text that's inside a link
    if (isPathInsideLink(path)) {
      return ranges;
    }

    const text = node.text;
    const textLower = text.toLowerCase();

    // Find all suggestions that match text in this node (case insensitive)
    for (const suggestion of filteredSuggestions) {
      const searchText = suggestion.matchedText.toLowerCase();
      let index = textLower.indexOf(searchText);

      while (index !== -1) {
        ranges.push({
          anchor: { path, offset: index },
          focus: { path, offset: index + searchText.length },
          suggestion: suggestion,
          isSuggestion: true
        } as Range & { suggestion: LinkSuggestion; isSuggestion: boolean });

        index = textLower.indexOf(searchText, index + 1);
      }
    }

    return ranges;
  }, [showLinkSuggestions, filteredSuggestions, isPathInsideLink]);

  // Simple link insertion - no complex timing dependencies
  const insertLink = useCallback((linkData: any) => {
    try {
      // Ensure editor is focused
      if (!ReactEditor.isFocused(editor)) {
        ReactEditor.focus(editor);
      }

      // Create link element using LinkNodeHelper for consistency
      let linkElement: LinkElement;

      if (linkData.isExternal) {
        // External link
        // Use explicit isCustomText flag for consistency
        if (linkData.isCustomText) {
          linkElement = LinkNodeHelper.createCustomExternalLink(linkData.url, linkData.text || linkData.url);
        } else {
          linkElement = LinkNodeHelper.createAutoExternalLink(linkData.url);
        }
      } else {
        // Internal page link
        // Use explicit isCustomText flag instead of comparing text values
        // This allows users to set custom text that matches the page title
        const hasCustomText = linkData.isCustomText;

        if (hasCustomText) {
          linkElement = LinkNodeHelper.createCustomLink(
            linkData.pageId,
            linkData.pageTitle,
            linkData.url || `/${linkData.pageId}`,
            linkData.text || linkData.pageTitle
          );
        } else {
          linkElement = LinkNodeHelper.createAutoLink(
            linkData.pageId,
            linkData.pageTitle,
            linkData.url || `/${linkData.pageId}`
          );
        }

        // Add compound link properties if needed
        if (linkData.showAuthor) {
          (linkElement as any).showAuthor = true;
          (linkElement as any).authorUsername = linkData.authorUsername;
          (linkElement as any).authorUserId = linkData.authorUserId;
          // Include subscription data if available
          (linkElement as any).authorTier = linkData.authorTier;
          (linkElement as any).authorSubscriptionStatus = linkData.authorSubscriptionStatus;
          (linkElement as any).authorSubscriptionAmount = linkData.authorSubscriptionAmount;
        }

        // Add metadata
        (linkElement as any).isExternal = false;
        (linkElement as any).isPublic = linkData.isPublic !== false;
        (linkElement as any).isOwned = linkData.isOwned || false;
      }

      // Normalize display text for both internal and external links
      const linkText = linkData.isCustomText
        ? (linkData.text || linkData.pageTitle || linkData.url || 'Link')
        : (linkData.pageTitle || linkData.url || 'Link');

      // Ensure display text is stored on the node for rendering and edits
      linkElement = {
        ...linkElement,
        children: [{ text: linkText }]
      };
      // Remove any accidental text/displayText properties that could break normalization
      delete (linkElement as any).text;
      delete (linkElement as any).displayText;

      // Restore saved selection if available (selection may have been lost when modal opened)
      if (savedSelectionRef.current && !editingLink) {
        Transforms.select(editor, savedSelectionRef.current);
      }

      const { selection } = editor;

      if (editingLink) {
        // Edit existing link - complete replacement including children
        if (editingLink.path && editingLink.element) {
          try {
            // CRITICAL FIX: Replace the existing link node so children/text update correctly
            const nodeAtPath = SlateNode.get(editor, editingLink.path);

            const replaceLinkAtPath = (pathToUpdate: any) => {
              // Replace the node in one operation to keep normalization happy
              Transforms.removeNodes(editor, { at: pathToUpdate });
              Transforms.insertNodes(editor, linkElement, { at: pathToUpdate });
              const after = SlateEditor.after(editor, pathToUpdate);
              if (after) {
                Transforms.select(editor, after);
              }
            };

            if (Element.isElement(nodeAtPath) && nodeAtPath.type === 'link' &&
                nodeAtPath.pageId === editingLink.element.pageId) {
              replaceLinkAtPath(editingLink.path);
            } else {
              // Path is stale, try to find the element again
              const linkNodes = Array.from(SlateNode.nodes(editor, {
                match: n => Element.isElement(n) && n.type === 'link' && n.pageId === editingLink.element.pageId
              }));

              if (linkNodes.length > 0) {
                const [, newPath] = linkNodes[0];
                replaceLinkAtPath(newPath);
              } else {
                throw new Error('Link element not found');
              }
            }
          } catch (error) {
            // Fallback: insert as new link at current selection
            if (selection) {
              Transforms.insertNodes(editor, linkElement);
              Transforms.move(editor, { distance: 1, unit: 'offset' });
            }
          }
        }
      } else if (selection) {
        // Insert new link
        if (Range.isCollapsed(selection)) {
          // Insert at cursor
          Transforms.insertNodes(editor, linkElement);
          // Move cursor after the inserted link
          Transforms.move(editor, { distance: 1, unit: 'offset' });
        } else {
          // Wrap selected text
          Transforms.wrapNodes(editor, { ...linkElement, children: [] }, { split: true });
          // Clear selection after wrapping
          Transforms.collapse(editor, { edge: 'end' });
        }
      }

      // Simple cleanup - no complex timing
      setShowLinkModal(false);
      setEditingLink(null);
      setSelectedText('');
      savedSelectionRef.current = null;

    } catch (error) {
      // Simple error handling - show user-friendly message
      alert('Failed to insert link. Please try again.');
    }
  }, [editor, editingLink]);

  // Function to trigger link insertion (used by both keyboard shortcut and button)
  const triggerLinkInsertion = useCallback(() => {
    if (readOnly) return;

    // Get selected text if any
    const { selection } = editor;
    if (selection && !Range.isCollapsed(selection)) {
      const rawSelectedText = SlateEditor.string(editor, selection);
      // Trim leading/trailing whitespace from selection for cleaner links
      const trimmedText = rawSelectedText.trim();
      setSelectedText(trimmedText);
      // Save the selection so we can restore it after modal closes
      // This is needed because focus moves to the modal and selection is lost
      savedSelectionRef.current = selection;
    } else {
      setSelectedText('');
      savedSelectionRef.current = null;
    }

    setShowLinkModal(true);
  }, [editor, readOnly]);

  // URL detection and cleanup utility
  const cleanUrl = useCallback((url: string): { fullUrl: string; displayText: string } => {
    // Ensure the URL has a protocol for linking
    let fullUrl = url.trim();
    if (!fullUrl.match(/^https?:\/\//i)) {
      fullUrl = 'https://' + fullUrl.replace(/^www\./i, '');
    }

    // Clean up display text - remove protocol and www
    let displayText = url.trim();
    displayText = displayText.replace(/^https?:\/\//i, ''); // Remove protocol
    displayText = displayText.replace(/^www\./i, ''); // Remove www
    displayText = displayText.replace(/\/+$/, ''); // Remove trailing slashes

    return { fullUrl, displayText };
  }, []);

  // Paste handler - automatically converts URLs to links
  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    if (readOnly) return;

    const pastedText = event.clipboardData.getData('text/plain');

    // Check if pasted text is a URL
    const urlRegex = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

    if (urlRegex.test(pastedText.trim())) {
      event.preventDefault();

      const { fullUrl, displayText } = cleanUrl(pastedText);

      // Create link element with cleaned display text
      const linkElement = LinkNodeHelper.createCustomExternalLink(fullUrl, displayText);

      const { selection } = editor;

      if (selection) {
        if (Range.isCollapsed(selection)) {
          // Insert link at cursor
          Transforms.insertNodes(editor, linkElement);
          // Insert a space after the link so users can continue typing
          Transforms.insertNodes(editor, { text: ' ' });
        } else {
          // Replace selected text with link
          Transforms.delete(editor);
          Transforms.insertNodes(editor, linkElement);
          // Insert a space after the link so users can continue typing
          Transforms.insertNodes(editor, { text: ' ' });
        }
      }
    }
  }, [editor, readOnly, cleanUrl]);

  // Keyboard shortcut handler - supports both Mac (Cmd) and Windows/Linux (Ctrl)
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (readOnly) return;

    // Cmd+K (Mac) or Ctrl+K (Windows/Linux) for link insertion
    const isLinkShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';

    if (isLinkShortcut) {
      event.preventDefault();
      triggerLinkInsertion();
    }
  }, [triggerLinkInsertion, readOnly]);

  // Handle clicks on the editor wrapper area (for clicking below content on mobile)
  // This ensures users never get "trapped" without being able to continue typing
  // Requires double-click to insert a new line (to avoid accidental triggers)
  const editorRef = useRef<HTMLDivElement>(null);
  const lastBottomClickTimeRef = useRef<number>(0);
  const DOUBLE_CLICK_THRESHOLD_MS = 400; // Time window for double-click detection

  const handleEditorWrapperClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;

    // Only process clicks on the wrapper itself, not on child elements
    // Check if the click target is the wrapper or an empty area
    const target = event.target as HTMLElement;
    const wrapper = editorRef.current;

    if (!wrapper) return;

    // Get the Editable element's bounding rect to check if click is below content
    const editable = wrapper.querySelector('[data-slate-editor]');
    if (!editable) return;

    const editableRect = editable.getBoundingClientRect();
    const clickY = event.clientY;

    // If click is below the last content in the editor
    if (clickY > editableRect.bottom - 20) {
      // Check if the click is in an empty/padding area (not on text)
      // This prevents interfering with normal text selection
      const selection = window.getSelection();
      const isOnText = selection && selection.rangeCount > 0 && selection.toString().length > 0;

      if (!isOnText) {
        const now = Date.now();
        const timeSinceLastClick = now - lastBottomClickTimeRef.current;

        // On first click: just move cursor to end and record the time
        // On second click (within threshold): also insert new paragraph if needed
        const isDoubleClick = timeSinceLastClick < DOUBLE_CLICK_THRESHOLD_MS;
        lastBottomClickTimeRef.current = now;

        try {
          const endPoint = SlateEditor.end(editor, []);
          Transforms.select(editor, { anchor: endPoint, focus: endPoint });
          ReactEditor.focus(editor);

          // Only insert new paragraph on double-click (user is frustrated/intentional)
          if (isDoubleClick) {
            // Check if the last paragraph is empty - if not, add a new line
            const lastNode = editorValue[editorValue.length - 1];
            if (lastNode && Element.isElement(lastNode)) {
              const hasContent = lastNode.children.some((child: any) =>
                Text.isText(child) && child.text.trim().length > 0
              );
              if (hasContent) {
                // Insert a new paragraph if the last one has content
                Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] });
              }
            }
          }
        } catch (error) {
          // Failed to handle click below content
        }
      }
    }
  }, [editor, editorValue, readOnly]);

  // Set up link insertion trigger for external buttons
  useEffect(() => {
    if (onInsertLinkRequest) {
      onInsertLinkRequest(() => {
        triggerLinkInsertion();
      });
    }
  }, [onInsertLinkRequest, triggerLinkInsertion]);

  // Helper to check if a paragraph is empty (only contains empty text)
  const isEmptyParagraph = useCallback((element: any): boolean => {
    if (element.type !== 'paragraph' && element.type !== undefined) return false;
    if (!element.children || element.children.length === 0) return true;
    // Check if all children are empty text nodes
    return element.children.every((child: any) => {
      if (Text.isText(child)) {
        return child.text === '';
      }
      return false;
    });
  }, []);

  // Count empty paragraphs (excluding the first and last - user may be typing there)
  const emptyParagraphCount = useMemo(() => {
    if (!editorValue || editorValue.length <= 2) return 0;

    // Helper to check if a node is an empty paragraph
    const isEmptyNode = (node: any) => {
      if (node.type !== 'paragraph' && node.type !== undefined) return false;
      if (!node.children || node.children.length === 0) return true;
      return node.children.every((child: any) => {
        if (Text.isText(child)) {
          return child.text === '';
        }
        return false;
      });
    };

    // Skip the first paragraph (title area) and last paragraph (user might be typing)
    // Only count empty paragraphs in the middle section
    const middleParagraphs = editorValue.slice(1, -1);
    return middleParagraphs.filter(isEmptyNode).length;
  }, [editorValue]);

  // Check if an element is the first paragraph in the document
  const isFirstParagraph = useCallback((element: any): boolean => {
    try {
      const path = ReactEditor.findPath(editor, element);
      return path.length === 1 && path[0] === 0;
    } catch {
      return false;
    }
  }, [editor]);

  // Check if an element is the last paragraph in the document
  const isLastParagraph = useCallback((element: any): boolean => {
    try {
      const path = ReactEditor.findPath(editor, element);
      return path.length === 1 && path[0] === editorValue.length - 1;
    } catch {
      return false;
    }
  }, [editor, editorValue.length]);

  // Track indices pending animated deletion
  const [pendingDeletionIndices, setPendingDeletionIndices] = useState<Set<number>>(new Set());
  const deletionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Animation duration for deletion (in ms)
  const DELETION_ANIMATION_MS = 200;

  // Actually perform the deletion after animation
  const performDeletion = useCallback((indicesToDelete: number[]) => {
    // Delete in reverse order to maintain correct paths
    const sortedIndices = [...indicesToDelete].sort((a, b) => b - a);
    sortedIndices.forEach(index => {
      try {
        Transforms.removeNodes(editor, { at: [index] });
      } catch (error) {
        // Error deleting empty paragraph
      }
    });
    setPendingDeletionIndices(new Set());
  }, [editor]);

  // Delete an empty paragraph with animation
  const deleteEmptyParagraph = useCallback((element: any) => {
    try {
      const path = ReactEditor.findPath(editor, element);
      const index = path[0];
      // Don't delete if it's the only paragraph in the document
      if (editorValue.length <= 1) {
        return;
      }

      // Mark for animated deletion
      setPendingDeletionIndices(new Set([index]));

      // Actually delete after animation completes
      setTimeout(() => {
        performDeletion([index]);
      }, DELETION_ANIMATION_MS);
    } catch (error) {
      // Error deleting empty paragraph
    }
  }, [editor, editorValue.length, performDeletion]);

  // Delete all empty paragraphs (except the first one) with animation
  const deleteAllEmptyParagraphs = useCallback(() => {
    if (!editorValue || editorValue.length <= 1) return;

    // Find all empty paragraph indices
    const emptyIndices: number[] = [];
    editorValue.forEach((node: any, index: number) => {
      // Skip the first paragraph
      if (index === 0) return;

      const isEmpty = (node.type === 'paragraph' || node.type === undefined) &&
        node.children?.every((child: any) => Text.isText(child) && child.text === '');

      if (isEmpty) {
        emptyIndices.push(index);
      }
    });

    if (emptyIndices.length === 0) return;

    // Mark all for animated deletion
    setPendingDeletionIndices(new Set(emptyIndices));

    // Actually delete after animation completes
    setTimeout(() => {
      performDeletion(emptyIndices);
    }, DELETION_ANIMATION_MS);
  }, [editorValue, performDeletion]);

  // Simple element renderer - renders inline pill links using LinkNode
  const renderElement = useCallback((props: any) => {
    const { attributes, children, element } = props;

    switch (element.type) {
      case 'link':
        // Extract text content from children for the LinkNode
        const linkText = element.children?.[0]?.text || element.text || element.pageTitle || '';

        // Create a modified element with the text content
        const linkElementWithText = {
          ...element,
          text: linkText,
          displayText: linkText
        };

        return (
          <LinkNode
            {...attributes}
            node={linkElementWithText}
            canEdit={!readOnly}
            isEditing={!readOnly}
            // Pass Slate children through so DOM mapping remains intact for selection
            children={children}
            // External link paywall context - in edit mode, author is the current user
            authorHasSubscription={hasActiveSubscription}
            pageCreatedAt={pageCreatedAt}
            isPageOwner={true}
            onEditLink={() => {
              // Determine link type based on element properties
              let linkType: 'page' | 'user' | 'external' | 'compound' = 'page';
              if (element.isExternal) {
                linkType = 'external';
              } else if (element.showAuthor) {
                linkType = 'compound';
              } else if (element.userId) {
                linkType = 'user';
              }

              // Structure the editing link data to match LinkEditorModal interface
              setEditingLink({
                element: element as any, // The Slate element
                type: linkType,
                data: {
                  url: element.url,
                  title: element.pageTitle || element.title,
                  pageId: element.pageId,
                  userId: element.userId,
                  showAuthor: element.showAuthor,
                  authorUsername: element.authorUsername,
                  authorUserId: element.authorUserId,
                  isExternal: element.isExternal,
                  // Use the canonical LinkNode structure
                  customText: element.customText,
                  isCustomText: element.isCustomText,
                  ...element // Include any other properties
                },
                path: ReactEditor.findPath(editor, element)
              });
              setSelectedText(linkText);
              setShowLinkModal(true);
            }}
          />
        );
      case 'heading-one':
        return <h1 {...attributes}>{children}</h1>;
      case 'heading-two':
        return <h2 {...attributes}>{children}</h2>;
      case 'heading-three':
        return <h3 {...attributes}>{children}</h3>;
      case 'block-quote':
        return <blockquote {...attributes}>{children}</blockquote>;
      case 'bulleted-list':
        return <ul {...attributes}>{children}</ul>;
      case 'numbered-list':
        return <ol {...attributes}>{children}</ol>;
      case 'list-item':
        return <li {...attributes}>{children}</li>;
      default:
        // Check if this is an empty paragraph that should be highlighted
        const isEmpty = isEmptyParagraph(element);
        const isFirst = isFirstParagraph(element);
        const isLast = isLastParagraph(element);
        // Never highlight the first or last paragraph (user may be typing there)
        // Only highlight empty paragraphs in the middle of the document
        const shouldHighlight = isEmpty && !isFirst && !isLast && !readOnly;
        const canDelete = !readOnly && isEmpty && !isFirst && !isLast && editorValue.length > 1;

        // Check if this element is pending deletion for animation
        let isPendingDeletion = false;
        try {
          const path = ReactEditor.findPath(editor, element);
          isPendingDeletion = pendingDeletionIndices.has(path[0]);
        } catch {
          // Ignore path errors
        }

        if (shouldHighlight) {
          return (
            <div
              {...attributes}
              className={cn(
                "relative flex items-center transition-all duration-200",
                isPendingDeletion && "opacity-0 scale-95 -translate-x-4"
              )}
            >
              <p className={cn(
                "flex-1 rounded-md transition-colors",
                "bg-error-10"
              )}>
                {children}
              </p>
              {canDelete && !isPendingDeletion && (
                <button
                  contentEditable={false}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteEmptyParagraph(element);
                  }}
                  className={cn(
                    "absolute right-2 flex items-center justify-center",
                    "p-1",
                    "active:scale-95",
                    "text-error",
                    "hover:text-error/80",
                    "cursor-pointer transition-colors"
                  )}
                  title="Delete empty line"
                >
                  <Icon name="Trash2" size={16} />
                </button>
              )}
            </div>
          );
        }

        return <p {...attributes}>{children}</p>;
    }
  }, [editor, readOnly, isEmptyParagraph, isFirstParagraph, isLastParagraph, deleteEmptyParagraph, editorValue.length, pendingDeletionIndices]);

  // Simple leaf renderer with suggestion underline support
  const renderLeaf = useCallback((props: any) => {
    let { children } = props;

    if (props.leaf.bold) {
      children = <strong>{children}</strong>;
    }

    if (props.leaf.italic) {
      children = <em>{children}</em>;
    }

    if (props.leaf.code) {
      children = <code>{children}</code>;
    }

    // Link suggestion underline - clickable dotted underline
    if (props.leaf.isSuggestion && props.leaf.suggestion) {
      const suggestion = props.leaf.suggestion as LinkSuggestion;
      return (
        <span
          {...props.attributes}
          className="border-b-2 border-dotted border-[oklch(var(--accent-base)/0.5)] cursor-pointer hover:border-[oklch(var(--accent-base))] hover:bg-[oklch(var(--accent-base)/0.1)] transition-colors"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSuggestionClick(suggestion);
          }}
          title={`Suggest linking to: ${suggestion.title}`}
        >
          {children}
        </span>
      );
    }

    return <span {...props.attributes}>{children}</span>;
  }, [handleSuggestionClick]);

  if (!editorValue || !Array.isArray(editorValue)) {
    return (
      <div className="min-h-[200px] w-full rounded-lg p-4 bg-muted/10" />
    );
  }

  return (
    <SimpleErrorBoundary>
      <div className={cn("relative", className)}>
        <Slate
          editor={editor}
          initialValue={normalizedInitialContent}
          onChange={handleChange}
        >
          <div
            ref={editorRef}
            onClick={handleEditorWrapperClick}
            className={cn(
              "wewrite-input min-h-[200px] w-full rounded-lg p-4",
              "transition-all duration-200",
              // Ensure minimum tap target area for mobile UX
              !readOnly && "cursor-text"
            )}
          >
            <div className="flex">
              {/* Line numbers (hidden when feature flag is disabled) */}
              {lineFeaturesEnabled && (
                <div className="flex-shrink-0 pr-4 text-right text-base text-muted-foreground/60 select-none font-mono leading-relaxed">
                  {Array.from({ length: (editorValue?.length || 1) }, (_, i) => (
                    <div
                      key={i + 1}
                      className="flex items-start justify-end leading-relaxed mb-3 last:mb-0"
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              )}

              {/* Editor content */}
              <div className="flex-1 min-w-0">
                <Editable
                  className={cn(
                    "w-full resize-none border-none bg-transparent p-0 text-base leading-relaxed text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0",
                    "prose prose-slate max-w-none dark:prose-invert",
                    "prose-headings:font-semibold prose-headings:tracking-tight",
                    "prose-h1:text-3xl prose-h1:leading-tight",
                    "prose-h2:text-2xl prose-h2:leading-tight",
                    "prose-h3:text-xl prose-h3:leading-tight",
                    // Tighten default typography spacing to align with page numbers
                    "[&_p]:m-0 [&_p]:mb-3 [&_p:last-of-type]:mb-0 [&_p]:leading-relaxed",
                    "[&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1",
                    "[&_h1]:mt-6 [&_h1]:mb-2 [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:mt-4 [&_h3]:mb-1",
                    "prose-blockquote:border-l-4 prose-blockquote:border-border prose-blockquote:pl-4 prose-blockquote:italic",
                    "prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
                    "prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto",
                    "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
                    "[&_.slate-link]:text-primary [&_.slate-link]:no-underline [&_.slate-link:hover]:underline"
                  )}
                  placeholder={placeholder}
                  renderElement={renderElement}
                  renderLeaf={renderLeaf}
                  decorate={decorate}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  readOnly={readOnly}
                  spellCheck={true}
                  autoCorrect="on"
                  autoCapitalize="sentences"
                  style={{
                    // Performance optimization for mobile: use GPU acceleration
                    transform: 'translateZ(0)',
                    willChange: 'contents'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Delete all empty lines button - animated in/out to prevent layout shifts */}
          <AnimatedPresenceItem
            show={!readOnly && emptyParagraphCount > 0}
            gap={12}
            preset="default"
            gapPosition="top"
          >
            <Button
              variant="destructive-secondary"
              size="lg"
              onClick={deleteAllEmptyParagraphs}
              className="w-full gap-2 rounded-2xl font-medium"
            >
              <Icon name="Trash2" size={20} />
              Delete {emptyParagraphCount} empty {emptyParagraphCount === 1 ? 'line' : 'lines'}
            </Button>
          </AnimatedPresenceItem>
        </Slate>


        {/* Simple modal rendering */}
        {showLinkModal && typeof document !== 'undefined' && createPortal(
          <LinkEditorModal
            isOpen={showLinkModal}
            isSaving={isSaving}
            onClose={() => {
              // Guard: Don't close modal during save operations
              if (isSaving) return;
              setShowLinkModal(false);
              setEditingLink(null);
              setSelectedText('');
            }}
            onInsertLink={insertLink}
            editingLink={editingLink}
            selectedText={selectedText}
            currentPageId={pageId}
          />,
          document.body
        )}

        {/* Link Suggestion Modal - Responsive: Drawer on mobile, Dialog on desktop */}
        {activeSuggestionForModal && (
          isMobile ? (
            // Mobile: Use Drawer
            <Drawer
              open={showSuggestionModal}
              onOpenChange={(open) => {
                setShowSuggestionModal(open);
                if (!open) setActiveSuggestionForModal(null);
              }}
            >
              <DrawerContent accessibleTitle="Link Suggestion">
                <DrawerHeader>
                  <DrawerTitle>Link Suggestion</DrawerTitle>
                  <DrawerDescription>
                    Link "<span className="font-medium text-foreground">{activeSuggestionForModal.matchedText}</span>" to:
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-4 pb-6">
                  <div className="bg-neutral-alpha-5 rounded-lg p-4 mb-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <PillLink
                        href={`/${activeSuggestionForModal.id}`}
                        pageId={activeSuggestionForModal.id}
                        clickable={false}
                      >
                        {activeSuggestionForModal.title}
                      </PillLink>
                      {activeSuggestionForModal.username && activeSuggestionForModal.username !== activeSuggestionForModal.userId && (
                        <span className="text-sm text-muted-foreground">
                          by <UsernameBadge
                            username={activeSuggestionForModal.username}
                            userId={activeSuggestionForModal.userId}
                            showBadge={false}
                            size="sm"
                          />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                      onClick={() => insertLinkFromSuggestion(activeSuggestionForModal)}
                    >
                      Accept Suggestion
                    </button>
                    <button
                      className="w-full px-4 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
                      onClick={() => {
                        setSelectedText(activeSuggestionForModal.matchedText);
                        setShowSuggestionModal(false);
                        setActiveSuggestionForModal(null);
                        setShowLinkModal(true);
                      }}
                    >
                      Choose Different Link
                    </button>
                    <button
                      className="w-full px-4 py-3 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => {
                        linkSuggestionActions.dismissSuggestion(activeSuggestionForModal.matchedText);
                        setShowSuggestionModal(false);
                        setActiveSuggestionForModal(null);
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            // Desktop: Use Dialog via portal
            showSuggestionModal && typeof document !== 'undefined' && createPortal(
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                onClick={() => {
                  setShowSuggestionModal(false);
                  setActiveSuggestionForModal(null);
                }}
              >
                <div
                  className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full mx-4 p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold mb-2">Link Suggestion</h3>
                  <p className="text-muted-foreground mb-4">
                    Link "<span className="font-medium text-foreground">{activeSuggestionForModal.matchedText}</span>" to:
                  </p>
                  <div className="bg-neutral-alpha-5 rounded-lg p-4 mb-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <PillLink
                        href={`/${activeSuggestionForModal.id}`}
                        pageId={activeSuggestionForModal.id}
                        clickable={false}
                      >
                        {activeSuggestionForModal.title}
                      </PillLink>
                      {activeSuggestionForModal.username && activeSuggestionForModal.username !== activeSuggestionForModal.userId && (
                        <span className="text-sm text-muted-foreground">
                          by <UsernameBadge
                            username={activeSuggestionForModal.username}
                            userId={activeSuggestionForModal.userId}
                            showBadge={false}
                            size="sm"
                          />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                      onClick={() => insertLinkFromSuggestion(activeSuggestionForModal)}
                    >
                      Accept Suggestion
                    </button>
                    <button
                      className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
                      onClick={() => {
                        setSelectedText(activeSuggestionForModal.matchedText);
                        setShowSuggestionModal(false);
                        setActiveSuggestionForModal(null);
                        setShowLinkModal(true);
                      }}
                    >
                      Choose Different Link
                    </button>
                    <button
                      className="w-full px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => {
                        linkSuggestionActions.dismissSuggestion(activeSuggestionForModal.matchedText);
                        setShowSuggestionModal(false);
                        setActiveSuggestionForModal(null);
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )
          )
        )}
      </div>
    </SimpleErrorBoundary>
  );
};

export default Editor;
