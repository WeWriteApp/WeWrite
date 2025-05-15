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
import { Link as LinkIcon, ExternalLink, Lock } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useLineSettings, LineSettingsProvider } from '../contexts/LineSettingsContext';
import { usePillStyle } from '../contexts/PillStyleContext';
import { formatPageTitle, formatUsername, isUserLink, isPageLink, isExternalLink } from "../utils/linkFormatters";
import TypeaheadSearch from "./TypeaheadSearch";

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

  // Insert a link at the current selection
  const insertLink = useCallback((url, text, options = {}) => {
    if (!url) return false;

    try {
      // Determine if this is a page link, user link, or external link
      const isUserLinkType = url.startsWith('/user/') || options.isUser;
      const isPageLinkType = !isUserLinkType && (url.startsWith('/') || options.pageId);
      const isExternalLinkType = !isUserLinkType && !isPageLinkType;

      // Create the link node with appropriate properties
      const link = {
        type: 'link',
        url,
        children: [{ text: text || url }],
        // Add additional properties based on link type
        ...(isUserLinkType && { isUser: true, userId: options.userId }),
        ...(isPageLinkType && { pageId: options.pageId, pageTitle: options.pageTitle }),
        ...(isExternalLinkType && { isExternal: true }),
        ...(options.isPublic === false && { isPublic: false })
      };

      if (editor.selection) {
        const [parentNode, parentPath] = Editor.parent(
          editor,
          editor.selection.focus.path
        );

        if (editor.selection.anchor.offset === editor.selection.focus.offset) {
          // No text is selected, insert the link
          Transforms.insertNodes(editor, link);
        } else {
          // Text is selected, wrap it in a link
          Transforms.wrapNodes(editor, link, { split: true });
          Transforms.collapse(editor, { edge: 'end' });
        }
      } else {
        // No selection, just insert the link at the current position
        Transforms.insertNodes(editor, link);
      }
      return true;
    } catch (error) {
      console.error('Error inserting link:', error);
      return false;
    }
  }, [editor]);

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
    insertLink, // Expose the insertLink method
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

  // Render a paragraph element or link
  const renderElement = useCallback(({ attributes, children, element }) => {
    switch (element.type) {
      case 'link':
        return <LinkComponent attributes={attributes} children={children} element={element} editor={editor} />;
      case 'paragraph':
        return <p {...attributes}>{children}</p>;
      default:
        return <p {...attributes}>{children}</p>;
    }
  }, [editor]);

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
      {/* Add custom CSS for pill links in the editor */}
      <style jsx global>{`
        /* Ensure pill links in the editor match the site's appearance */
        .unified-editor .slate-pill-link {
          display: inline-flex;
          align-items: center;
          margin: 0.125rem 0;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 0.5rem;
          transition: all 0.2s ease;
          max-width: 100%;
          cursor: pointer;
        }

        /* Ensure proper spacing around links */
        .unified-editor .slate-pill-link + .slate-pill-link {
          margin-left: 0.25rem;
        }

        /* Ensure proper text truncation */
        .unified-editor .slate-pill-link .pill-text {
          overflow: hidden;
        }

        /* Ensure proper icon alignment */
        .unified-editor .slate-pill-link svg {
          flex-shrink: 0;
        }
      `}</style>

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

// Wrap with forwardRef to fix the "Function components cannot be given refs" error
const InlineChromiumBugfix = forwardRef((_, ref) => (
  <span
    ref={ref}
    contentEditable={false}
    style={{
      display: "inline-block",
      width: 0,
      height: 0,
      lineHeight: 0,
    }}
  >
    {String.fromCodePoint(160) /* Non-breaking space */}
  </span>
));

// Add display name for debugging
InlineChromiumBugfix.displayName = 'InlineChromiumBugfix';

