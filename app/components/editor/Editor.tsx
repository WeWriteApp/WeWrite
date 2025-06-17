"use client";

import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useCallback, useMemo } from "react";
import { createPortal } from 'react-dom';
import { usePillStyle } from '../../contexts/PillStyleContext';
import { useLineSettings, LINE_MODES } from '../../contexts/LineSettingsContext';
import { Lock, ExternalLink, X } from "lucide-react";
import FilteredSearchResults from '../search/FilteredSearchResults';
import ParagraphNumberOverlay from './ParagraphNumberOverlay';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { Modal } from '../ui/modal';
import ExternalLinkPreviewModal from '../ui/ExternalLinkPreviewModal';
import { ConfirmationModal } from '../utils/ConfirmationModal';
import {
  determineLinkModalType,
  createLinkInteractionContext,
  extractLinkDataFromElement,
  canUserEditPage
} from '../../utils/linkModalUtils';

// Types
interface EditorProps {
  initialContent?: string | any[]; // Support both string and Slate content
  onChange?: (content: any[]) => void; // Always return Slate format
  placeholder?: string;
  contentType?: 'wiki' | 'about' | 'bio';
  onKeyDown?: (event: React.KeyboardEvent) => void;
  onEmptyLinesChange?: (count: number) => void;
  user?: any; // Current user for permission checking
  currentPage?: any; // Current page for permission checking
  isEditMode?: boolean; // Whether the editor is in edit mode
}

interface EditorRef {
  focus: () => boolean;
  getContent: () => string;
  insertText: (text: string) => boolean;
  insertLink: (linkData: any) => boolean;
  openLinkEditor: () => boolean;
  setShowLinkEditor: (value: boolean) => boolean;
}

interface ParsedLink {
  type: 'page' | 'user' | 'external';
  text: string;
  id?: string;
  url?: string;
  isPublic?: boolean;
  showAuthor?: boolean;
  authorUsername?: string;
}

/**
 * Editor - A lightweight replacement for Slate.js
 *
 * Handles plain text with embedded links in a simple format:
 * - Page links: [Page Title](page:pageId)
 * - User links: [Username](user:userId)
 * - External links: [Link Text](url:https://example.com)
 * - Compound links: [Page Title](page:pageId:author:username)
 */
