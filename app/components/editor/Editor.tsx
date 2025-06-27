"use client";

import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useCallback, useMemo } from "react";
import { createPortal } from 'react-dom';
import { usePillStyle } from '../../contexts/PillStyleContext';
import { useLineSettings, LINE_MODES } from '../../contexts/LineSettingsContext';
import { Lock, ExternalLink, X } from "lucide-react";
import FilteredSearchResults from '../search/FilteredSearchResults';
import ParagraphNumberOverlay from './ParagraphNumberOverlay';
import NonInterferingParagraphNumbers from './NonInterferingParagraphNumbers';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { cn } from '../../lib/utils';
import { Modal } from '../ui/modal';
import ExternalLinkPreviewModal from '../ui/ExternalLinkPreviewModal';
import { ConfirmationModal } from '../utils/ConfirmationModal';
import {
  determineLinkModalType,
  createLinkInteractionContext,
  extractLinkDataFromElement,
  canUserEditPage
} from '../../utils/linkModalUtils';
import { handlePaste, insertProcessedContent } from "../../utils/pasteHandler";

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
  isNewPage?: boolean; // Whether this is a new page for tab order
  readOnly?: boolean; // New prop for unified view/edit mode
  canEdit?: boolean; // Whether user has edit permissions
  onSetIsEditing?: (isEditing: boolean, clickPosition?: any) => void; // Callback to switch to edit mode
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
    isEditMode = true,
    isNewPage = false,
    readOnly = false,
    canEdit = false,
    onSetIsEditing
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
  const pillStyleClasses = useMemo(() => getPillStyleClasses('editor'), [getPillStyleClasses]);

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
        return "<div>&nbsp;</div>";
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
                    result += "&nbsp;";
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
            result += "&nbsp;";
          }

          result += "</div>";
        }
      }

      return result || "<div>&nbsp;</div>";
    } catch (error) {
      console.error("Editor: Error in Slate to HTML conversion:", error);
      return "<div>&nbsp;</div>";
    }
  }, [pillStyleClasses]);

  // Memoized HTML to Slate conversion with improved error handling
  const convertHTMLToSlate = useCallback((html: string): any[] => {
    if (typeof document === 'undefined') {
      return [{ type: "paragraph", children: [{ text: "" }] }];
    }

    try {
      console.log("🔵 convertHTMLToSlate: Starting conversion with HTML:", html.substring(0, 500));

      // CRITICAL FIX: Declare variables outside try block to avoid scope issues
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      const result = [];
      const children = Array.from(tempDiv.children);
      console.log("🔵 convertHTMLToSlate: Found children:", children.length);

      const contentDivs = children.filter(child => {
        try {
          return child.tagName === 'DIV' && !child.classList?.contains('unified-paragraph-number');
        } catch (error) {
          console.error('Error filtering content divs:', error);
          return child.tagName === 'DIV';
        }
      });

      console.log("🔵 convertHTMLToSlate: Content divs after filtering:", contentDivs.length);

      if (contentDivs.length === 0) {
        // Check if there are any direct children that are not divs (like links)
        const directChildren = Array.from(tempDiv.children).filter(child =>
          child.tagName !== 'DIV' && !child.classList?.contains('unified-paragraph-number')
        );

        console.log("🔵 convertHTMLToSlate: No content divs, direct children:", directChildren.length);

        if (directChildren.length > 0) {
          // Process direct children as a single paragraph
          const paragraph = {
            type: "paragraph",
            children: []
          };

          const processNode = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              const text = node.textContent || "";
              if (text && text !== '\u00A0') {
                console.log("🔵 convertHTMLToSlate: Adding text node:", text);
                paragraph.children.push({ text });
              }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;

              if (element.hasAttribute('data-link-type')) {
                const linkType = element.getAttribute('data-link-type');
                const text = element.textContent || "";
                console.log(`🔵 convertHTMLToSlate: Processing direct link - type: ${linkType}, text: ${text}`);

                if (linkType === 'page') {
                  const pageId = element.getAttribute('data-id');
                  const pageTitle = element.getAttribute('data-page-title') || text;
                  console.log(`🔵 convertHTMLToSlate: Direct page link - pageId: ${pageId}, pageTitle: ${pageTitle}`);

                  const linkNode = {
                    type: "link",
                    url: `/${pageId}`,
                    pageId,
                    pageTitle,
                    originalPageTitle: pageTitle,
                    className: "page-link",
                    isPageLink: true,
                    children: [{ text: pageTitle }]
                  };

                  console.log("🔵 convertHTMLToSlate: Adding direct page link node:", linkNode);
                  paragraph.children.push(linkNode);
                }
              }
            }
          };

          // Process all direct children and text nodes
          tempDiv.childNodes.forEach(processNode);

          if (paragraph.children.length === 0) {
            paragraph.children.push({ text: "" });
          }

          console.log("🔵 convertHTMLToSlate: Direct children paragraph:", paragraph);
          return [paragraph];
        }

        const textContent = tempDiv.textContent || "";
        console.log("🔵 convertHTMLToSlate: No content divs, text content:", textContent);
        if (textContent.trim()) {
          return [{ type: "paragraph", children: [{ text: textContent }] }];
        }
        return [{ type: "paragraph", children: [{ text: "" }] }];
      }

      // CRITICAL FIX: Process all children (both divs and non-divs) to capture sibling links
      const allChildren = Array.from(tempDiv.children);
      const processedElements = new Set(); // Track processed elements to avoid duplicates

      // First, process content divs
      contentDivs.forEach((div, divIndex) => {
        console.log(`🔵 convertHTMLToSlate: Processing div ${divIndex}:`, div.innerHTML);
        processedElements.add(div);

        const paragraph = {
          type: "paragraph",
          children: []
        };

        const processNode = (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || "";
            // CRITICAL FIX: Handle &nbsp; as empty content for proper contentEditable behavior
            if (text && text !== '\u00A0') { // \u00A0 is the non-breaking space character
              console.log("🔵 convertHTMLToSlate: Adding text node:", text);
              paragraph.children.push({ text });
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;

            try {
              if (element.classList?.contains('unified-paragraph-number')) {
                return;
              }
            } catch (error) {
              console.error('Error checking classList:', error);
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
              console.log(`🔵 convertHTMLToSlate: Processing link - type: ${linkType}, text: ${text}`);

              if (linkType === 'page') {
                const pageId = element.getAttribute('data-id');
                const pageTitle = element.getAttribute('data-page-title') || text; // CRITICAL FIX: Use data-page-title if available
                console.log(`🔵 convertHTMLToSlate: Page link - pageId: ${pageId}, pageTitle: ${pageTitle}`);

                const linkNode = {
                  type: "link",
                  url: `/${pageId}`, // FIXED: Use correct URL format for internal links
                  pageId,
                  pageTitle,
                  originalPageTitle: pageTitle, // ADDED: Preserve original title for view mode
                  className: "page-link",
                  isPageLink: true,
                  children: [{ text: pageTitle }] // FIXED: Use pageTitle for consistency
                };

                console.log("🔵 convertHTMLToSlate: Adding page link node:", linkNode);
                paragraph.children.push(linkNode);
              } else if (linkType === 'user') {
                const userId = element.getAttribute('data-id');
                console.log(`🔵 convertHTMLToSlate: User link - userId: ${userId}`);

                const linkNode = {
                  type: "link",
                  url: `/user/${userId}`, // FIXED: Use correct URL format for user links
                  userId,
                  username: text,
                  className: "user-link",
                  isUser: true,
                  children: [{ text }]
                };

                console.log("🔵 convertHTMLToSlate: Adding user link node:", linkNode);
                paragraph.children.push(linkNode);
              } else if (linkType === 'external') {
                const url = element.getAttribute('data-url');
                console.log('🔵 Converting external link to Slate:', { url, text, linkType, element });

                const linkNode = {
                  type: "link",
                  url,
                  className: "external-link",
                  isExternal: true,
                  children: [{ text }]
                };

                console.log("🔵 convertHTMLToSlate: Adding external link node:", linkNode);
                paragraph.children.push(linkNode);
              }
            } else if (element.classList?.contains('compound-link')) {
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
          console.log("🔵 convertHTMLToSlate: Empty paragraph, adding empty text");
          paragraph.children.push({ text: "" });
        }

        console.log(`🔵 convertHTMLToSlate: Final paragraph ${divIndex}:`, paragraph);
        result.push(paragraph);
      });

      // CRITICAL FIX: Process sibling elements that are not divs (like standalone links)
      const siblingElements = allChildren.filter(child =>
        !processedElements.has(child) &&
        child.tagName !== 'DIV' &&
        !child.classList?.contains('unified-paragraph-number')
      );

      if (siblingElements.length > 0) {
        console.log("🔵 convertHTMLToSlate: Processing sibling elements:", siblingElements.length);

        // Find the last paragraph to append sibling content to
        const lastParagraph = result[result.length - 1];
        if (lastParagraph) {
          siblingElements.forEach((element, index) => {
            console.log(`🔵 convertHTMLToSlate: Processing sibling ${index}:`, element.outerHTML);

            if (element.hasAttribute('data-link-type')) {
              const linkType = element.getAttribute('data-link-type');
              const text = element.textContent || "";
              console.log(`🔵 convertHTMLToSlate: Processing sibling link - type: ${linkType}, text: ${text}`);

              if (linkType === 'page') {
                const pageId = element.getAttribute('data-id');
                const pageTitle = element.getAttribute('data-page-title') || text;
                console.log(`🔵 convertHTMLToSlate: Sibling page link - pageId: ${pageId}, pageTitle: ${pageTitle}`);

                const linkNode = {
                  type: "link",
                  url: `/${pageId}`,
                  pageId,
                  pageTitle,
                  originalPageTitle: pageTitle,
                  className: "page-link",
                  isPageLink: true,
                  children: [{ text: pageTitle }]
                };

                console.log("🔵 convertHTMLToSlate: Adding sibling page link node:", linkNode);
                lastParagraph.children.unshift(linkNode); // Add at beginning of paragraph
              }
            }
          });
        }
      }

    console.log("🔵 convertHTMLToSlate: Final result:", result);
    return result.length > 0 ? result : [{ type: "paragraph", children: [{ text: "" }] }];
    } catch (error) {
      console.error("🔴 Editor: Error in HTML to Slate conversion:", error);
      console.error("🔴 Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        html: html.substring(0, 500)
      });
      return [{ type: "paragraph", children: [{ text: "" }] }];
    }
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

      // CRITICAL FIX: Use proper empty paragraph structure for contentEditable
      // Empty divs with just <br> don't accept input properly, especially as the last element
      let htmlContent = "<div>&nbsp;</div>";

      if (typeof initialContent === 'string' && initialContent.trim()) {
        const lines = initialContent.split('\n');
        htmlContent = lines.map(line => `<div>${line || '&nbsp;'}</div>`).join('');
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

          // Paragraph numbers handled by overlay component
        }
      });

    } catch (error) {
      console.error("Editor: Error during content initialization:", error);
      // More robust error recovery
      requestAnimationFrame(() => {
        if (editorRef.current && editorRef.current.isConnected) {
          editorRef.current.innerHTML = "<div>&nbsp;</div>";
          lastContentRef.current = "<div>&nbsp;</div>";
        }
      });
    }
  }, [isClient, convertSlateToHTML, initialContent]);

  // Debug DOM attributes after render - REMOVED for production

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

  // SIMPLIFIED: No complex boundary detection needed without injected paragraph numbers
  const getContentAreaBoundary = useCallback((paragraph: Element) => {
    return null; // No paragraph numbers injected, so no boundary needed
  }, [isClient]);

  // SIMPLIFIED: Remove complex cursor positioning functions





  // CRITICAL FIX: Save cursor position using content-based approach instead of DOM selection
  const [savedCursorPosition, setSavedCursorPosition] = useState<{
    paragraphIndex: number;
    textOffset: number;
  } | null>(null);

  const saveSelection = useCallback(() => {
    if (!isClient || typeof window === 'undefined' || !editorRef.current) return;

    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        // Find which paragraph and text offset the cursor is at
        const editorElement = editorRef.current;
        const paragraphs = Array.from(editorElement.children).filter(child =>
          child.tagName === 'DIV' && !child.classList.contains('unified-paragraph-number')
        );

        let paragraphIndex = 0;
        let textOffset = 0;
        let found = false;

        for (let i = 0; i < paragraphs.length; i++) {
          const paragraph = paragraphs[i];
          if (paragraph.contains(range.startContainer) || paragraph === range.startContainer) {
            paragraphIndex = i;

            // Calculate text offset within this paragraph
            const walker = document.createTreeWalker(
              paragraph,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );

            let currentOffset = 0;
            let node;
            while (node = walker.nextNode()) {
              if (node === range.startContainer) {
                textOffset = currentOffset + range.startOffset;
                found = true;
                break;
              }
              currentOffset += node.textContent?.length || 0;
            }

            if (found) break;
          }
        }

        if (found) {
          setSavedCursorPosition({ paragraphIndex, textOffset });
          console.log("[DEBUG] Cursor position saved:", { paragraphIndex, textOffset });
        } else {
          console.log("[DEBUG] Could not determine cursor position");
          setSavedCursorPosition(null);
        }
      } else {
        console.log("[DEBUG] No selection to save");
        setSavedCursorPosition(null);
      }
    } catch (error) {
      console.error('Error in saveSelection:', error);
      setSavedCursorPosition(null);
    }
  }, [isClient]);

  const restoreSelection = useCallback(() => {
    if (!isClient || typeof window === 'undefined' || !editorRef.current || !savedCursorPosition) {
      console.log("[DEBUG] Cannot restore selection:", {
        isClient,
        hasWindow: typeof window !== 'undefined',
        hasEditor: !!editorRef.current,
        hasSavedPosition: !!savedCursorPosition
      });
      return;
    }

    try {
      console.log("[DEBUG] Restoring cursor position:", savedCursorPosition);

      const editorElement = editorRef.current;
      const paragraphs = Array.from(editorElement.children).filter(child =>
        child.tagName === 'DIV' && !child.classList.contains('unified-paragraph-number')
      );

      const targetParagraph = paragraphs[savedCursorPosition.paragraphIndex];
      if (!targetParagraph) {
        console.log("[DEBUG] Target paragraph not found");
        return;
      }

      // Find the text node and offset within the paragraph
      const walker = document.createTreeWalker(
        targetParagraph,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let currentOffset = 0;
      let targetNode = null;
      let targetOffset = 0;
      let node;

      while (node = walker.nextNode()) {
        const nodeLength = node.textContent?.length || 0;
        if (currentOffset + nodeLength >= savedCursorPosition.textOffset) {
          targetNode = node;
          targetOffset = savedCursorPosition.textOffset - currentOffset;
          break;
        }
        currentOffset += nodeLength;
      }

      if (targetNode) {
        const range = document.createRange();
        range.setStart(targetNode, Math.min(targetOffset, targetNode.textContent?.length || 0));
        range.collapse(true);

        const windowSelection = window.getSelection();
        windowSelection?.removeAllRanges();
        windowSelection?.addRange(range);

        console.log("[DEBUG] Cursor position restored successfully");
      } else {
        console.log("[DEBUG] Could not find target text node");
      }
    } catch (error) {
      console.error('Error in restoreSelection:', error);
    }
  }, [isClient, savedCursorPosition]);

  // SIMPLIFIED: No paragraph number injection - use overlay instead
  const addParagraphNumbers = useCallback(() => {
    // Paragraph numbers are now handled by ParagraphNumberOverlay component
    // This prevents contentEditable conflicts and typing issues
    return;
  }, [lineMode]);

  // Optimized content change handling with better error handling
  const handleContentChange = useCallback(() => {
    if (!isClient || !editorRef.current) return;

    try {
      // CRITICAL FIX: Ensure editor always has at least one paragraph with proper structure
      if (editorRef.current.children.length === 0 ||
          (editorRef.current.children.length === 1 && editorRef.current.textContent?.trim() === '')) {
        editorRef.current.innerHTML = '<div>&nbsp;</div>';
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

      // FIXED: Reduced debounce delay for better responsiveness
      changeTimeoutRef.current = setTimeout(() => {
        try {
          const slateContent = convertHTMLToSlate(htmlContent);

          // Enhanced logging for external link debugging
          if (process.env.NODE_ENV === 'development') {
            const hasExternalLinks = htmlContent.includes('data-link-type="external"');
            const externalLinksInSlate = slateContent.some(p =>
              p.children && p.children.some(c => c.isExternal === true)
            );

            console.log("🔵 Editor.handleContentChange: Converting to Slate:", {
              htmlLength: htmlContent.length,
              slateLength: slateContent.length,
              hasContent: slateContent.some(p => p.children && p.children.some(c => c.text && c.text.trim())),
              hasExternalLinks,
              externalLinksInSlate
            });

            if (hasExternalLinks) {
              console.log("🔍 HTML with external links:", htmlContent);
              console.log("🔍 Slate content with external links:", JSON.stringify(slateContent, null, 2));
            }
          }

          onChange?.(slateContent);

          // Count empty lines by checking actual DOM divs
          if (onEmptyLinesChange && editorRef.current) {
            const divs = editorRef.current.querySelectorAll('div:not(.unified-paragraph-number)');
            let emptyLineCount = 0;

            divs.forEach((div) => {
              const textContent = div.textContent || '';
              const hasOnlyBr = div.innerHTML === '<br>' || div.innerHTML === '<br/>';
              const hasOnlyNbsp = div.innerHTML === '&nbsp;' || textContent === '\u00A0';
              const isEmpty = textContent.trim() === '' || hasOnlyBr || hasOnlyNbsp;

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
      }, 50); // FIXED: Reduced from 150ms to 50ms for better responsiveness
    } catch (error) {
      console.error("Editor: Error in handleContentChange:", error);
      // Ensure editor has valid content even on error
      if (editorRef.current) {
        editorRef.current.innerHTML = '<div>&nbsp;</div>';
      }
    }
  }, [isClient, onChange, onEmptyLinesChange, convertHTMLToSlate, addParagraphNumbers]);

  // CRITICAL FIX: Input handling without interfering with normal editing
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (!isClient) return;

    // Trigger content change for responsiveness
    handleContentChange();

    // REMOVED: Aggressive cursor positioning that was causing cursor jumping
    // Let the browser handle cursor positioning naturally during typing
  }, [isClient, handleContentChange]);



  // CRITICAL FIX: Selection handling with paragraph number avoidance
  const handleSelectionChange = useCallback(() => {
    // Don't automatically save selection on every change - only when explicitly requested
    // This prevents interference with normal typing and cursor movement
    if (!isClient || typeof window === 'undefined') return;

    try {
      // SIMPLIFIED: No automatic selection saving to prevent cursor jumping
      // Selection will be saved explicitly when needed (e.g., before opening link editor)

      // Just validate that we're not in a problematic state
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        // Selection exists and is valid - no action needed
      }
    } catch (error) {
      console.error('Error in handleSelectionChange:', error);
    }
  }, [isClient]);

  // SIMPLIFIED: No mutation observer needed without paragraph number injection

  // SIMPLIFIED: No complex event listeners needed without paragraph number injection

  // SIMPLIFIED: No need for click area detection without injected paragraph numbers

  // Enhanced click handling for proper cursor positioning
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
      return;
    }

    // SIMPLIFIED: Let browser handle click positioning naturally
    // No custom cursor positioning logic - the browser handles this correctly by default
  }, [isClient, user, currentPage, isEditMode]);

  // Click handler for read-only mode - switches to edit mode
  const handleViewModeClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const linkElement = target.closest('[data-link-type], .compound-link') as HTMLElement;

    // If clicking on a link, let it handle its own navigation
    if (linkElement) {
      return;
    }

    // If user can edit and onSetIsEditing is provided, switch to edit mode
    if (canEdit && onSetIsEditing) {
      const clickPosition = {
        x: e.clientX,
        y: e.clientY
      };
      onSetIsEditing(true, clickPosition);
    }
  }, [canEdit, onSetIsEditing]);

  // SIMPLIFIED: Minimal blur handling
  const handleBlur = useCallback(() => {
    if (!isClient || !editorRef.current) return;

    // Just notify parent of current content on blur
    const htmlContent = editorRef.current.innerHTML;
    const slateContent = convertHTMLToSlate(htmlContent);
    onChange?.(slateContent);
  }, [isClient, onChange, convertHTMLToSlate]);

  // Simplified delete key handling - no complex manipulation
  const handleDeleteKey = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Let the browser handle delete operations naturally
    // This prevents conflicts with React's DOM management
  }, []);

  // Handle paste events with formatting removal
  const handlePasteEvent = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    if (readOnly) return;

    const result = handlePaste(e.nativeEvent);

    if (result.preventDefault && result.content) {
      e.preventDefault();

      // Insert the processed content
      insertProcessedContent(result.content);

      // Trigger content change to update the editor state
      setTimeout(() => {
        handleContentChange();
      }, 0);
    }
    // If preventDefault is false, let the browser handle the paste normally
  }, [readOnly, handleContentChange]);

  // SIMPLIFIED: Let browser handle keyboard navigation naturally
  const handleKeyboardNavigation = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Let the browser handle all keyboard navigation naturally
    // No custom cursor positioning logic
  }, []);

  // Handle Cmd+Delete for delete-to-end-of-line (paragraph numbers as visible newlines)
  const handleCmdDelete = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!((e.metaKey || e.ctrlKey) && e.key === 'Delete')) return false;

    e.preventDefault();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return true;

    const range = selection.getRangeAt(0);

    // Find current paragraph
    let currentParagraph = range.startContainer;
    while (currentParagraph && currentParagraph !== editorRef.current) {
      if (currentParagraph.nodeType === Node.ELEMENT_NODE &&
          (currentParagraph as Element).tagName === 'DIV' &&
          (currentParagraph as Element).parentElement === editorRef.current) {
        break;
      }
      currentParagraph = currentParagraph.parentNode;
    }

    if (!currentParagraph || currentParagraph === editorRef.current) return true;

    const paragraph = currentParagraph as Element;

    // Create a range from cursor position to end of paragraph content
    const deleteRange = document.createRange();
    deleteRange.setStart(range.startContainer, range.startOffset);

    // Find the last content node in the paragraph (excluding paragraph numbers)
    const walker = document.createTreeWalker(
      paragraph,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          // Skip paragraph numbers
          if (node.parentElement &&
              (node.parentElement.classList.contains('unified-paragraph-number') ||
               node.parentElement.classList.contains('dense-paragraph-number'))) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let lastContentNode = null;
    let currentNode = walker.nextNode();
    while (currentNode) {
      lastContentNode = currentNode;
      currentNode = walker.nextNode();
    }

    if (lastContentNode) {
      // Set end of range to end of last content node
      if (lastContentNode.nodeType === Node.TEXT_NODE) {
        deleteRange.setEnd(lastContentNode, lastContentNode.textContent?.length || 0);
      } else {
        deleteRange.setEndAfter(lastContentNode);
      }
    } else {
      // No content found, set end to end of paragraph
      deleteRange.setEndAfter(paragraph.lastChild || paragraph);
    }

    // Check if we're at the end of the line already
    if (deleteRange.collapsed) {
      // At end of line - delete the "newline" (merge with next paragraph)
      const nextParagraph = paragraph.nextElementSibling;
      if (nextParagraph && nextParagraph.tagName === 'DIV') {
        // Get content from next paragraph (excluding paragraph number)
        const nextWalker = document.createTreeWalker(
          nextParagraph,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
          {
            acceptNode: (node) => {
              // Skip paragraph numbers
              if (node.parentElement &&
                  (node.parentElement.classList.contains('unified-paragraph-number') ||
                   node.parentElement.classList.contains('dense-paragraph-number'))) {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );

        // Collect all content nodes from next paragraph
        const contentNodes: Node[] = [];
        let node = nextWalker.nextNode();
        while (node) {
          contentNodes.push(node.cloneNode(true));
          node = nextWalker.nextNode();
        }

        // Append content from next paragraph to current paragraph
        contentNodes.forEach(contentNode => {
          paragraph.appendChild(contentNode);
        });

        // Remove next paragraph
        nextParagraph.remove();

        // Keep cursor at current position
        const newRange = document.createRange();
        newRange.setStart(range.startContainer, range.startOffset);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        // Trigger content change
        handleContentChange();
      }
    } else {
      // Delete from cursor to end of line
      deleteRange.deleteContents();

      // Position cursor at deletion point
      const newRange = document.createRange();
      newRange.setStart(range.startContainer, range.startOffset);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      // Trigger content change
      handleContentChange();
    }

    return true;
  }, [handleContentChange]);

  // Enhanced key handling with link navigation support
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isClient) return;

    // Allow Cmd+Enter to bubble up for save functionality
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      onKeyDown?.(e);
      return;
    }

    onKeyDown?.(e);

    // Handle Ctrl+K for link insertion
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      console.log("🔵 [DEBUG] Cmd+K pressed - opening link editor via keyboard shortcut");
      console.log("🔵 [DEBUG] readOnly:", readOnly);
      console.log("🔵 [DEBUG] showLinkEditor current state:", showLinkEditor);
      e.preventDefault();
      saveSelection();
      console.log("🔵 [DEBUG] Selection saved via keyboard shortcut");
      setLinkSearchText("");
      setLinkDisplayText("");
      setShowLinkEditor(true);
      console.log("🔵 [DEBUG] Link editor state set to true via keyboard shortcut");
      console.log("🔵 [DEBUG] showLinkEditor should now be:", true);
      return;
    }

    // Handle arrow key navigation for links - treat links as single atomic objects
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const currentNode = range.startContainer;

      // Check if we're near a link element
      let linkElement = null;
      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        linkElement = (currentNode as Element).closest('[data-link-type], .compound-link');
      } else if (currentNode.parentElement) {
        linkElement = currentNode.parentElement.closest('[data-link-type], .compound-link');
      }

      if (linkElement && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();

        // Navigate around the link as a single unit for horizontal movement
        const newRange = document.createRange();

        if (e.key === 'ArrowLeft') {
          // Move cursor to before the link
          newRange.setStartBefore(linkElement);
        } else {
          // Move cursor to after the link
          newRange.setStartAfter(linkElement);
        }

        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        return;
      }

      // For up/down arrows, if we're inside a link, move to the edge first
      if (linkElement && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();

        // Move to the appropriate edge of the link, then let browser handle line navigation
        const newRange = document.createRange();
        if (e.key === 'ArrowUp') {
          newRange.setStartBefore(linkElement);
        } else {
          newRange.setStartAfter(linkElement);
        }
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        // Trigger another arrow key event to continue navigation
        setTimeout(() => {
          const event = new KeyboardEvent('keydown', {
            key: e.key,
            bubbles: true,
            cancelable: true
          });
          editorRef.current?.dispatchEvent(event);
        }, 0);
        return;
      }
    }

    // Only prevent deletion if it would completely empty the editor
    if ((e.key === 'Backspace' || e.key === 'Delete') && editorRef.current) {
      const divs = editorRef.current.querySelectorAll('div');
      if (divs.length === 1) {
        const lastDiv = divs[0];
        const textContent = lastDiv.textContent || '';
        const actualContent = textContent.trim();

        if (actualContent === '') {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const isAtStart = range.startOffset === 0 && range.collapsed;
            if (isAtStart && e.key === 'Backspace') {
              e.preventDefault();
              return;
            }
          }
        }
      }
    }

    // Let browser handle all other keys naturally (including Enter)
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

  // Handle external link deletion
  const handleExternalLinkDelete = useCallback(() => {
    if (!editingLink) return;

    // Remove the link element from the DOM
    editingLink.element.remove();

    // Reset state and close modal
    setEditingLink(null);
    setShowLinkEditor(false);
    resetLinkEditorState();
    handleContentChange();
  }, [editingLink, resetLinkEditorState, handleContentChange]);

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

      // Trigger an input event to ensure content change detection
      if (editorRef.current) {
        const event = new Event('input', { bubbles: true });
        editorRef.current.dispatchEvent(event);
      }
    } else {
      // Create new link
      if (savedCursorPosition) {
        try {
          // CRITICAL FIX: Use content-based cursor positioning for external links
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
        // No saved cursor position - focus editor and insert at current position
        editorRef.current.focus();
        document.execCommand('insertHTML', false, linkHTML + '&nbsp;');
      }
    }

    // Reset state and close modal
    setShowLinkEditor(false);
    resetLinkEditorState();

    // Ensure content change is triggered after a brief delay to allow DOM updates
    setTimeout(() => {
      handleContentChange();
    }, 10);
  }, [externalUrl, externalDisplayText, showExternalCustomText, pillStyleClasses, savedCursorPosition, restoreSelection, handleContentChange]);

  // Optimized link selection handling
  const handleLinkSelect = useCallback((item: any) => {
    if (!editorRef.current) return;

    // Handle new page creation
    if (item.isNew) {
      // Create a placeholder link that will be converted to a real page link later
      const displayText = showCustomTextToggle && linkDisplayText.trim()
        ? linkDisplayText.trim()
        : item.title;

      // Use a special data attribute to mark this as a pending page creation
      const linkHTML = `<span class="${pillStyleClasses} page-link pending-page" data-link-type="page" data-pending-title="${item.title}" contenteditable="false" style="user-select: none; cursor: pointer; opacity: 0.7;">${displayText}</span>`;

      // Insert the placeholder link
      if (editingLink) {
        editingLink.element.outerHTML = linkHTML;
        setEditingLink(null);
      } else {
        if (savedCursorPosition) {
          try {
            restoreSelection();
            const currentSelection = window.getSelection();
            if (currentSelection && currentSelection.rangeCount > 0) {
              const range = currentSelection.getRangeAt(0);
              range.deleteContents();

              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = linkHTML;
              const linkElement = tempDiv.firstChild;

              if (linkElement) {
                range.insertNode(linkElement);
                const spaceNode = document.createTextNode('\u00A0');
                range.setStartAfter(linkElement);
                range.insertNode(spaceNode);
                range.setStartAfter(spaceNode);
                range.collapse(true);

                currentSelection.removeAllRanges();
                currentSelection.addRange(range);
              }
            } else {
              document.execCommand('insertHTML', false, linkHTML + '&nbsp;');
            }
          } catch (error) {
            console.error('Error inserting placeholder link:', error);
            document.execCommand('insertHTML', false, linkHTML + '&nbsp;');
          }
        } else {
          editorRef.current.focus();
          document.execCommand('insertHTML', false, linkHTML + '&nbsp;');
        }
      }

      // Update content and close modal
      handleContentChange();
      setTimeout(() => {
        editorRef.current?.focus();
      }, 100);
      setShowLinkEditor(false);
      resetLinkEditorState();
      return true;
    }

    // Only use custom text when the toggle is explicitly enabled
    // Otherwise, always use the page title to ensure auto-generated titles
    const displayText = showCustomTextToggle && linkDisplayText.trim()
      ? linkDisplayText.trim()
      : (item.title || item.username);
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
      if (savedCursorPosition) {
        try {
          // CRITICAL FIX: Use content-based cursor positioning instead of DOM selection
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
        // No saved cursor position - focus editor and insert at current position
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
  }, [linkDisplayText, showCustomTextToggle, pillStyleClasses, savedCursorPosition, restoreSelection, handleContentChange, editingLink, showAuthorToggle]);

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

  // Function to process pending page links and create actual pages
  const processPendingPageLinks = useCallback(async () => {
    if (!editorRef.current) return;

    const pendingLinks = editorRef.current.querySelectorAll('.pending-page');
    if (pendingLinks.length === 0) return;

    console.log(`Processing ${pendingLinks.length} pending page links`);

    for (const linkElement of pendingLinks) {
      const pendingTitle = linkElement.getAttribute('data-pending-title');
      if (!pendingTitle) continue;

      try {
        // CRITICAL FIX: Use Firebase createPage function directly instead of non-existent API endpoint
        const { createPage } = await import('../../firebase/database');

        // Get current user info for page creation
        if (!user || !user.uid) {
          console.error(`Cannot create page for pending link: No authenticated user`);
          continue;
        }

        const pageData = {
          title: pendingTitle,
          content: JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }]),
          isPublic: false, // Default to private
          location: null,
          groupId: null,
          userId: user.uid,
          username: user.username || user.displayName || 'Anonymous',
          lastModified: new Date().toISOString(),
          isReply: false
        };

        const newPageId = await createPage(pageData);

        if (newPageId) {
          console.log(`Created new page: ${newPageId} with title: ${pendingTitle}`);

          // Update the link element to point to the real page
          linkElement.setAttribute('data-id', newPageId);
          linkElement.setAttribute('data-page-title', pendingTitle);
          linkElement.removeAttribute('data-pending-title');
          linkElement.classList.remove('pending-page');
          linkElement.style.opacity = '1'; // Remove the dimmed appearance
        } else {
          console.error(`Failed to create page for title: ${pendingTitle} - createPage returned null`);
          // Keep the pending link as is - user can try again later
          // Optionally, we could remove the pending link entirely or show an error state
        }
      } catch (error) {
        console.error(`Error creating page for title: ${pendingTitle}`, error);
        // Keep the pending link as is - user can try again later
      }
    }

    // Trigger content change to save the updated links
    handleContentChange();
  }, [handleContentChange]);

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
      if (!readOnly) {
        editorRef.current?.focus();
      }
      return true;
    },
    getContent: () => {
      console.log("🔵 Editor.getContent: Starting getContent method");

      if (!editorRef.current) {
        console.warn("🟡 Editor.getContent: editorRef.current is null");
        return [{ type: "paragraph", children: [{ text: "" }] }];
      }

      console.log("🔵 Editor.getContent: editorRef.current exists, checking children");
      console.log("🔵 Editor.getContent: children.length:", editorRef.current.children.length);

      // CRITICAL FIX: Ensure editor has content before capturing
      if (editorRef.current.children.length === 0) {
        console.warn("🟡 Editor.getContent: Editor is empty, adding default paragraph");
        editorRef.current.innerHTML = '<div><br></div>';
      }

      console.log("🔵 Editor.getContent: About to get innerHTML");
      let htmlContent;
      try {
        htmlContent = editorRef.current.innerHTML;
        console.log("🔵 Editor.getContent: Successfully got innerHTML");
      } catch (error) {
        console.error("🔴 Editor.getContent: Error getting innerHTML:", error);
        return [{ type: "paragraph", children: [{ text: "" }] }];
      }
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
      if (readOnly) return false;
      if (editorRef.current && typeof document !== 'undefined') {
        const selection = window.getSelection();

        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);

          // FIXED: Use modern DOM methods instead of deprecated execCommand
          try {
            // Delete any selected content first
            range.deleteContents();

            // Create text node and insert it
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);

            // Move cursor to end of inserted text
            range.setStartAfter(textNode);
            range.collapse(true);

            // Update selection
            selection.removeAllRanges();
            selection.addRange(range);

            // Trigger content change
            handleContentChange();
          } catch (error) {
            console.error('Error inserting text:', error);
            // Fallback to execCommand if available
            if (document.execCommand) {
              document.execCommand('insertText', false, text);
              handleContentChange();
            }
          }
        } else {
          // No selection - focus editor and try to insert at current position
          editorRef.current.focus();
          if (document.execCommand) {
            document.execCommand('insertText', false, text);
            handleContentChange();
          }
        }
      }
      return true;
    },
    insertLink: readOnly ? () => false : insertLink,
    saveSelection: readOnly ? () => false : saveSelection,
    openLinkEditor: () => {
      console.log("🔵 [DEBUG] openLinkEditor method called");
      console.log("🔵 [DEBUG] readOnly:", readOnly);

      if (readOnly) {
        console.log("🟡 [DEBUG] Editor is readOnly, returning false");
        return false;
      }

      console.log("🔵 [DEBUG] Saving selection");
      saveSelection();

      console.log("🔵 [DEBUG] Resetting link editor state");
      // Reset all link editor state
      setLinkSearchText("");
      setLinkDisplayText("");
      setShowCustomTextToggle(false);
      setShowAuthorToggle(false);
      setExternalUrl("");
      setExternalDisplayText("");
      setShowExternalCustomText(false);

      console.log("🔵 [DEBUG] Setting showLinkEditor to true");
      // Keep the last selected tab for better UX
      setShowLinkEditor(true);

      // Capture initial state for new link creation
      setTimeout(() => {
        console.log("🔵 [DEBUG] Capturing initial link editor state");
        captureInitialLinkEditorState();
      }, 100);

      console.log("✅ [DEBUG] openLinkEditor completed successfully");
      return true;
    },
    setShowLinkEditor: (value: boolean) => {
      if (readOnly) return false;
      setShowLinkEditor(value);
      return true;
    },
    deleteAllEmptyLines: readOnly ? () => false : deleteAllEmptyLines,
    processPendingPageLinks: readOnly ? () => false : processPendingPageLinks
  }), [readOnly, handleContentChange, insertLink, saveSelection, convertHTMLToSlate, deleteAllEmptyLines, processPendingPageLinks]);

  // Memoized class names to prevent re-computation
  const editorClassName = useMemo(() =>
    `prose prose-lg max-w-none focus:outline-none editor-content page-editor-stable box-border mode-transition normal-mode`,
    []
  );

  // Render with error boundary protection
  try {
    return (
      <>
      <div className="editor w-full">
        {/* WYSIWYG Editor with consistent dimensions to prevent layout shifts */}
        <div
          className="page-content unified-editor relative rounded-lg bg-background w-full max-w-none"
          data-readonly={readOnly ? "true" : "false"}
        >
          {typeof window !== 'undefined' && isClient && isMounted ? (
            <>
              <div
                ref={editorRef}
                contentEditable={!readOnly}
                tabIndex={readOnly ? -1 : (isNewPage ? 2 : 0)} // Disable tab focus in readOnly mode
                onInput={readOnly ? undefined : undefined}
                onKeyDown={readOnly ? undefined : handleKeyDown}
                onBlur={readOnly ? undefined : handleBlur}
                onFocus={readOnly ? undefined : undefined}
                onMouseUp={readOnly ? undefined : undefined}
                onKeyUp={readOnly ? undefined : undefined}
                onSelect={readOnly ? undefined : undefined}
                onPaste={readOnly ? undefined : handlePasteEvent}
                onClick={readOnly ? (canEdit ? handleViewModeClick : undefined) : (e) => {
                  // SIMPLIFIED: Only handle link clicks, let browser handle cursor positioning naturally
                  const target = e.target as HTMLElement;
                  const linkElement = target.closest('[data-link-type]') as HTMLElement;
                  const compoundElement = target.closest('.compound-link') as HTMLElement;
                  const actualLinkElement = compoundElement || linkElement;

                  if (actualLinkElement) {
                    e.preventDefault();
                    e.stopPropagation();
                    const linkData = extractLinkDataFromElement(actualLinkElement);
                    openLinkEditorForEdit(linkData);
                  }
                  // For all other clicks, let the browser handle cursor positioning naturally
                }}
                className={`${editorClassName} ${readOnly ? 'cursor-text' : ''}`}
                data-placeholder={readOnly ? undefined : placeholder}
                data-readonly={readOnly ? "true" : "false"}
                data-can-edit={canEdit ? "true" : "false"}
                data-is-initialized={isInitialized ? "true" : "false"}
                data-debug-info={JSON.stringify({ readOnly, canEdit, isInitialized, isClient, isMounted })}
                suppressContentEditableWarning={true}
                style={{
                  opacity: isInitialized ? 1 : 0,
                  transition: 'opacity 0.15s ease-in-out',
                  // FIXED: Ensure proper line height and cursor visibility
                  minHeight: '1.5em',
                  lineHeight: '1.5',
                  // CRITICAL: Add left padding for paragraph numbers in edit mode
                  ...((!readOnly) && {
                    '--edit-mode-left-margin': '2.25rem',
                    '--edit-mode-content-width': 'calc(100% - 2.25rem)'
                  })
                }}
              />

              {/* SIMPLIFIED: Always show paragraph numbers in edit mode */}
              {!readOnly && (
                <NonInterferingParagraphNumbers editorRef={editorRef} />
              )}
            </>
          ) : (
            // Skeleton loader with consistent styling
            <div
              className="prose prose-lg max-w-none page-editor-stable box-border animate-pulse"
            >
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-5/6"></div>
              </div>
            </div>
          )}
        </div>


      </div>

      {/* Link Editor Modal - Using consistent Modal component - Only show in edit mode */}
      {isMounted && !readOnly && (
        <Modal
          isOpen={showLinkEditor}
          onClose={handleLinkEditorClose}
          title={editingLink ? "Edit Link" : "Insert Link"}
          className="md:max-w-2xl md:h-[calc(100vh-40px)] md:my-5 h-full flex flex-col"
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

                {/* Action buttons */}
                <div className="mt-auto pt-6 md:pt-4 space-y-3">
                  {editingLink && (
                    <button
                      onClick={handleExternalLinkDelete}
                      className="w-full px-4 py-4 md:py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors text-base md:text-sm font-medium"
                    >
                      Delete Link
                    </button>
                  )}
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

      {/* External Link Preview Modal - Only show in edit mode */}
      {isMounted && !readOnly && (
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
      </>
    );
} catch (error) {
    console.error("Editor: Critical render error:", error);
    // Fallback UI for critical errors
    return (
      <div className="editor w-full">
        <div className="page-content unified-editor relative rounded-lg bg-background w-full max-w-none">
          <div
            className="prose prose-lg max-w-none page-editor-stable box-border"
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