// Link Component that matches the PillLink styling
const LinkComponent = ({ attributes, children, element, editor }) => {
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkEditorPosition, setLinkEditorPosition] = useState({});
  const [selectedLinkElement, setSelectedLinkElement] = useState(null);
  const [selectedLinkPath, setSelectedLinkPath] = useState(null);
  const [initialLinkValues, setInitialLinkValues] = useState({});

  // Use PillStyle context to get the current pill style
  const { pillStyle, getPillStyleClasses } = usePillStyle();

  // Use our utility functions to determine link type
  const isUserLinkType = isUserLink(element.url) || element.isUser || element.className === 'user-link';
  const isPageLinkType = isPageLink(element.url) || element.pageId || element.className === 'page-link';
  const isExternalLinkType = isExternalLink(element.url) || element.isExternal || element.className === 'external-link';

  // Determine the appropriate class based on link type
  const linkTypeClass = isUserLinkType ? 'user-link' : isPageLinkType ? 'page-link' : 'external-link';

  // Add whitespace-nowrap and truncate for filled and outline modes, but allow wrapping for classic mode
  const textWrapStyle = pillStyle === 'classic' ? 'break-words' : 'whitespace-nowrap truncate';

  // Apply padding based on pill style
  const classicPadding = pillStyle === 'classic' ? '' : 'px-2 py-0.5';

  // Base styles for all pill links - EXACTLY matching PillLink component
  const baseStyles = `
    inline-flex items-center
    my-0.5
    text-sm font-medium
    rounded-lg
    transition-colors
    max-w-full
    ${textWrapStyle}
    ${classicPadding}
    ${getPillStyleClasses()}
    cursor-pointer
    ${linkTypeClass}
    slate-pill-link
  `.trim().replace(/\s+/g, ' ');

  const handleClick = (e) => {
    e.preventDefault();
    try {
      // Find the path to this element
      const path = ReactEditor.findPath(editor, element);

      // Store the element and path for the link editor
      setSelectedLinkElement(element);
      setSelectedLinkPath(path);

      // Set initial values for the link editor
      setInitialLinkValues({
        text: element.children && element.children[0] ? element.children[0].text || "" : "",
        pageId: element.pageId || null,
        pageTitle: element.pageTitle || ""
      });

      // Position the link editor
      const domSelection = window.getSelection();
      if (domSelection && domSelection.rangeCount > 0) {
        const range = domSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setLinkEditorPosition({
          top: rect.bottom + window.pageYOffset,
          left: rect.left + window.pageXOffset,
        });
      } else {
        // Fallback position
        setLinkEditorPosition({
          top: window.innerHeight / 2,
          left: window.innerWidth / 2,
        });
      }

      // Show the link editor
      setShowLinkEditor(true);
    } catch (error) {
      console.error("Error handling link click:", error);
    }
  };

  // Handle selection from the link editor
  const handleSelection = (item) => {
    // Check if this is an external link
    if (item.isExternal) {
      const displayText = item.displayText || item.url;

      if (selectedLinkElement && selectedLinkPath) {
        try {
          // Edit existing link
          Transforms.setNodes(
            editor,
            {
              type: "link",
              url: item.url,
              children: [{ text: displayText }],
              isExternal: true
            },
            { at: selectedLinkPath }
          );
        } catch (error) {
          console.error("Error updating existing link:", error);
        }
      }
    } else {
      // Handle internal page links
      // Format the title to ensure it never has @ symbols for page links
      const formattedTitle = formatPageTitle(item.displayText || item.title);

      if (selectedLinkElement && selectedLinkPath) {
        try {
          // Edit existing link
          Transforms.setNodes(
            editor,
            {
              type: "link",
              url: `/${item.id}`,
              children: [{ text: formattedTitle }],
              pageId: item.id,
              pageTitle: item.title // Store the original page title for reference
            },
            { at: selectedLinkPath }
          );
        } catch (error) {
          console.error("Error updating existing page link:", error);
        }
      }
    }

    // Reset link editor state
    setSelectedLinkElement(null);
    setSelectedLinkPath(null);
    setInitialLinkValues({});

    // Focus the editor with error handling
    try {
      ReactEditor.focus(editor);
    } catch (error) {
      console.error("Error focusing editor:", error);
    }

    // Hide the dropdown
    setShowLinkEditor(false);
  };

  return (
    <>
      <a
        {...attributes}
        contentEditable={false} // Make the link non-editable
        className={baseStyles}
        data-pill-style={pillStyle}
        data-page-id={isPageLinkType ? (element.pageId || '') : undefined}
        data-user-id={isUserLinkType ? (element.userId || '') : undefined}
        data-link-type={linkTypeClass}
        title={element.children?.[0]?.text || ''} // Add title attribute for hover tooltip on truncated text
        onClick={handleClick}
      >
        <InlineChromiumBugfix />
        {element.isPublic === false && <Lock size={14} className="mr-1 flex-shrink-0" />}
        <span className={`pill-text overflow-hidden ${pillStyle === 'classic' ? 'break-words' : 'truncate'}`}>
          {children}
        </span>
        {isExternalLinkType && (
          <ExternalLink size={14} className="ml-1 flex-shrink-0" />
        )}
        <InlineChromiumBugfix />
      </a>

      {showLinkEditor && (
        <LinkEditor
          position={linkEditorPosition}
          onSelect={handleSelection}
          setShowLinkEditor={setShowLinkEditor}
          initialText={initialLinkValues.text || ""}
          initialPageId={initialLinkValues.pageId || null}
          initialPageTitle={initialLinkValues.pageTitle || ""}
        />
      )}
    </>
  );
};

