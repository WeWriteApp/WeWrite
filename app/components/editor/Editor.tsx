"use client";

import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useCallback } from "react";
import { usePillStyle } from '../../contexts/PillStyleContext';
import { useLineSettings, LINE_MODES } from '../../contexts/LineSettingsContext';
import { Lock, ExternalLink, X } from "lucide-react";
import FilteredSearchResults from '../search/FilteredSearchResults';

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

  // Convert Slate content to simple text format on mount
  const [content, setContent] = useState(() => {
    // Only initialize content on client side to prevent hydration mismatch
    if (typeof window === 'undefined') {
      return '';
    }

    if (typeof initialContent === 'string') {
      return initialContent;
    }
    // Convert Slate format to simple text format for state tracking
    return convertSlateToSimpleText(initialContent || []);
  });

  // Helper function to convert Slate to simple text (for backward compatibility)
  function convertSlateToSimpleText(slateContent: any): string {
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
  }

  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkSearchText, setLinkSearchText] = useState("");
  const [linkDisplayText, setLinkDisplayText] = useState("");
  const [selection, setSelection] = useState<Range | null>(null);
  const [isClient, setIsClient] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const changeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { getPillStyleClasses } = usePillStyle();
  const { lineMode } = useLineSettings();

  // Convert Slate content to HTML for WYSIWYG display
  function convertSlateToHTML(slateContent: any): string {
    if (!slateContent || !Array.isArray(slateContent)) {
      return "<div><br></div>";
    }

    let result = "";
    const showParagraphNumbers = lineMode !== LINE_MODES.DENSE;

    for (let paragraphIndex = 0; paragraphIndex < slateContent.length; paragraphIndex++) {
      const node = slateContent[paragraphIndex];
      if (node.type === "paragraph" && node.children) {
        // CRITICAL FIX: Paragraph numbers should NOT be inside contentEditable
        // Create simple div structure without paragraph numbers for contentEditable
        // Paragraph numbers will be handled by CSS pseudo-elements or external rendering
        result += "<div>";
        let hasContent = false;

        for (const child of node.children) {
          if (child.text !== undefined) {
            // Handle empty text nodes properly
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
            const baseStyles = getPillStyleClasses();

            if (child.pageId) {
              if (child.showAuthor && child.authorUsername) {
                result += `<span class="compound-link" data-page-id="${child.pageId}" data-author="${child.authorUsername}">`;
                result += `<span class="${baseStyles} page-link" data-link-type="page" data-id="${child.pageId}">${text}</span>`;
                result += ` <span class="text-muted-foreground text-sm">by</span> `;
                result += `<span class="${baseStyles} user-link" data-link-type="user" data-id="${child.authorUsername}">${child.authorUsername}</span>`;
                result += `</span>`;
              } else {
                result += `<span class="${baseStyles} page-link" data-link-type="page" data-id="${child.pageId}">${text}</span>`;
              }
            } else if (child.userId) {
              result += `<span class="${baseStyles} user-link" data-link-type="user" data-id="${child.userId}">${text}</span>`;
            } else if (child.url) {
              result += `<span class="${baseStyles} external-link" data-link-type="external" data-url="${child.url}">${text}</span>`;
            }
            hasContent = true;
          }
        }

        // If no content was added to this paragraph, add a <br>
        if (!hasContent) {
          result += "<br>";
        }

        // Close the paragraph structure
        result += "</div>";
      }
    }

    return result || "<div><br></div>";
  }

  // Convert HTML content back to Slate format for compatibility
  function convertHTMLToSlate(html: string): any[] {
    // Safety check for server-side rendering
    if (typeof document === 'undefined') {
      return [{ type: "paragraph", children: [{ text: "" }] }];
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const result = [];
    // Look for both regular divs and unified-paragraph divs
    const divs = tempDiv.querySelectorAll('div:not(.unified-text-content)');

    if (divs.length === 0) {
      // Handle case where there are no divs
      return [{ type: "paragraph", children: [{ text: tempDiv.textContent || "" }] }];
    }

    divs.forEach(div => {
      // Skip paragraph number spans when processing content
      if (div.classList.contains('unified-paragraph-number')) {
        return;
      }
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

          // Skip paragraph number elements
          if (element.classList.contains('unified-paragraph-number')) {
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
            // Handle compound links - process children
            element.childNodes.forEach(processNode);
          } else {
            // Process other elements recursively
            element.childNodes.forEach(processNode);
          }
        }
      };

      div.childNodes.forEach(processNode);

      // If no children were added, add empty text
      if (paragraph.children.length === 0) {
        paragraph.children.push({ text: "" });
      }

      result.push(paragraph);
    });

    return result.length > 0 ? result : [{ type: "paragraph", children: [{ text: "" }] }];
  }

  // Handle client-side hydration
  useEffect(() => {
    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      setIsClient(true);
    }, 50);

    return () => clearTimeout(timer);
  }, []);



  // Initialize editor content on mount (client-side only)
  useEffect(() => {
    if (!isClient || !editorRef.current) return;

    try {
      // Debug: Log content initialization
      if (Array.isArray(initialContent) && initialContent.length > 0) {
        console.log("Editor: Initializing with content:", initialContent.length, "items");
      }

      let htmlContent = "";

      if (typeof initialContent === 'string') {
        // Convert simple text to HTML
        const lines = initialContent.split('\n');
        htmlContent = lines.map(line => `<div>${line || '<br>'}</div>`).join('');
      } else if (initialContent && Array.isArray(initialContent)) {
        // Convert Slate content to HTML
        htmlContent = convertSlateToHTML(initialContent);

        // If conversion resulted in empty content, use fallback
        if (!htmlContent || htmlContent === "") {
          htmlContent = "<div><br></div>";
        }
      } else {
        // Empty content
        htmlContent = "<div><br></div>";
      }

      editorRef.current.innerHTML = htmlContent;

      // Debug empty content
      if (htmlContent === "<div><br></div>") {
        console.log("Editor: Setting empty content (this is normal for new pages)");
      } else {
        console.log("Editor: Setting content with", htmlContent.length, "characters");
      }


    } catch (error) {
      console.error("Editor: Error during initialization:", error);
      // Set fallback content on error
      if (editorRef.current) {
        editorRef.current.innerHTML = "<div><br></div>";
      }
    }
  }, [isClient, initialContent, lineMode]);

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

  // Save current selection
  const saveSelection = useCallback(() => {
    if (!isClient || typeof window === 'undefined') return;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      setSelection(selection.getRangeAt(0).cloneRange());
    }
  }, [isClient]);

  // Restore selection
  const restoreSelection = useCallback(() => {
    if (!isClient || typeof window === 'undefined' || !selection) return;

    const windowSelection = window.getSelection();
    windowSelection?.removeAllRanges();
    windowSelection?.addRange(selection);
  }, [isClient, selection]);



  // Handle content changes in the contenteditable div
  const handleContentChange = useCallback(() => {
    if (!isClient || !editorRef.current) return;

    // CRITICAL FIX: Completely disable all callbacks during typing
    // The issue is that ANY callback to the parent causes re-renders that reset cursor position
    // We'll only notify the parent on blur or after a long delay

    const htmlContent = editorRef.current.innerHTML;
    const slateContent = convertHTMLToSlate(htmlContent);

    // Mark this as an internal update to prevent external content updates
    isInternalUpdate.current = true;

    // Clear any existing timeout
    if (changeTimeoutRef.current) {
      clearTimeout(changeTimeoutRef.current);
    }

    // CRITICAL FIX: Only notify parent after user stops typing for 500ms
    changeTimeoutRef.current = setTimeout(() => {
      // Only call onChange after user has stopped typing
      onChange?.(slateContent);

      // Count empty lines and notify parent
      const textContent = slateContent.map(node =>
        node.children.map(child => child.text || '').join('')
      ).join('\n');
      const emptyLines = textContent.split('\n').filter(line => line.trim() === '').length;
      onEmptyLinesChange?.(emptyLines);

      // Reset the flag after parent updates complete
      setTimeout(() => {
        isInternalUpdate.current = false;
      }, 100);
    }, 500); // Much longer delay - only update after user stops typing
  }, [isClient, onChange, onEmptyLinesChange]);

  // Handle input events
  const handleInput = useCallback(() => {
    if (!isClient) return;
    handleContentChange();
  }, [isClient, handleContentChange]);

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

    const textContent = slateContent.map(node =>
      node.children.map(child => child.text || '').join('')
    ).join('\n');
    const emptyLines = textContent.split('\n').filter(line => line.trim() === '').length;
    onEmptyLinesChange?.(emptyLines);

    saveSelection();
  }, [isClient, onChange, onEmptyLinesChange, saveSelection]);

  // Handle key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isClient) return;

    onKeyDown?.(e);

    // Handle Ctrl+K for link insertion
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      saveSelection();
      setLinkSearchText("");
      setLinkDisplayText("");
      setShowLinkEditor(true);
    }

    // Handle Enter key to create new paragraphs
    if (e.key === 'Enter') {
      e.preventDefault();
      if (typeof document !== 'undefined' && document.execCommand) {
        // Create new paragraph with proper structure based on line mode
        if (lineMode === LINE_MODES.DENSE) {
          document.execCommand('insertHTML', false, '<div><br></div>');
        } else {
          // For normal mode, we'll let the content change handler add paragraph numbers
          document.execCommand('insertHTML', false, '<div><br></div>');
        }
      }
    }
  }, [isClient, onKeyDown, saveSelection]);

  // Handle link selection from search results
  const handleLinkSelect = useCallback((item: any) => {
    if (!editorRef.current) return;

    const displayText = linkDisplayText.trim() || item.title || item.username;
    const baseStyles = getPillStyleClasses();
    let linkHTML = "";

    if (item.type === 'page' || item.id) {
      linkHTML = `<span class="${baseStyles} page-link" data-link-type="page" data-id="${item.id}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
    } else if (item.type === 'user') {
      linkHTML = `<span class="${baseStyles} user-link" data-link-type="user" data-id="${item.id}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
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
  }, [linkDisplayText, getPillStyleClasses, selection, restoreSelection, handleContentChange]);

  // Insert link at cursor position (for external API compatibility)
  const insertLink = useCallback((linkData: any) => {
    if (!editorRef.current) return false;

    const displayText = linkData.pageTitle || linkData.username || linkData.text || "Link";
    const baseStyles = getPillStyleClasses();
    let linkHTML = "";

    if (linkData.pageId) {
      if (linkData.showAuthor && linkData.authorUsername) {
        linkHTML = `<span class="compound-link" data-page-id="${linkData.pageId}" data-author="${linkData.authorUsername}" contenteditable="false" style="user-select: none; cursor: pointer;">`;
        linkHTML += `<span class="${baseStyles} page-link" data-link-type="page" data-id="${linkData.pageId}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
        linkHTML += ` <span class="text-muted-foreground text-sm">by</span> `;
        linkHTML += `<span class="${baseStyles} user-link" data-link-type="user" data-id="${linkData.authorUsername}" contenteditable="false" style="user-select: none; cursor: pointer;">${linkData.authorUsername}</span>`;
        linkHTML += `</span>`;
      } else {
        linkHTML = `<span class="${baseStyles} page-link" data-link-type="page" data-id="${linkData.pageId}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
      }
    } else if (linkData.userId) {
      linkHTML = `<span class="${baseStyles} user-link" data-link-type="user" data-id="${linkData.userId}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
    } else if (linkData.url) {
      linkHTML = `<span class="${baseStyles} external-link" data-link-type="external" data-url="${linkData.url}" contenteditable="false" style="user-select: none; cursor: pointer;">${displayText}</span>`;
    }

    // Insert the link
    if (typeof document !== 'undefined' && document.execCommand) {
      document.execCommand('insertHTML', false, linkHTML + '&nbsp;');
    }
    handleContentChange();

    setShowLinkEditor(false);
    return true;
  }, [getPillStyleClasses, handleContentChange]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      editorRef.current?.focus();
      return true;
    },
    getContent: () => {
      if (!editorRef.current) return [{ type: "paragraph", children: [{ text: "" }] }];
      return convertHTMLToSlate(editorRef.current.innerHTML);
    },
    insertText: (text: string) => {
      if (editorRef.current && typeof document !== 'undefined' && document.execCommand) {
        // Save cursor position before inserting text
        const selection = window.getSelection();
        let savedRange = null;
        if (selection && selection.rangeCount > 0) {
          savedRange = selection.getRangeAt(0).cloneRange();
        }

        document.execCommand('insertText', false, text);
        handleContentChange();

        // Restore cursor position if needed
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
    }
  }), [handleContentChange, insertLink, saveSelection]);

  return (
    <div className="editor w-full">
      {/* WYSIWYG Editor - pixel-perfect match with view mode */}
      <div className="page-content unified-editor relative rounded-lg bg-background w-full max-w-none">
        {isClient ? (
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onMouseUp={saveSelection}
            onKeyUp={saveSelection}
            className={`prose prose-lg max-w-none focus:outline-none editor-content page-editor-stable box-border ${lineMode === LINE_MODES.DENSE ? 'dense-mode' : 'normal-mode'}`}
            data-placeholder={placeholder}
            suppressContentEditableWarning={true}
            style={{
              minHeight: '400px', // Match view mode min-height
              // Remove inline styles that conflict with CSS - let CSS handle all styling
            }}
          />
        ) : (
          <div className="prose prose-lg max-w-none page-editor-stable box-border" style={{ minHeight: '400px' }}>
            {/* Server-side placeholder */}
            <div><br /></div>
          </div>
        )}
      </div>

      {/* Link Editor Modal */}
      {showLinkEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
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
        </div>
      )}
    </div>
  );
});

Editor.displayName = "Editor";

export default Editor;