const Editor = forwardRef<EditorRef, EditorProps>((props, ref) => {
  const {
    initialContent = [{ type: 'paragraph', children: [{ text: '' }] }],
    onChange,
    placeholder = "Start typing...",
    contentType = "wiki",
    onKeyDown,
    onEmptyLinesChange,
    user = null,
    currentPage = null,
    isEditMode = true
  } = props;

  // Optimized state management - minimize re-renders
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkSearchText, setLinkSearchText] = useState("");
  const [linkDisplayText, setLinkDisplayText] = useState("");
  const [selection, setSelection] = useState<Range | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Link editor unsaved changes tracking
  const [showLinkEditorConfirmation, setShowLinkEditorConfirmation] = useState(false);
  const [linkEditorHasChanges, setLinkEditorHasChanges] = useState(false);
  const [initialLinkEditorState, setInitialLinkEditorState] = useState<any>(null);

  // Tab and toggle state for link editor
  const [activeTab, setActiveTab] = useState("page");
  const [showCustomTextToggle, setShowCustomTextToggle] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [showExternalCustomText, setShowExternalCustomText] = useState(false);
  const [externalDisplayText, setExternalDisplayText] = useState("");

  // State for editing existing links
  const [editingLink, setEditingLink] = useState<{
    element: HTMLElement;
    type: 'page' | 'user' | 'external' | 'compound';
    data: any;
  } | null>(null);

  // State for show author toggle (compound links)
  const [showAuthorToggle, setShowAuthorToggle] = useState(false);

  // State for external link preview modal
  const [showExternalLinkPreview, setShowExternalLinkPreview] = useState(false);
  const [previewLinkUrl, setPreviewLinkUrl] = useState("");
  const [previewLinkDisplayText, setPreviewLinkDisplayText] = useState("");

  // Refs for performance - avoid re-renders
  const editorRef = useRef<HTMLDivElement>(null);
  const changeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialized = useRef(false);
  const lastContentRef = useRef<string>('');

  // Memoized style classes to prevent re-computation
  const { getPillStyleClasses } = usePillStyle();
  const { lineMode } = useLineSettings();
  const pillStyleClasses = useMemo(() => getPillStyleClasses(), [getPillStyleClasses]);

  // Helper function to convert Slate to simple text (memoized for performance)
  const convertSlateToSimpleText = useCallback((slateContent: any): string => {
    if (!slateContent || !Array.isArray(slateContent)) return "";

    let result = "";

    for (const node of slateContent) {
      if (node.type === "paragraph" && node.children) {
        for (const child of node.children) {
          if (child.text) {
            result += child.text;
          } else if (child.type === "link") {
            const text = child.children?.[0]?.text || child.pageTitle || child.username || "Link";
            if (child.pageId) {
              if (child.showAuthor && child.authorUsername) {
                result += `[${text}](page:${child.pageId}:author:${child.authorUsername})`;
              } else {
                result += `[${text}](page:${child.pageId})`;
              }
            } else if (child.userId) {
              result += `[${text}](user:${child.userId})`;
            } else if (child.url) {
              result += `[${text}](url:${child.url})`;
            }
          }
        }
        result += "\n";
      }
    }

    return result.trim();
  }, []);

  // Memoized Slate to HTML conversion with improved error handling
  const convertSlateToHTML = useCallback((slateContent: any): string => {
    try {
      if (!slateContent || !Array.isArray(slateContent)) {
        return "<div><br></div>";
      }

      let result = "";

      for (let paragraphIndex = 0; paragraphIndex < slateContent.length; paragraphIndex++) {
        const node = slateContent[paragraphIndex];
        if (node.type === "paragraph" && node.children) {
          result += "<div>";
          let hasContent = false;

          for (const child of node.children) {
            try {
              if (child.text !== undefined) {
                if (child.text === "") {
                  if (!hasContent) {
                    result += "<br>";
                    hasContent = true;
                  }
                } else {
                  result += child.text.replace(/\n/g, '<br>');
                  hasContent = true;
                }
              } else if (child.type === "link") {
                const text = child.children?.[0]?.text || child.pageTitle || child.username || "Link";

                if (child.pageId) {
                  if (child.showAuthor && child.authorUsername) {
                    // CRITICAL FIX: Improved compound link HTML structure with data attributes
                    result += `<span class="compound-link" data-page-id="${child.pageId}" data-author="${child.authorUsername}">`;
                    result += `<span class="${pillStyleClasses} page-link" data-link-type="page" data-id="${child.pageId}" data-page-title="${text}">${text}</span>`;
                    result += ` <span class="text-muted-foreground text-sm">by</span> `;
                    result += `<span class="${pillStyleClasses} user-link" data-link-type="user" data-id="${child.authorUsername}">${child.authorUsername}</span>`;
                    result += `</span>`;
                  } else {
                    // CRITICAL FIX: Add data-page-title for better conversion back to Slate
                    result += `<span class="${pillStyleClasses} page-link" data-link-type="page" data-id="${child.pageId}" data-page-title="${text}">${text}</span>`;
                  }
                } else if (child.userId) {
                  result += `<span class="${pillStyleClasses} user-link" data-link-type="user" data-id="${child.userId}">${text}</span>`;
                } else if (child.url) {
                  result += `<span class="${pillStyleClasses} external-link" data-link-type="external" data-url="${child.url}">${text}</span>`;
                }
                hasContent = true;
              }
            } catch (childError) {
              console.error("Editor: Error processing child node:", childError, child);
              // Skip problematic child nodes but continue processing
              continue;
            }
          }

          if (!hasContent) {
            result += "<br>";
          }

          result += "</div>";
        }
      }

      return result || "<div><br></div>";
    } catch (error) {
      console.error("Editor: Error in Slate to HTML conversion:", error);
      return "<div><br></div>";
    }
  }, [pillStyleClasses]);

  // Memoized HTML to Slate conversion with improved error handling
  const convertHTMLToSlate = useCallback((html: string): any[] => {
    if (typeof document === 'undefined') {
      return [{ type: "paragraph", children: [{ text: "" }] }];
    }

    try {
      // CRITICAL FIX: Remove the problematic content change check that was returning empty content
      // This was causing the save to capture empty content when the HTML hadn't changed
      // We need to always process the HTML to get the actual content, not return empty content

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      const result = [];
      const children = Array.from(tempDiv.children);
      const contentDivs = children.filter(child =>
        child.tagName === 'DIV' && !child.classList.contains('unified-paragraph-number')
      );

      if (contentDivs.length === 0) {
        const textContent = tempDiv.textContent || "";
        if (textContent.trim()) {
          return [{ type: "paragraph", children: [{ text: textContent }] }];
        }
        return [{ type: "paragraph", children: [{ text: "" }] }];
      }
    } catch (error) {
      console.error("Editor: Error in HTML to Slate conversion setup:", error);
      return [{ type: "paragraph", children: [{ text: "" }] }];
    }

    contentDivs.forEach((div) => {
      const paragraph = {
        type: "paragraph",
        children: []
      };

      const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          if (text) {
            paragraph.children.push({ text });
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;

          if (element.classList.contains('unified-paragraph-number')) {
            return;
          }

          if (element.tagName === 'BR') {
            if (paragraph.children.length === 0) {
              paragraph.children.push({ text: "" });
            }
            return;
          }

          if (element.hasAttribute('data-link-type')) {
            const linkType = element.getAttribute('data-link-type');
            const text = element.textContent || "";

            if (linkType === 'page') {
              const pageId = element.getAttribute('data-id');
              const pageTitle = element.getAttribute('data-page-title') || text; // CRITICAL FIX: Use data-page-title if available
              paragraph.children.push({
                type: "link",
                url: `/${pageId}`, // FIXED: Use correct URL format for internal links
                pageId,
                pageTitle,
                originalPageTitle: pageTitle, // ADDED: Preserve original title for view mode
                className: "page-link",
                isPageLink: true,
                children: [{ text: pageTitle }] // FIXED: Use pageTitle for consistency
              });
            } else if (linkType === 'user') {
              const userId = element.getAttribute('data-id');
              paragraph.children.push({
                type: "link",
                url: `/user/${userId}`, // FIXED: Use correct URL format for user links
                userId,
                username: text,
                className: "user-link",
                isUser: true,
                children: [{ text }]
              });
            } else if (linkType === 'external') {
              const url = element.getAttribute('data-url');
              paragraph.children.push({
                type: "link",
                url,
                className: "external-link",
                isExternal: true,
                children: [{ text }]
              });
            }
          } else if (element.classList.contains('compound-link')) {
            // CRITICAL FIX: Handle compound links properly
            const pageId = element.getAttribute('data-page-id');
            const authorUsername = element.getAttribute('data-author');

            // Find the page link element within the compound link
            const pageLink = element.querySelector('.page-link');
            const userLink = element.querySelector('.user-link');

            if (pageLink && pageId) {
              const pageTitle = pageLink.textContent || "";
              paragraph.children.push({
                type: "link",
                url: `/${pageId}`,
                pageId,
                pageTitle,
                originalPageTitle: pageTitle,
                className: "page-link compound-link",
                isPageLink: true,
                showAuthor: true, // ADDED: Mark as compound link
                authorUsername: authorUsername || (userLink ? userLink.textContent : ""),
                children: [{ text: pageTitle }]
              });
            } else {
              // Fallback: process child nodes normally
              element.childNodes.forEach(processNode);
            }
          } else {
            element.childNodes.forEach(processNode);
          }
        }
      };

      div.childNodes.forEach(processNode);

      if (paragraph.children.length === 0) {
        paragraph.children.push({ text: "" });
      }

      result.push(paragraph);
    });

    return result.length > 0 ? result : [{ type: "paragraph", children: [{ text: "" }] }];
  }, []);

  // Improved hydration-safe initialization
  React.useLayoutEffect(() => {
    if (typeof window !== 'undefined') {
      // Add a small delay to ensure DOM is fully ready
      const timer = setTimeout(() => {
        setIsClient(true);
        setIsInitialized(true);
        setIsMounted(true);
        hasInitialized.current = true;
      }, 0);

      return () => clearTimeout(timer);
    }
  }, []);

  // Content initialization effect - runs after DOM is ready with better error handling
  useEffect(() => {
    if (!isClient || !editorRef.current) return;

    try {
      // Ensure we have a valid DOM element before proceeding
      if (!editorRef.current.isConnected) {
        console.warn("Editor: DOM element not connected, skipping initialization");
        return;
      }

      let htmlContent = "<div><br></div>";

      if (typeof initialContent === 'string' && initialContent.trim()) {
        const lines = initialContent.split('\n');
        htmlContent = lines.map(line => `<div>${line || '<br>'}</div>`).join('');
      } else if (initialContent && Array.isArray(initialContent) && initialContent.length > 0) {
        const hasContent = initialContent.some(node =>
          node.children && node.children.some(child => child.text && child.text.trim())
        );

        if (hasContent) {
          htmlContent = convertSlateToHTML(initialContent);
        }
      }

      // Use requestAnimationFrame to ensure DOM is ready for manipulation
      requestAnimationFrame(() => {
        if (editorRef.current && editorRef.current.isConnected) {
          editorRef.current.innerHTML = htmlContent;
          lastContentRef.current = htmlContent;
        }
      });

    } catch (error) {
      console.error("Editor: Error during content initialization:", error);
      // More robust error recovery
      requestAnimationFrame(() => {
        if (editorRef.current && editorRef.current.isConnected) {
          editorRef.current.innerHTML = "<div><br></div>";
          lastContentRef.current = "<div><br></div>";
        }
      });
    }
  }, [isClient, convertSlateToHTML, initialContent]);

  // CRITICAL FIX: Disable the problematic useEffect that causes cursor jumping
  // This useEffect was causing circular updates: user types → onChange → parent updates →
  // initialContent changes → innerHTML update → cursor jumps to beginning
  //
  // The editor should only update its content on initial mount, not on every prop change
  // during active editing. The content is already managed by handleContentChange.

  // Watch for changes to initialContent after initial render - DISABLED TO PREVENT CURSOR JUMPING
  // useEffect(() => {
  //   // This useEffect was causing the cursor jumping issue
  //   // Commenting out to prevent circular updates during typing
  // }, [initialContent, isClient, lineMode]);

  // Memoized selection handling
  const saveSelection = useCallback(() => {
    if (!isClient || typeof window === 'undefined') return;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      setSelection(selection.getRangeAt(0).cloneRange());
    }
  }, [isClient]);

  const restoreSelection = useCallback(() => {
    if (!isClient || typeof window === 'undefined' || !selection) return;

    const windowSelection = window.getSelection();
    windowSelection?.removeAllRanges();
    windowSelection?.addRange(selection);
  }, [isClient, selection]);



  // Optimized content change handling with better error handling
  const handleContentChange = useCallback(() => {
    if (!isClient || !editorRef.current) return;

    try {
      // CRITICAL FIX: Ensure editor always has at least one paragraph
      if (editorRef.current.children.length === 0 ||
          (editorRef.current.children.length === 1 && editorRef.current.textContent?.trim() === '')) {
        editorRef.current.innerHTML = '<div><br></div>';
      }

      const htmlContent = editorRef.current.innerHTML;

      // CRITICAL FIX: Always process content changes for save reliability
      // The previous check was preventing content capture during save operations
      // We need to ensure content is always properly converted and sent to parent
      lastContentRef.current = htmlContent;

      // Clear any existing timeout
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }

      // Debounced update to prevent excessive re-renders
      changeTimeoutRef.current = setTimeout(() => {
        try {
          const slateContent = convertHTMLToSlate(htmlContent);
          console.log("🔵 Editor.handleContentChange: Converting to Slate:", {
            htmlLength: htmlContent.length,
            slateLength: slateContent.length,
            hasContent: slateContent.some(p => p.children && p.children.some(c => c.text && c.text.trim()))
          });

          onChange?.(slateContent);

          // Count empty lines by checking actual DOM divs
          if (onEmptyLinesChange && editorRef.current) {
            const divs = editorRef.current.querySelectorAll('div:not(.unified-paragraph-number)');
            let emptyLineCount = 0;

            divs.forEach((div) => {
              const textContent = div.textContent || '';
              const hasOnlyBr = div.innerHTML === '<br>' || div.innerHTML === '<br/>';
              const isEmpty = textContent.trim() === '' || hasOnlyBr;

              if (isEmpty) {
                emptyLineCount++;
              }
            });

            onEmptyLinesChange(emptyLineCount);
          }
        } catch (error) {
          console.error("Editor: Error in content change processing:", error);
          // Fallback to basic content structure
          onChange?.([{ type: "paragraph", children: [{ text: "" }] }]);
        }
      }, 150);
    } catch (error) {
      console.error("Editor: Error in handleContentChange:", error);
      // Ensure editor has valid content even on error
      if (editorRef.current) {
        editorRef.current.innerHTML = '<div><br></div>';
      }
    }
  }, [isClient, onChange, onEmptyLinesChange, convertHTMLToSlate]);

  // Handle input events
  const handleInput = useCallback(() => {
    if (!isClient) return;
    handleContentChange();
  }, [isClient, handleContentChange]);

  // Simplified selection handling - just save selection for link insertion
  const handleSelectionChange = useCallback(() => {
    // Just save the selection for link insertion - no complex manipulation
    if (!isClient || typeof window === 'undefined') return;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      setSelection(selection.getRangeAt(0).cloneRange());
    }
  }, [isClient]);

  // Handle click events for link editing with modal type determination
  const handleEditorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isClient) return;

    const target = e.target as HTMLElement;

    // Check if clicked element is a link or inside a link
    const linkElement = target.closest('[data-link-type]') as HTMLElement;
    const compoundElement = target.closest('.compound-link') as HTMLElement;
    const actualLinkElement = compoundElement || linkElement;

    if (actualLinkElement) {
      e.preventDefault();
      e.stopPropagation();

      // Create interaction context
      const context = createLinkInteractionContext(
        user,
        currentPage,
        isEditMode,
        actualLinkElement,
        'edit' // In editor, clicks are edit actions
      );

      // Determine which modal to show
      const modalType = determineLinkModalType(context);

      if (context.linkType === 'external' && modalType === 'preview') {
        // Show preview modal for external links when user can't edit or is in view mode
        const url = actualLinkElement.getAttribute('data-url') ||
                   linkElement?.getAttribute('data-url');
        const displayText = actualLinkElement.textContent || '';

        if (url) {
          setPreviewLinkUrl(url);
          setPreviewLinkDisplayText(displayText);
          setShowExternalLinkPreview(true);
        }
      } else {
        // Show editor modal - extract link data for editing
        const linkData = extractLinkDataFromElement(actualLinkElement);
        openLinkEditorForEdit(linkData);
      }
    }
  }, [isClient, user, currentPage, isEditMode]);

  // Handle blur events - ensure parent gets final content
  const handleBlur = useCallback(() => {
    if (!isClient || !editorRef.current) return;

    // Clear any pending timeout and immediately notify parent
    if (changeTimeoutRef.current) {
      clearTimeout(changeTimeoutRef.current);
    }

    const htmlContent = editorRef.current.innerHTML;
    const slateContent = convertHTMLToSlate(htmlContent);

    // Immediately notify parent on blur
    onChange?.(slateContent);

    // Count empty lines by checking actual DOM divs
    if (onEmptyLinesChange && editorRef.current) {
      const divs = editorRef.current.querySelectorAll('div:not(.unified-paragraph-number)');
      let emptyLineCount = 0;

      divs.forEach((div) => {
        const textContent = div.textContent || '';
        const hasOnlyBr = div.innerHTML === '<br>' || div.innerHTML === '<br/>';
        const isEmpty = textContent.trim() === '' || hasOnlyBr;

        if (isEmpty) {
          emptyLineCount++;
        }
      });

      onEmptyLinesChange(emptyLineCount);
    }

    saveSelection();
  }, [isClient, onChange, onEmptyLinesChange, saveSelection]);

  // Simplified delete key handling - no complex manipulation
  const handleDeleteKey = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Let the browser handle delete operations naturally
    // This prevents conflicts with React's DOM management
  }, []);

  // Handle key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isClient) return;

    onKeyDown?.(e);

    // CRITICAL FIX: Prevent deletion of the last paragraph
    if ((e.key === 'Backspace' || e.key === 'Delete') && editorRef.current) {
      const divs = editorRef.current.querySelectorAll('div');

      // If there's only one div left, prevent deletion if it would empty the editor
      if (divs.length === 1) {
        const lastDiv = divs[0];
        const textContent = lastDiv.textContent || '';
        const selection = window.getSelection();

        // If the selection would delete all content from the last paragraph, prevent it
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const isSelectingAll = range.startOffset === 0 &&
                                range.endOffset === textContent.length;
          const isAtStart = range.startOffset === 0 && range.collapsed;

          if (isSelectingAll || (isAtStart && e.key === 'Backspace' && textContent.trim() === '')) {
            e.preventDefault();
            return;
          }
        }
      }
    }

    // ENHANCED: Check for delete operations that might affect paragraph numbers
    handleDeleteKey(e);

    // Handle Ctrl+K for link insertion
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      saveSelection();
      setLinkSearchText("");
      setLinkDisplayText("");
      setShowLinkEditor(true);
    }

    // Simplified Enter key handling - let browser handle most of it
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      // Let the browser handle Enter naturally, just trigger content change
      setTimeout(() => {
        handleContentChange();
      }, 10);
    }
  }, [isClient, onKeyDown, saveSelection]);

  // Function to capture initial link editor state for change detection
  const captureInitialLinkEditorState = useCallback(() => {
    const state = {
      linkSearchText,
      linkDisplayText,
      showCustomTextToggle,
      showAuthorToggle,
      externalUrl,
      externalDisplayText,
      showExternalCustomText,
      activeTab,
      editingLink
    };
    setInitialLinkEditorState(state);
    setLinkEditorHasChanges(false);
  }, [linkSearchText, linkDisplayText, showCustomTextToggle, showAuthorToggle, externalUrl, externalDisplayText, showExternalCustomText, activeTab, editingLink]);

  // Function to open link editor for editing existing links
  const openLinkEditorForEdit = useCallback((linkData: any) => {
    setEditingLink(linkData);

    // Pre-populate the form based on link type
    if (linkData.type === 'external') {
      setActiveTab('external');
      setExternalUrl(linkData.url || '');
      setExternalDisplayText(linkData.text || '');
      setShowExternalCustomText(!!linkData.text && linkData.text !== linkData.url);
      // Clear page-related fields
      setLinkSearchText('');
      setLinkDisplayText('');
      setShowCustomTextToggle(false);
    } else if (linkData.type === 'page' || linkData.type === 'user' || linkData.type === 'compound') {
      setActiveTab('page');
      setLinkDisplayText(linkData.text || '');
      setShowCustomTextToggle(true); // Show custom text since we're editing

      // Set show author toggle based on link type
      setShowAuthorToggle(linkData.type === 'compound');

      // For page links, try to pre-populate the search with the current page title
      if (linkData.type === 'page' || linkData.type === 'compound') {
        setLinkSearchText(linkData.text || '');
      }

      // Clear external fields
      setExternalUrl('');
      setExternalDisplayText('');
      setShowExternalCustomText(false);
    }

    setShowLinkEditor(true);

    // Capture initial state after setting up the form
    setTimeout(() => {
      captureInitialLinkEditorState();
    }, 100);
  }, [captureInitialLinkEditorState]);

  // Function to reset all link editor state
  const resetLinkEditorState = useCallback(() => {
    setEditingLink(null);
    setLinkSearchText("");
    setLinkDisplayText("");
    setShowCustomTextToggle(false);
    setShowAuthorToggle(false);
    setExternalUrl("");
    setExternalDisplayText("");
    setShowExternalCustomText(false);
    setLinkEditorHasChanges(false);
    setInitialLinkEditorState(null);
  }, []);

  // Function to check if link editor has unsaved changes
  const checkLinkEditorChanges = useCallback(() => {
    if (!initialLinkEditorState) return false;

    const currentState = {
      linkSearchText,
      linkDisplayText,
      showCustomTextToggle,
      showAuthorToggle,
      externalUrl,
      externalDisplayText,
      showExternalCustomText,
      activeTab,
      editingLink
    };

    // Compare current state with initial state
    const hasChanges = JSON.stringify(currentState) !== JSON.stringify(initialLinkEditorState);
    setLinkEditorHasChanges(hasChanges);
    return hasChanges;
  }, [initialLinkEditorState, linkSearchText, linkDisplayText, showCustomTextToggle, showAuthorToggle, externalUrl, externalDisplayText, showExternalCustomText, activeTab, editingLink]);

  // Effect to track changes in link editor
  useEffect(() => {
    if (showLinkEditor && initialLinkEditorState) {
      checkLinkEditorChanges();
    }
  }, [showLinkEditor, checkLinkEditorChanges, linkSearchText, linkDisplayText, showCustomTextToggle, showAuthorToggle, externalUrl, externalDisplayText, showExternalCustomText, activeTab]);

  // Function to handle link editor close attempt
  const handleLinkEditorClose = useCallback(() => {
    const hasChanges = checkLinkEditorChanges();

    if (hasChanges) {
      // Show confirmation modal if there are unsaved changes
      setShowLinkEditorConfirmation(true);
    } else {
      // Close immediately if no changes
      setShowLinkEditor(false);
      resetLinkEditorState();
    }
  }, [checkLinkEditorChanges, resetLinkEditorState]);

  // Function to handle confirmation modal - discard changes
  const handleDiscardLinkEditorChanges = useCallback(() => {
    setShowLinkEditorConfirmation(false);
    setShowLinkEditor(false);
    resetLinkEditorState();
  }, [resetLinkEditorState]);

  // Function to handle confirmation modal - keep editing
  const handleKeepEditingLink = useCallback(() => {
    setShowLinkEditorConfirmation(false);
    // Keep the link editor open, don't reset state
  }, []);

  // Handle external link creation
  const handleExternalLinkCreate = useCallback(() => {
    if (!editorRef.current || !externalUrl.trim()) return;

    // Enhanced URL validation
    let url = externalUrl.trim();

    // Check if it's a valid URL pattern
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlPattern.test(url)) {
      // Basic validation failed, but still try to make it work
      console.warn('URL validation failed for:', url);
    }

    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const displayText = showExternalCustomText && externalDisplayText.trim()
      ? externalDisplayText.trim()
      : url;

    const linkHTML = `<span class="${pillStyleClasses} external-link" data-link-type="external" data-url="${url}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;

    if (editingLink) {
      // Update existing link
      editingLink.element.outerHTML = linkHTML;
      setEditingLink(null);
    } else {
      // Create new link
      if (selection) {
        try {
          // CRITICAL FIX: Improved selection restoration and link insertion for external links
          restoreSelection();
          const currentSelection = window.getSelection();
          if (currentSelection && currentSelection.rangeCount > 0) {
            const range = currentSelection.getRangeAt(0);

            // Clear any selected content first
            range.deleteContents();

            // Create the link element properly
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = linkHTML;
            const linkElement = tempDiv.firstChild;

            if (linkElement) {
              // Insert the link at the cursor position
              range.insertNode(linkElement);

              // Add a space after the link and position cursor after it
              const spaceNode = document.createTextNode('\u00A0'); // Non-breaking space
              range.setStartAfter(linkElement);
              range.insertNode(spaceNode);
              range.setStartAfter(spaceNode);
              range.collapse(true);

              // Update the selection to position cursor after the link
              currentSelection.removeAllRanges();
              currentSelection.addRange(range);
            }
          } else {
            // Fallback to execCommand if range is not available
            document.execCommand('insertHTML', false, linkHTML + '&nbsp;');
          }
        } catch (error) {
          console.error('Error inserting external link at cursor position:', error);
          // Final fallback: use execCommand
          document.execCommand('insertHTML', false, linkHTML + '&nbsp;');
        }
      } else {
        // No saved selection - focus editor and insert at current position
        editorRef.current.focus();
        document.execCommand('insertHTML', false, linkHTML + '&nbsp;');
      }
    }

    // Reset state and close modal
    setShowLinkEditor(false);
    resetLinkEditorState();
    handleContentChange();
  }, [externalUrl, externalDisplayText, showExternalCustomText, pillStyleClasses, selection, restoreSelection, handleContentChange]);

  // Optimized link selection handling
  const handleLinkSelect = useCallback((item: any) => {
    if (!editorRef.current) return;

    const displayText = (showCustomTextToggle && linkDisplayText.trim()) || item.title || item.username;
    let linkHTML = "";

    if (item.type === 'page' || item.id) {
      // Check if we should create a compound link (show author is enabled) or if we're editing a compound link
      if (showAuthorToggle || (editingLink && editingLink.type === 'compound')) {
        // Create compound link with author attribution
        const authorUsername = item.username || item.authorUsername || 'Unknown Author';
        linkHTML = `<span class="compound-link" data-page-id="${item.id}" data-author="${authorUsername}" contenteditable="false" style="user-select: none; cursor: pointer;">`;
        linkHTML += `<span class="${pillStyleClasses} page-link" data-link-type="page" data-id="${item.id}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
        linkHTML += ` <span class="text-muted-foreground text-sm">by</span> `;
        linkHTML += `<span class="${pillStyleClasses} user-link" data-link-type="user" data-id="${authorUsername}" contenteditable="false" style="user-select: none; cursor: pointer;">${authorUsername}</span>`;
        linkHTML += `</span>`;
      } else {
        // Regular page link
        linkHTML = `<span class="${pillStyleClasses} page-link" data-link-type="page" data-id="${item.id}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
      }
    } else if (item.type === 'user') {
      linkHTML = `<span class="${pillStyleClasses} user-link" data-link-type="user" data-id="${item.id}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
    }

    if (editingLink) {
      // Update existing link
      editingLink.element.outerHTML = linkHTML;
      setEditingLink(null);
    } else {
      // Create new link
      if (selection) {
        try {
          // CRITICAL FIX: Improved selection restoration and link insertion
          restoreSelection();
          const currentSelection = window.getSelection();
          if (currentSelection && currentSelection.rangeCount > 0) {
            const range = currentSelection.getRangeAt(0);

            // Clear any selected content first
            range.deleteContents();

            // Create the link element properly
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = linkHTML;
            const linkElement = tempDiv.firstChild;

            if (linkElement) {
              // Insert the link at the cursor position
              range.insertNode(linkElement);

              // Add a space after the link and position cursor after it
              const spaceNode = document.createTextNode('\u00A0'); // Non-breaking space
              range.setStartAfter(linkElement);
              range.insertNode(spaceNode);
              range.setStartAfter(spaceNode);
              range.collapse(true);

              // Update the selection to position cursor after the link
              currentSelection.removeAllRanges();
              currentSelection.addRange(range);
            }
          } else {
            // Fallback to execCommand if range is not available
            document.execCommand('insertHTML', false, linkHTML + '&nbsp;');
          }
        } catch (error) {
          console.error('Error inserting link at cursor position:', error);
          // Final fallback: use execCommand
          document.execCommand('insertHTML', false, linkHTML + '&nbsp;');
        }
      } else {
        // No saved selection - focus editor and insert at current position
        editorRef.current.focus();
        document.execCommand('insertHTML', false, linkHTML + '&nbsp;');
      }
    }

    // Update content
    handleContentChange();

    // Focus back to editor
    setTimeout(() => {
      editorRef.current?.focus();
    }, 100);

    // Reset link editor state and close modal
    setShowLinkEditor(false);
    resetLinkEditorState();
    return true;
  }, [linkDisplayText, pillStyleClasses, selection, restoreSelection, handleContentChange, editingLink, showAuthorToggle]);

  // Optimized link insertion for external API
  const insertLink = useCallback((linkData: any) => {
    if (!editorRef.current) return false;

    const displayText = linkData.pageTitle || linkData.username || linkData.text || "Link";
    let linkHTML = "";

    if (linkData.pageId) {
      if (linkData.showAuthor && linkData.authorUsername) {
        linkHTML = `<span class="compound-link" data-page-id="${linkData.pageId}" data-author="${linkData.authorUsername}" contenteditable="false" style="user-select: none; cursor: pointer;">`;
        linkHTML += `<span class="${pillStyleClasses} page-link" data-link-type="page" data-id="${linkData.pageId}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
        linkHTML += ` <span class="text-muted-foreground text-sm">by</span> `;
        linkHTML += `<span class="${pillStyleClasses} user-link" data-link-type="user" data-id="${linkData.authorUsername}" contenteditable="false" style="user-select: none; cursor: pointer;">${linkData.authorUsername}</span>`;
        linkHTML += `</span>`;
      } else {
        linkHTML = `<span class="${pillStyleClasses} page-link" data-link-type="page" data-id="${linkData.pageId}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
      }
    } else if (linkData.userId) {
      linkHTML = `<span class="${pillStyleClasses} user-link" data-link-type="user" data-id="${linkData.userId}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
    } else if (linkData.url) {
      linkHTML = `<span class="${pillStyleClasses} external-link" data-link-type="external" data-url="${linkData.url}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
    }

    // Insert the link
    if (typeof document !== 'undefined' && document.execCommand) {
      document.execCommand('insertHTML', false, linkHTML + '&nbsp;');
    }
    handleContentChange();

    setShowLinkEditor(false);
    return true;
  }, [pillStyleClasses, handleContentChange]);

  // Function to delete all empty lines
  const deleteAllEmptyLines = useCallback(() => {
    if (!editorRef.current) return false;

    const divs = editorRef.current.querySelectorAll('div');
    let hasChanges = false;

    divs.forEach((div) => {
      // Check if the div is empty or contains only whitespace/br tags
      const textContent = div.textContent || '';
      const hasOnlyBr = div.innerHTML === '<br>' || div.innerHTML === '<br/>';
      const isEmpty = textContent.trim() === '' || hasOnlyBr;

      if (isEmpty && div.parentNode) {
        // Don't remove the last div if it would leave the editor completely empty
        const allDivs = editorRef.current.querySelectorAll('div');
        if (allDivs.length > 1) {
          div.remove();
          hasChanges = true;
        }
      }
    });

    // Ensure we always have at least one div
    if (editorRef.current.children.length === 0) {
      editorRef.current.innerHTML = '<div><br></div>';
      hasChanges = true;
    }

    // Trigger content change if we made modifications
    if (hasChanges) {
      handleContentChange();
    }

    return hasChanges;
  }, [handleContentChange]);

  // Memoized imperative handle to prevent unnecessary re-creation
  useImperativeHandle(ref, () => ({
    focus: () => {
      editorRef.current?.focus();
      return true;
    },
    getContent: () => {
      if (!editorRef.current) {
        console.warn("🟡 Editor.getContent: editorRef.current is null");
        return [{ type: "paragraph", children: [{ text: "" }] }];
      }

      // CRITICAL FIX: Ensure editor has content before capturing
      if (editorRef.current.children.length === 0) {
        console.warn("🟡 Editor.getContent: Editor is empty, adding default paragraph");
        editorRef.current.innerHTML = '<div><br></div>';
      }

      const htmlContent = editorRef.current.innerHTML;
      console.log("🔵 Editor.getContent: Capturing content:", {
        htmlLength: htmlContent.length,
        htmlPreview: htmlContent.substring(0, 200),
        divCount: editorRef.current.querySelectorAll('div').length,
        fullHTML: htmlContent
      });

      const slateContent = convertHTMLToSlate(htmlContent);
      console.log("🔵 Editor.getContent: Converted to Slate:", {
        paragraphCount: slateContent.length,
        hasText: slateContent.some(p => p.children && p.children.some(c => c.text && c.text.trim())),
        fullSlateContent: JSON.stringify(slateContent, null, 2)
      });

      // CRITICAL FIX: Ensure we always return valid content
      if (!slateContent || slateContent.length === 0) {
        console.warn("🟡 Editor.getContent: Slate conversion failed, returning default");
        return [{ type: "paragraph", children: [{ text: "" }] }];
      }

      return slateContent;
    },
    insertText: (text: string) => {
      if (editorRef.current && typeof document !== 'undefined' && document.execCommand) {
        const selection = window.getSelection();
        let savedRange = null;
        if (selection && selection.rangeCount > 0) {
          savedRange = selection.getRangeAt(0).cloneRange();
        }

        document.execCommand('insertText', false, text);
        handleContentChange();

        if (savedRange) {
          requestAnimationFrame(() => {
            try {
              const newSelection = window.getSelection();
              if (newSelection) {
                newSelection.removeAllRanges();
                newSelection.addRange(savedRange);
              }
            } catch (error) {
              console.debug('Selection restoration failed in insertText:', error);
            }
          });
        }
      }
      return true;
    },
    insertLink,
    openLinkEditor: () => {
      saveSelection();
      // Reset all link editor state
      setLinkSearchText("");
      setLinkDisplayText("");
      setShowCustomTextToggle(false);
      setShowAuthorToggle(false);
      setExternalUrl("");
      setExternalDisplayText("");
      setShowExternalCustomText(false);
      // Keep the last selected tab for better UX
      setShowLinkEditor(true);

      // Capture initial state for new link creation
      setTimeout(() => {
        captureInitialLinkEditorState();
      }, 100);

      return true;
    },
    setShowLinkEditor: (value: boolean) => {
      setShowLinkEditor(value);
      return true;
    },
    deleteAllEmptyLines
  }), [handleContentChange, insertLink, saveSelection, convertHTMLToSlate, deleteAllEmptyLines]);

  // Memoized class names to prevent re-computation
  const editorClassName = useMemo(() =>
    `prose prose-lg max-w-none focus:outline-none editor-content page-editor-stable box-border ${lineMode === LINE_MODES.DENSE ? 'dense-mode' : 'normal-mode'}`,
    [lineMode]
  );

  // Render with error boundary protection
  try {
    return (
      <div className="editor w-full">
        {/* WYSIWYG Editor with consistent dimensions to prevent layout shifts */}
        <div className="page-content unified-editor relative rounded-lg bg-background w-full max-w-none">
          {typeof window !== 'undefined' && isClient && isMounted ? (
            <>
              <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                onSelect={handleSelectionChange}
                onClick={handleEditorClick}
                className={editorClassName}
                data-placeholder={placeholder}
                suppressContentEditableWarning={true}
                style={{
                  minHeight: '400px',
                  opacity: isInitialized ? 1 : 0,
                  transition: 'opacity 0.15s ease-in-out'
                }}
              />
              {/* Paragraph Number Overlay - Completely separate from contentEditable */}
              {isInitialized && <ParagraphNumberOverlay editorRef={editorRef} />}
            </>
          ) : (
            // Skeleton loader with exact same dimensions to prevent layout shifts
            <div
              className="prose prose-lg max-w-none page-editor-stable box-border animate-pulse"
              style={{ minHeight: '400px' }}
            >
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-5/6"></div>
              </div>
            </div>
          )}
        </div>

      {/* Link Editor Modal - Using consistent Modal component */}
      {isMounted && (
        <Modal
          isOpen={showLinkEditor}
          onClose={handleLinkEditorClose}
          title={editingLink ? "Edit Link" : "Insert Link"}
          className="md:max-w-2xl md:h-[600px] h-full flex flex-col"
          showCloseButton={true}
        >
          <div className="flex-1 flex flex-col min-h-0">
            {/* Mobile: Add visual indicator for slide-up modal */}
            <div className="md:hidden flex justify-center mb-4">
              <div className="w-12 h-1 bg-muted-foreground/30 rounded-full"></div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 mb-4 md:mb-4 mb-6">
                <TabsTrigger value="page" className="py-3 md:py-2">WeWrite page</TabsTrigger>
                <TabsTrigger value="external" className="py-3 md:py-2">External link</TabsTrigger>
              </TabsList>

              <TabsContent value="page" className="flex-1 flex flex-col mt-0 min-h-0">
                {/* Show author toggle for compound links */}
                <div className="flex items-center justify-between mb-6 md:mb-4">
                  <label className="text-base md:text-sm font-medium">Show author</label>
                  <Switch
                    checked={showAuthorToggle}
                    onCheckedChange={setShowAuthorToggle}
                  />
                </div>

                {/* Custom text toggle for WeWrite pages */}
                <div className="flex items-center justify-between mb-6 md:mb-4">
                  <label className="text-base md:text-sm font-medium">Custom link text</label>
                  <Switch
                    checked={showCustomTextToggle}
                    onCheckedChange={setShowCustomTextToggle}
                  />
                </div>

                {/* Custom text input - only show when toggle is enabled */}
                {showCustomTextToggle && (
                  <div className="mb-6 md:mb-4">
                    <input
                      type="text"
                      value={linkDisplayText}
                      onChange={(e) => setLinkDisplayText(e.target.value)}
                      placeholder="Enter custom link text"
                      className="w-full px-4 py-3 md:px-3 md:py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base md:text-sm"
                    />
                  </div>
                )}

                {/* Search results with fixed height */}
                <div className="flex-1 min-h-0">
                  <FilteredSearchResults
                    onSelect={handleLinkSelect}
                    placeholder="Search for pages to link..."
                    setDisplayText={setLinkDisplayText}
                    displayText={linkDisplayText}
                    autoFocus={activeTab === "page"}
                    className="h-full"
                  />
                </div>
              </TabsContent>

              <TabsContent value="external" className="flex-1 flex flex-col mt-0">
                {/* URL input */}
                <div className="mb-6 md:mb-4">
                  <label className="block text-base md:text-sm font-medium mb-3 md:mb-2">URL</label>
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && externalUrl.trim()) {
                        e.preventDefault();
                        handleExternalLinkCreate();
                      }
                    }}
                    placeholder="https://example.com"
                    className="w-full px-4 py-3 md:px-3 md:py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base md:text-sm"
                    autoFocus={activeTab === "external"}
                  />
                </div>

                {/* Custom text toggle for external links */}
                <div className="flex items-center justify-between mb-6 md:mb-4">
                  <label className="text-base md:text-sm font-medium">Custom link text</label>
                  <Switch
                    checked={showExternalCustomText}
                    onCheckedChange={setShowExternalCustomText}
                  />
                </div>

                {/* Custom text input - only show when toggle is enabled */}
                {showExternalCustomText && (
                  <div className="mb-6 md:mb-4">
                    <input
                      type="text"
                      value={externalDisplayText}
                      onChange={(e) => setExternalDisplayText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && externalUrl.trim()) {
                          e.preventDefault();
                          handleExternalLinkCreate();
                        }
                      }}
                      placeholder="Enter custom link text"
                      className="w-full px-4 py-3 md:px-3 md:py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base md:text-sm"
                    />
                  </div>
                )}

                {/* Create button */}
                <div className="mt-auto pt-6 md:pt-4">
                  <button
                    onClick={handleExternalLinkCreate}
                    disabled={!externalUrl.trim()}
                    className="w-full px-4 py-4 md:py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base md:text-sm font-medium"
                  >
                    {editingLink ? "Update Link" : "Create Link"}
                  </button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </Modal>
      )}

      {/* External Link Preview Modal */}
      {isMounted && (
        <ExternalLinkPreviewModal
          isOpen={showExternalLinkPreview}
          onClose={() => setShowExternalLinkPreview(false)}
          url={previewLinkUrl}
          displayText={previewLinkDisplayText}
        />
      )}

      {/* Link Editor Unsaved Changes Confirmation Modal */}
      <ConfirmationModal
        isOpen={showLinkEditorConfirmation}
        onClose={handleKeepEditingLink}
        onConfirm={handleDiscardLinkEditorChanges}
        title="Discard Link Changes?"
        message="You have unsaved changes to this link. Are you sure you want to close the link editor without saving?"
        confirmText="Discard Changes"
        cancelText="Keep Editing"
        variant="warning"
        icon="warning"
      />
    </div>
  );
  } catch (error) {
    console.error("Editor: Critical render error:", error);
    // Fallback UI for critical errors
    return (
      <div className="editor w-full">
        <div className="page-content unified-editor relative rounded-lg bg-background w-full max-w-none">
          <div
            className="prose prose-lg max-w-none page-editor-stable box-border"
            style={{ minHeight: '400px' }}
          >
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <div className="text-muted-foreground">
                  <p className="font-medium">Editor temporarily unavailable</p>
                  <p className="text-sm mt-2">
                    Please refresh the page to continue editing.
                  </p>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
});

Editor.displayName = "Editor";

export default Editor;
