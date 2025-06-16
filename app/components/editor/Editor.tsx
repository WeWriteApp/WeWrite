"use client";

import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useCallback, useMemo } from "react";
import { createPortal } from 'react-dom';
import { usePillStyle } from '../../contexts/PillStyleContext';
import { useLineSettings, LINE_MODES } from '../../contexts/LineSettingsContext';
import { Lock, ExternalLink, X } from "lucide-react";
import FilteredSearchResults from '../search/FilteredSearchResults';
import ParagraphNumberOverlay from './ParagraphNumberOverlay';

// Types
interface EditorProps {
  initialContent?: string | any[]; // Support both string and Slate content
  onChange?: (content: any[]) => void; // Always return Slate format
  placeholder?: string;
  contentType?: 'wiki' | 'about' | 'bio';
  onKeyDown?: (event: React.KeyboardEvent) => void;
  onEmptyLinesChange?: (count: number) => void;
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
    onEmptyLinesChange
  } = props;

  // Optimized state management - minimize re-renders
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkSearchText, setLinkSearchText] = useState("");
  const [linkDisplayText, setLinkDisplayText] = useState("");
  const [selection, setSelection] = useState<Range | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

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

  // Memoized Slate to HTML conversion for performance
  const convertSlateToHTML = useCallback((slateContent: any): string => {
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
                result += `<span class="compound-link" data-page-id="${child.pageId}" data-author="${child.authorUsername}">`;
                result += `<span class="${pillStyleClasses} page-link" data-link-type="page" data-id="${child.pageId}">${text}</span>`;
                result += ` <span class="text-muted-foreground text-sm">by</span> `;
                result += `<span class="${pillStyleClasses} user-link" data-link-type="user" data-id="${child.authorUsername}">${child.authorUsername}</span>`;
                result += `</span>`;
              } else {
                result += `<span class="${pillStyleClasses} page-link" data-link-type="page" data-id="${child.pageId}">${text}</span>`;
              }
            } else if (child.userId) {
              result += `<span class="${pillStyleClasses} user-link" data-link-type="user" data-id="${child.userId}">${text}</span>`;
            } else if (child.url) {
              result += `<span class="${pillStyleClasses} external-link" data-link-type="external" data-url="${child.url}">${text}</span>`;
            }
            hasContent = true;
          }
        }

        if (!hasContent) {
          result += "<br>";
        }

        result += "</div>";
      }
    }

    return result || "<div><br></div>";
  }, [pillStyleClasses]);

  // Memoized HTML to Slate conversion for performance
  const convertHTMLToSlate = useCallback((html: string): any[] => {
    if (typeof document === 'undefined') {
      return [{ type: "paragraph", children: [{ text: "" }] }];
    }

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
              paragraph.children.push({
                type: "link",
                url: `/pages/${pageId}`,
                pageId,
                pageTitle: text,
                className: "page-link",
                isPageLink: true,
                children: [{ text }]
              });
            } else if (linkType === 'user') {
              const userId = element.getAttribute('data-id');
              paragraph.children.push({
                type: "link",
                url: `/users/${text}`,
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
            element.childNodes.forEach(processNode);
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

  // Immediate initialization for browser environment
  React.useLayoutEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
      setIsInitialized(true);
      setIsMounted(true);
      hasInitialized.current = true;
    }
  }, []);

  // Content initialization effect - runs after DOM is ready
  useEffect(() => {
    if (!isClient || !editorRef.current) return;

    try {
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

      editorRef.current.innerHTML = htmlContent;
      lastContentRef.current = htmlContent;

    } catch (error) {
      console.error("Editor: Error during content initialization:", error);
      if (editorRef.current) {
        editorRef.current.innerHTML = "<div><br></div>";
      }
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



  // Optimized content change handling - prevent unnecessary updates
  const handleContentChange = useCallback(() => {
    if (!isClient || !editorRef.current) return;

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
    }, 150);
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

  // Optimized link selection handling
  const handleLinkSelect = useCallback((item: any) => {
    if (!editorRef.current) return;

    const displayText = linkDisplayText.trim() || item.title || item.username;
    let linkHTML = "";

    if (item.type === 'page' || item.id) {
      linkHTML = `<span class="${pillStyleClasses} page-link" data-link-type="page" data-id="${item.id}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
    } else if (item.type === 'user') {
      linkHTML = `<span class="${pillStyleClasses} user-link" data-link-type="user" data-id="${item.id}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
    }

    // Insert the link at the current selection
    if (selection) {
      restoreSelection();
      if (typeof document !== 'undefined' && document.execCommand) {
        document.execCommand('insertHTML', false, linkHTML + '&nbsp;');
      }
    } else {
      // Fallback: append to end
      editorRef.current.innerHTML += linkHTML + '&nbsp;';
    }

    // Update content
    handleContentChange();

    // Focus back to editor
    setTimeout(() => {
      editorRef.current?.focus();
    }, 100);

    setShowLinkEditor(false);
    return true;
  }, [linkDisplayText, pillStyleClasses, selection, restoreSelection, handleContentChange]);

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
      setLinkSearchText("");
      setLinkDisplayText("");
      setShowLinkEditor(true);
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

  return (
    <div className="editor w-full">
      {/* WYSIWYG Editor with consistent dimensions to prevent layout shifts */}
      <div className="page-content unified-editor relative rounded-lg bg-background w-full max-w-none">
        {typeof window !== 'undefined' ? (
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
            <ParagraphNumberOverlay editorRef={editorRef} />
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

      {/* Link Editor Modal - Rendered via portal at document body level */}
      {isMounted && showLinkEditor && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ margin: 0 }}>
          <div className="bg-background p-6 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Insert Link</h3>
              <button
                onClick={() => setShowLinkEditor(false)}
                className="p-1 hover:bg-muted rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Custom link text (optional)
              </label>
              <input
                type="text"
                value={linkDisplayText}
                onChange={(e) => setLinkDisplayText(e.target.value)}
                placeholder="Leave empty to use page title"
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="flex-1 overflow-hidden">
              <FilteredSearchResults
                onSelect={handleLinkSelect}
                placeholder="Search for pages to link..."
                setDisplayText={setLinkDisplayText}
                displayText={linkDisplayText}
                autoFocus={true}
                className="h-full"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

Editor.displayName = "Editor";

export default Editor;