// Link Editor Component
const LinkEditor = ({ position, onSelect, setShowLinkEditor, initialText = "", initialPageId = null, initialPageTitle = "" }) => {
  const [displayText, setDisplayText] = useState(initialText);
  const [pageTitle, setPageTitle] = useState(initialPageTitle);
  const [activeTab, setActiveTab] = useState("page");
  const [selectedPageId, setSelectedPageId] = useState(initialPageId);
  const [externalUrl, setExternalUrl] = useState("");
  const [showAuthor, setShowAuthor] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);

  // Determine if we're editing an existing link or creating a new one
  const isEditing = !!initialPageId || !!initialText;

  // Track initial state for change detection
  const initialState = React.useRef({
    displayText: initialText,
    pageTitle: initialPageTitle,
    selectedPageId: initialPageId,
    externalUrl: "",
    showAuthor: false,
    activeTab: "page"
  });

  // Enable save if any field changes
  useEffect(() => {
    const changed =
      displayText !== initialState.current.displayText ||
      pageTitle !== initialState.current.pageTitle ||
      selectedPageId !== initialState.current.selectedPageId ||
      externalUrl !== initialState.current.externalUrl ||
      showAuthor !== initialState.current.showAuthor ||
      activeTab !== initialState.current.activeTab;
    setHasChanged(changed);
  }, [displayText, pageTitle, selectedPageId, externalUrl, showAuthor, activeTab]);

  // Validation helpers
  const isPageValid = activeTab === 'page' && !!selectedPageId;
  const isExternalValid = activeTab === 'external' && externalUrl && (externalUrl.startsWith('http://') || externalUrl.startsWith('https://'));
  const canSave = hasChanged && ((activeTab === 'page' && isPageValid) || (activeTab === 'external' && isExternalValid));

  const handleClose = () => {
    setShowLinkEditor(false);
  };

  // Handle external URL changes
  const handleExternalUrlChange = (e) => {
    setExternalUrl(e.target.value);
    setHasChanged(true);
  };

  // Handle display text changes
  const handleDisplayTextChange = (e) => {
    setDisplayText(e.target.value);
    setHasChanged(true);
  };

  // Handle save for external links
  const handleExternalSubmit = () => {
    if (isExternalValid) {
      onSelect({
        url: externalUrl,
        displayText: displayText,
        isExternal: true
      });
    }
  };

  // Handle save for page links
  const handleSave = (item) => {
    if (canSave) {
      onSelect({
        ...item,
        showAuthor
      });
    }
  };

  // Position the link editor
  const editorStyle = {
    position: 'absolute',
    zIndex: 1000,
    top: `${position.top}px`,
    left: `${position.left}px`,
    maxWidth: '400px',
    width: '90%',
    backgroundColor: 'var(--background)',
    borderRadius: '0.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    border: '1px solid var(--border)'
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[999] dark:bg-black/50"
        onClick={handleClose}
      />
      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[400px] bg-background rounded-xl shadow-xl z-[1000] border border-border flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - fixed at top */}
        <div className="p-4 flex items-center justify-between border-b border-border">
          <h2 className="text-base font-medium flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            {isEditing ? 'Edit link' : 'Create link'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <span className="sr-only">Close</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 border-b border-border">
          <div className="flex">
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${activeTab === 'page'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('page')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              WeWrite Page
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${activeTab === 'external'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('external')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
              External link
            </button>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'page' ? (
            <div className="p-4">
              <div>
                <TypeaheadSearch
                  onSelect={(page) => {
                    setSelectedPageId(page.id);
                    setPageTitle(page.title);
                    setDisplayText(page.title);
                  }}
                  placeholder="Search pages..."
                  initialSelectedId={selectedPageId}
                  displayText={displayText}
                  setDisplayText={setDisplayText}
                  preventRedirect={true}
                  onInputChange={(value) => {
                    if (value && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('www.') || value.includes('.com') || value.includes('.org') || value.includes('.net') || value.includes('.io'))) {
                      setActiveTab('external');
                      setExternalUrl(value);
                    }
                  }}
                />
                {/* Show Author Switch */}
                <div className="flex items-center gap-2 mt-4 mb-4">
                  <input
                    type="checkbox"
                    checked={showAuthor}
                    onChange={(e) => setShowAuthor(e.target.checked)}
                    id="show-author-switch"
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="show-author-switch" className="text-sm font-medium select-none">Show author</label>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <h2 className="text-sm font-medium">Text</h2>
                <input
                  type="text"
                  value={displayText}
                  onChange={handleDisplayTextChange}
                  placeholder="Link text"
                  className="w-full p-2 bg-muted/50 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground text-sm"
                />
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-medium">URL</h2>
                <input
                  type="url"
                  value={externalUrl}
                  onChange={handleExternalUrlChange}
                  placeholder="https://example.com"
                  className="w-full p-2 bg-muted/50 rounded-lg border border-border focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground text-sm"
                />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={showAuthor}
                  onChange={(e) => setShowAuthor(e.target.checked)}
                  id="show-author-switch-ext"
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="show-author-switch-ext" className="text-sm font-medium select-none">Show author</label>
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer with button */}
        <div className="p-4 border-t border-border">
          {activeTab === 'page' ? (
            <button
              onClick={() => handleSave({ id: selectedPageId, title: pageTitle })}
              disabled={!canSave}
              className="w-full py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? 'Save changes' : 'Insert link'}
            </button>
          ) : (
            <button
              onClick={handleExternalSubmit}
              disabled={!canSave}
              className="w-full py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? 'Save changes' : 'Add External Link'}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default UnifiedEditor;
