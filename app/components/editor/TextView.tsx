/**
 * WeWrite Click-to-Edit Implementation - TextView Component
 *
 * Enhanced TextView component with comprehensive click-to-edit functionality
 * that provides intuitive editing experience with smart click detection.
 *
 * Click-to-Edit Features Implemented:
 * 1. **Smart Click Detection**
 *    - Content Area Only: Click-to-edit only activates on main page content area
 *    - Interactive Element Exclusion: Clicks on links, buttons ignored
 *    - Visual Feedback: Hover effects and cursor changes indicate editable content
 *
 * 2. **Enhanced User Experience**
 *    - Visual Indicators: Subtle hover effect with background color change
 *    - Cursor changes to text cursor when hovering over editable content
 *    - "Click to edit" tooltip appears on hover
 *    - Small edit indicator (✏️) in top-right corner when hovering
 *
 * 3. **Position Tracking**
 *    - Captures exact click coordinates for cursor positioning
 *    - Passes position data to editor for smart cursor placement
 *    - Handles both absolute and relative positioning
 *
 * 4. **Permission Integration**
 *    - Respects canEdit prop for permission enforcement
 *    - Only shows edit indicators for authorized users
 *    - Maintains read-only view for unauthorized users
 *
 * Interactive Elements Excluded:
 * - Links (<a> tags)
 * - Buttons (<button> tags)
 * - Elements with role="button"
 * - Elements with .no-edit-trigger class
 *
 * Visual Feedback System:
 * - Hover state: bg-muted/20 background with smooth transition
 * - Edit indicator: Positioned top-right with opacity transitions
 * - Cursor changes: Text cursor for editable areas
 * - Tooltip guidance: "Click to edit" messaging
 *
 * State Management Flow:
 * 1. User clicks on content area
 * 2. Position captured and validated
 * 3. setIsEditing called with position data
 * 4. Editor receives position for cursor placement
 * 5. Smooth transition to edit mode
 */

import React, { useState, useEffect, useCallback, useRef, useMemo, Fragment } from "react";
import { usePage } from "../../contexts/PageContext";
import { useLineSettings } from "../../contexts/LineSettingsContext";
import { CONTENT_TYPES } from "../../utils/constants";
import PillLink from "../utils/PillLink";
// Removed Tooltip imports to avoid Radix UI ref composition issues
import { getPageById } from "../../utils/apiClient";
import { LINE_MODES } from '../../contexts/LineSettingsContext';
import { motion, AnimatePresence, useScroll, useSpring, useInView, useTransform } from "framer-motion";
import { useAuth } from '../../providers/AuthProvider';
import { isExternalLink } from "../../utils/linkFormatters";
import { validateLink, getLinkDisplayText, extractPageIdFromUrl } from '../../utils/linkValidator';
import { Button } from "../ui/button";
import { usePillStyle } from "../../contexts/PillStyleContext";
import { ExternalLink, Edit2 } from "lucide-react";
import Modal from "../ui/modal";
import ExternalLinkPreviewModal from "../ui/ExternalLinkPreviewModal";
import { useControlledAnimation } from "../../hooks/useControlledAnimation";
import { truncateExternalLinkText } from "../../utils/textTruncation";
import type { TextViewProps } from "../../types/components";
import type { EditorContent, EditorNode, EditorChild, ViewMode } from "../../types/database";
import LinkNode from "./LinkNode";
import InternalLinkWithTitle from "./InternalLinkWithTitle";
import "../diff-styles.css";

/**
 * TextView Component - Renders text content in normal paragraph mode
 *
 * PARAGRAPH MODE:
 *
 * Normal Mode:
 *    - Paragraph numbers create indentation (like traditional documents)
 *    - Numbers positioned to the left of the text
 *    - Creates a clear indent for each paragraph
 *    - Standard text size (1rem/16px)
 *    - Proper spacing between paragraphs
 *
 * IMPLEMENTATION NOTES:
 * - Uses paragraph number style (text-muted-foreground)
 * - Standard text size (1rem/16px)
 * - Uses ParagraphNode component with proper spacing and indentation
 * - Smooth animations for transitions
 */

// Cache for page titles to avoid redundant API calls
const pageTitleCache = new Map<string, string>();

// Animation constants for consistent behavior across modes
const ANIMATION_CONSTANTS = {
  PARAGRAPH_LOADING_DELAY: 30, // ms between each paragraph appearance in normal mode
  DENSE_PARAGRAPH_LOADING_DELAY: 15, // ms between each paragraph appearance in dense mode (faster)
  SPRING_STIFFNESS: 500,
  SPRING_DAMPING: 30,
  SPRING_MASS: 1
} as const;

// Helper: linkify plain text segments (for legacy bios/raw text)
const renderLinkifiedText = (text: string, className = ''): React.ReactNode[] | null => {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const [rawUrl] = match;
    const start = match.index;

    if (start > lastIndex) {
      segments.push(
        <span key={`text-${start}`} className={className || undefined}>
          {text.slice(lastIndex, start)}
        </span>
      );
    }

    const href = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    segments.push(
      <a
        key={`link-${start}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} text-primary underline underline-offset-2 break-words`.trim()}
      >
        {rawUrl}
      </a>
    );

    lastIndex = start + rawUrl.length;
  }

  if (segments.length === 0) return null;

  if (lastIndex < text.length) {
    segments.push(
      <span key={`text-${lastIndex}`} className={className || undefined}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  return segments;
};

// Function to extract page ID from URL
// CRITICAL FIX: Use the standardized utility function from linkValidator.js
const extractPageId = (url: string): string | null => {
  return extractPageIdFromUrl(url);
};

// Function to get page title from ID
const getPageTitle = async (pageId: string): Promise<string | null> => {
  if (!pageId) return null;

  // Check cache first
  if (pageTitleCache.has(pageId)) {
    return pageTitleCache.get(pageId);
  }

  try {
    const { pageData } = await getPageById(pageId);
    if (pageData && pageData.title) {
      // Store in cache
      pageTitleCache.set(pageId, pageData.title);
      return pageData.title;
    }
  } catch (error) {
    console.error("Error fetching page title:", error);
  }

  return null;
};

const TextView: React.FC<TextViewProps> = ({
  content,
  isSearch = false,
  viewMode = 'normal',
  onRenderComplete,
  setIsEditing,
  showDiff = false,
  canEdit: propCanEdit,
  onActiveLine,
  showLineNumbers = true,
  isEditing = false
}) => {
  // Simple link editing handler - just shows an alert for now
  // In a full implementation, this would open a link editing modal
  const handleEditLink = () => {
    alert('Link editing is not available in TextView. Please use the main Editor component for full editing capabilities.');
  };
  console.log('🔍 TextView: Component called with content:', {
    content,
    contentType: typeof content,
    isArray: Array.isArray(content),
    contentLength: content ? (Array.isArray(content) ? content.length : content.length) : 0
  });

  const [parsedContents, setParsedContents] = useState<EditorContent | null>(null);
  const [language, setLanguage] = useState<string | null>(null);

  // Get the full context to ensure we're subscribed to all updates
  const { lineMode = LINE_MODES.NORMAL, lineFeaturesEnabled = false } = useLineSettings() ?? {};

  const [loadedParagraphs, setLoadedParagraphs] = useState<number[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [showEditTooltip, setShowEditTooltip] = useState<boolean>(false);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const { user } = useAuth();
  const { page } = usePage();

  // Debug: Check if context is working (disabled to prevent spam)
  // console.log('🔍 TextView: Full context:', lineSettingsContext);

  // Check if current user can edit this page (enhanced for group support)
  // Use prop value if provided, otherwise calculate
  const canEdit = propCanEdit !== undefined ? propCanEdit : Boolean(
    setIsEditing &&
    user?.uid &&
    page &&
    (
      // User is the page owner
      (page.userId && user.uid === page.userId) ||
      // OR page belongs to a group and user is a member of that group
      (page.groupId && page.hasGroupAccess)
    )
  );

  // All pages are now public, so everyone can view
  const canView = true;

  // Use lineMode from context as the primary mode, but force normal mode when editing
  const effectiveMode = isEditing ? LINE_MODES.NORMAL : (lineMode || LINE_MODES.NORMAL);

  // Create a unique key that changes when lineMode changes to force complete re-render
  // This ensures the component properly updates when switching between dense and normal modes
  const renderKey = useMemo(() => `content-view-${effectiveMode}`, [effectiveMode]);

  // Force re-render when lineMode changes
  useEffect(() => {
    // Force a re-render by updating the loaded paragraphs
    if (parsedContents && Array.isArray(parsedContents)) {
      const paragraphCount = parsedContents.filter(node => node.type === CONTENT_TYPES.PARAGRAPH).length;
      setLoadedParagraphs(Array.from({ length: paragraphCount }, (_, i) => i));
    }
  }, [lineMode, parsedContents]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 0);
    };

    window.addEventListener("scroll", handleScroll);

    // Also run once on initial render to set positions
    setTimeout(handleScroll, 100);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Function to handle any post-render tasks (simplified since we no longer need line number alignment)
  const handlePostRender = useCallback(() => {
    // This function is kept as a placeholder for any future post-render tasks
    // Line number synchronization is no longer needed with inline paragraph numbers
  }, []);

  useEffect(() => {
    // Skip processing if content is null or undefined
    if (!content) {
      console.log("🔍 TextView: Content is null or undefined, using empty content", {
        content,
        contentType: typeof content,
        contentValue: content
      });
      setParsedContents([]);
      setLoadedParagraphs([]);
      setIsInitialLoad(true);
      return;
    }

    let contents;
    try {
      console.log("🔍 TextView: Starting content processing", {
        content,
        contentType: typeof content,
        isArray: Array.isArray(content),
        contentLength: content ? (Array.isArray(content) ? content.length : content.length) : 0
      });

      // Handle different content types
      if (typeof content === "string") {
        try {
          // Check if content is already parsed (double parsing issue)
          if (content.startsWith('[{"type":"paragraph"') || content.startsWith('[{\\\"type\\\":\\\"paragraph\\\"')) {
            contents = JSON.parse(content);
            console.log("TextView: Successfully parsed string content");
          } else {
            // Content might be double-stringified, try to parse twice
            try {
              const firstParse = JSON.parse(content);
              if (typeof firstParse === 'string' &&
                  (firstParse.startsWith('[{"type":"paragraph"') ||
                   firstParse.startsWith('[{\\\"type\\\":\\\"paragraph\\\"'))) {
                contents = JSON.parse(firstParse);
                console.log("TextView: Successfully parsed double-stringified content");
              } else {
                contents = firstParse;
                console.log("TextView: Using first-level parsed content");
              }
            } catch (doubleParseError) {
              console.error("TextView: Error parsing potentially double-stringified content:", doubleParseError);
              // Fall back to original parsing
              contents = JSON.parse(content);
            }
          }
        } catch (parseError) {
          console.error("TextView: Error parsing string content:", parseError);
          console.error("TextView: Content that failed to parse:", content?.substring(0, 200) + "...");

          // Try to determine if this is a completely empty or invalid page
          if (!content || content.trim() === '' || content === 'null' || content === 'undefined') {
            contents = [{
              type: "paragraph",
              children: [{ text: "This page is empty. Click to start writing!" }]
            }];
          } else {
            // Create a fallback content structure with more helpful error message
            contents = [{
              type: "paragraph",
              children: [{ text: "Error loading content. The page data may be corrupted. Try refreshing the page or contact support if the issue persists." }]
            }];
          }
        }
      } else if (Array.isArray(content)) {
        // Content is already an array, use it directly
        contents = content;
        console.log("TextView: Using array content directly");
      } else if (content && typeof content === 'object') {
        // Content is an object, convert to array if needed
        contents = [content];
        console.log("TextView: Converted object content to array");
      } else {
        // Fallback for null or undefined content
        contents = [{
          type: "paragraph",
          children: [{ text: "No content available." }]
        }];
        console.log("TextView: Using fallback empty content");
      }

      // CRITICAL FIX: Log the parsed content structure for debugging
      console.log("CONTENT_DEBUG: Content processed successfully", {
        parsedContentType: typeof contents,
        isArray: Array.isArray(contents),
        length: Array.isArray(contents) ? contents.length : 0,
        firstItem: Array.isArray(contents) && contents.length > 0 ?
          JSON.stringify(contents[0]).substring(0, 50) + '...' : 'none'
      });

      // IMPROVED: More thorough link detection in content
      if (Array.isArray(contents)) {
        let foundLinks = [];

        // Recursive function to find links at any nesting level
        const findLinksInNode = (node, path) => {
          // Check if the node itself is a link
          if (node.type === 'link') {
            foundLinks.push({
              location: path,
              node: JSON.stringify(node)
            });
          }

          // Check children if they exist
          if (node.children && Array.isArray(node.children)) {
            node.children.forEach((child, index) => {
              const childPath = `${path}-child-${index}`;

              // If child is a link, add it
              if (child.type === 'link') {
                foundLinks.push({
                  location: childPath,
                  node: JSON.stringify(child)
                });
              }

              // Recursively check child's children
              if (child.children && Array.isArray(child.children)) {
                findLinksInNode(child, childPath);
              }
            });
          }
        };

        // Process each top-level node
        contents.forEach((node, i) => {
          findLinksInNode(node, `node-${i}`);
        });

        // Log any found links
        if (foundLinks.length > 0) {
          console.log(`CONTENT_DEBUG: Found ${foundLinks.length} links in content:`, foundLinks);
        } else {
          console.log('CONTENT_DEBUG: No links found in content');
        }
      }

      // Validate content structure - ensure each item has type and children
      if (Array.isArray(contents)) {
        contents = contents.filter((item, index) => {
          if (!item || !item.type) {
            console.warn(`TextView: Filtering out invalid content item at index ${index}`);
            return false;
          }
          return true;
        });
      }
    } catch (e) {
      console.error("TextView: Unexpected error processing content:", e);
      console.error("TextView: Content type:", typeof content);
      console.error("TextView: Content preview:", content?.toString().substring(0, 100) + "...");

      // Create a more helpful fallback content structure
      contents = [{
        type: "paragraph",
        children: [{ text: "Unable to load page content. This may be due to a temporary issue. Please try refreshing the page, and if the problem persists, contact support." }]
      }];
    }

    // Always ensure contents is an array
    if (!Array.isArray(contents)) {
      contents = contents ? [contents] : [];
    }

    // Deduplicate content items that might be duplicated in development environment
    // This is a fix for the local development environment issue
    if (Array.isArray(contents) && contents.length > 0) {
      const uniqueItems = [];
      const seen = new Set();

      contents.forEach(item => {
        // Create a simple hash of the item to detect duplicates
        const itemHash = JSON.stringify(item);
        if (!seen.has(itemHash)) {
          seen.add(itemHash);
          uniqueItems.push(item);
        } else {
          console.log("TextView: Filtered out duplicate content item");
        }
      });

      contents = uniqueItems;
    }

    // No protocol link detection needed

    // Update state with the processed content
    setParsedContents(contents);

    // CRITICAL FIX: Immediately load all paragraphs instead of progressive loading
    if (Array.isArray(contents) && contents.length > 0) {
      // Create an array with indices for all paragraphs
      const allParagraphIndices = Array.from({ length: contents.length }, (_, i) => i);
      setLoadedParagraphs(allParagraphIndices);
      console.log("TextView: Immediately loading all paragraphs:", allParagraphIndices);
    } else {
      setLoadedParagraphs([]);
    }

    // Set initial load state
    setIsInitialLoad(true);

    // Force a re-render to ensure the content is displayed
    window.requestAnimationFrame(() => {
      // Mark as complete after a short delay
      setTimeout(() => {
        setIsInitialLoad(false);

        // Call onRenderComplete callback if provided
        if (onRenderComplete && typeof onRenderComplete === 'function') {
          onRenderComplete();
        }

        // Handle any post-render tasks
        handlePostRender();
      }, 100);
    });
  }, [content, handlePostRender, onRenderComplete]);

  // Modified loading animation effect to implement progressive loading for both modes
  useEffect(() => {
    if (parsedContents && isInitialLoad) {
      // Count the number of paragraph nodes (WeWrite only supports paragraphs)
      const paragraphNodes = parsedContents.filter(node =>
        node.type === CONTENT_TYPES.PARAGRAPH
      );

      // Get total number of nodes
      const totalNodes = paragraphNodes.length;

      // Total paragraphs to load (logging disabled)

      // Use normal mode loading delay (dense mode removed)
      const loadingDelay = ANIMATION_CONSTANTS.PARAGRAPH_LOADING_DELAY;

      // Progressive loading for both modes
      if (totalNodes > 0) {
        // CRITICAL FIX: Load all paragraphs at once to ensure proper rendering
        // Create an array with indices for all paragraphs
        const allParagraphIndices = Array.from({ length: totalNodes }, (_, i) => i);
        setLoadedParagraphs(allParagraphIndices);

        // Log the loaded paragraphs for debugging
        console.log("TextView: Loading all paragraphs at once:", allParagraphIndices);

        // Mark as complete after a short delay
        setTimeout(() => {
          setIsInitialLoad(false);

          // Call onRenderComplete callback
          if (onRenderComplete && typeof onRenderComplete === 'function') {
            onRenderComplete();
          }

          // Handle any post-render tasks
          handlePostRender();
        }, 100); // Short delay after all paragraphs are loaded
      } else {
        // If there are no paragraphs, call onRenderComplete immediately
        setIsInitialLoad(false);
        if (onRenderComplete && typeof onRenderComplete === 'function') {
          onRenderComplete();
        }
      }
    }
  }, [parsedContents, isInitialLoad, onRenderComplete, handlePostRender, effectiveMode]);

  // Use compact styling without prose classes that add excessive padding
  const getViewModeStyles = useMemo(() => {
    // FIXED: Remove prose classes that add excessive padding, use compact layout
    const modeClass = effectiveMode === LINE_MODES.DENSE ? 'dense-mode' : 'normal-mode';
    return `editor-content page-editor-stable box-border mode-transition ${modeClass}`;
  }, [effectiveMode]);

  // Handle click to edit - WYSIWYG smooth transition
  const handleActiveLine = (index) => {
    setActiveLineIndex(index);
    if (canEdit && setIsEditing) {
      // Set editing state immediately without animations or overlays
      // for a smoother WYSIWYG transition
      setIsEditing(true);
    }
  };

  // We no longer need to generate line numbers since we're using inline paragraph numbers

  // This effect is no longer needed since we're using inline paragraph numbers
  // We've removed the complex alignment logic that was previously required
  useEffect(() => {
    // No-op - keeping the effect as a placeholder in case we need to add scroll-related
    // functionality in the future
  }, []);

  // Generate a unique component ID for this TextView instance
  const componentId = `text-view-${page?.id || 'default'}`;

  // Control animation to prevent double rendering effect
  // Enable animateOnNavigation to ensure smooth transitions between pages
  const shouldAnimate = useControlledAnimation(componentId, false, true);

  // Enhanced click handler for better edit mode transition
  const handleContentClick = (event) => {
    // Only proceed if user has edit permissions and setIsEditing function is available
    if (!canEdit || !setIsEditing) {
      // For users without edit permissions, let link clicks work normally
      // but don't trigger any edit mode functionality
      return;
    }

    // CRITICAL FIX: More comprehensive interactive element detection to prevent edit mode flash
    const target = event.target;

    // Check for interactive elements with multiple selectors to catch all link types
    const isInteractiveElement = target.closest([
      'a',                    // Standard anchor tags
      'button',               // Button elements
      '[role="button"]',      // Elements with button role
      '.no-edit-trigger',     // Elements explicitly marked to not trigger edit
      '[data-pill-style]',    // PillLink components
      '.pill-link',           // PillLink class
      '.slate-pill-link',     // Slate editor pill links
      '.compound-link-container', // Compound links
      '.page-link',           // Page links
      '.user-link',           // User links
      '.external-link',       // External links
      '.special-link',        // Special links
      '.protocol-link'        // Protocol links
    ].join(', '));

    if (isInteractiveElement) {
      // CRITICAL: Completely stop event processing for interactive elements
      // This prevents any edit mode activation when clicking links
      event.stopPropagation();
      event.preventDefault();

      // Let the interactive element handle its click in the next tick
      // This ensures navigation happens without edit mode interference
      setTimeout(() => {
        if (isInteractiveElement.click && typeof isInteractiveElement.click === 'function') {
          // Re-trigger the click on the interactive element if needed
          // Most links handle their own clicks, but this is a safety net
        }
      }, 0);

      return;
    }

    // Only users with edit permissions reach this point for non-interactive content
    // Store click position for cursor positioning in edit mode
    const rect = event.currentTarget.getBoundingClientRect();
    const newClickPosition = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      clientX: event.clientX,
      clientY: event.clientY
    };

    // Update click position state
    setClickPosition(newClickPosition);

    // Set editing state with click position for cursor positioning
    setIsEditing(true, newClickPosition);
  };

  // Wrap the component in an error boundary with enhanced error handling
  try {
    // Additional safety check for polyfills
    if (typeof window !== 'undefined') {
      // Check if Intl.Segmenter is available (polyfill should provide this)
      if (!window.Intl || !window.Intl.Segmenter) {
        console.warn('TextView: Intl.Segmenter not available, some text features may be limited');
      }
    }

    // Dense mode removed - only normal mode supported

    // Use the standard block layout (normal mode only)
    return (
      <div
        key={`textview-normal`}
        className="page-content unified-editor relative rounded-lg bg-background w-full max-w-none"
      >
        <div
          className={`${getViewModeStyles} w-full text-left ${
            isScrolled ? 'pb-16' : ''
          } ${
            canEdit ? 'relative cursor-text' : 'relative'
          } ${
            canEdit && isHovering ? 'bg-muted/20' : ''
          } transition-colors duration-150 outline-none page-editor-stable box-border`}
          data-mode={effectiveMode}
          data-debug-classes={getViewModeStyles}
          onClick={handleContentClick}
          onMouseEnter={(e) => {
            // Only show hover effects for users with edit permissions
            if (canEdit) {
              // Only show hover state if not hovering over interactive elements
              const target = e.target;
              const isInteractiveElement = target.closest('a, button, [role="button"], .no-edit-trigger, [data-pill-style]');
              if (!isInteractiveElement) {
                setIsHovering(true);
                setShowEditTooltip(true);
              }
            }
          }}
          onMouseLeave={() => {
            // Only handle hover state for users with edit permissions
            if (canEdit) {
              setIsHovering(false);
              setShowEditTooltip(false);
            }
          }}
          onMouseMove={(e) => {
            if (canEdit) {
              // Dynamically check if we're hovering over interactive elements
              const target = e.target;
              const isInteractiveElement = target.closest('a, button, [role="button"], .no-edit-trigger, [data-pill-style]');
              setShowEditTooltip(!isInteractiveElement);
            }
          }}
          title={canEdit && showEditTooltip ? "Click to edit" : ""}
        >

          {!parsedContents && !isSearch && (
            <div className="text-muted-foreground">
              {/* REMOVED: Excessive padding for compact layout */}
              <div className="unified-paragraph">
                <span className="paragraph-number">1</span>
                <span className="unified-text-content">No content available</span>
              </div>
            </div>
          )}

          {parsedContents && (
            <RenderContent
              key={`${renderKey}-${effectiveMode}`}
              contents={parsedContents}
              language={language}
              loadedParagraphs={loadedParagraphs}
              effectiveMode={effectiveMode}
              canEdit={canEdit}
              activeLineIndex={activeLineIndex}
              onActiveLine={handleActiveLine}
              showDiff={showDiff}
              clickPosition={clickPosition}
              isEditing={isEditing}
              handleEditLink={handleEditLink}
              lineFeaturesEnabled={lineFeaturesEnabled}
              showLineNumbers={showLineNumbers}
            />
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error rendering TextView:', error);
    console.error('TextView render error details:', {
      pageId: page?.id,
      contentType: typeof content,
      hasContent: !!content,
      errorMessage: error.message,
      errorStack: error.stack,
      userAgent: typeof window !== 'undefined' ? window.navigator?.userAgent : 'server',
      hasIntlSegmenter: typeof window !== 'undefined' ? !!(window.Intl && window.Intl.Segmenter) : 'unknown'
    });

    return (
      <div className="p-6 text-center space-y-4">
        <div className="text-muted-foreground">
          <p className="font-medium">Unable to display page content</p>
          <p className="text-sm mt-2">
            There was an error rendering this page. This could be due to corrupted data or a temporary issue.
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            Refresh Page
          </button>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm hover:bg-secondary/90"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }
};

export const RenderContent = (props: {
  contents: any;
  loadedParagraphs: number[];
  effectiveMode: LINE_MODES;
  canEdit?: boolean;
  activeLineIndex?: number | null;
  onActiveLine?: ((idx: number) => void) | null;
  showDiff?: boolean;
  clickPosition?: { x: number; y: number; clientX: number; clientY: number } | null;
  isEditing?: boolean;
  handleEditLink?: () => void;
  lineFeaturesEnabled?: boolean;
  showLineNumbers?: boolean;
}) => {
  const {
    contents,
    loadedParagraphs,
    effectiveMode,
    canEdit = false,
    activeLineIndex = null,
    onActiveLine = null,
    showDiff = false,
    clickPosition = null,
    isEditing = false,
    handleEditLink,
    lineFeaturesEnabled: lineFeaturesEnabledProp = false,
    showLineNumbers = true
  } = props;

  // Explicitly coerce the flag to avoid any undefined reference issues in compiled output.
  const lineFeaturesEnabled = Boolean(lineFeaturesEnabledProp);
  const effectiveShowLineNumbers = lineFeaturesEnabled && showLineNumbers;
  // Wrap in try-catch to handle any rendering errors
  try {
    if (!contents) return null;

    if (Array.isArray(contents)) {
      // Dense mode: render as continuous text with inline paragraph numbers
      if (effectiveMode === LINE_MODES.DENSE) {
        const paragraphNodes = contents.filter(node => node.type === CONTENT_TYPES.PARAGRAPH);
        const loadedNodes = paragraphNodes.filter((_, index) => loadedParagraphs.includes(index));

        // Helper function to render child nodes in dense mode
        const renderDenseChild = (child, i) => {
          // Handle link nodes with error handling
          if (child.type === 'link') {
            try {
              return <LinkNode key={i} node={child} canEdit={canEdit} isEditing={isEditing} onEditLink={handleEditLink} />;
            } catch (error) {
              console.error('DENSE_LINK_ERROR: Error rendering link in dense mode:', error);
              return <span key={i} className="text-red-500">[Link Error]</span>;
            }
          }
          // Handle text nodes
          else if (child.text) {
            let className = '';
            if (child.bold) className += ' font-bold';
            if (child.italic) className += ' italic';
            if (child.underline) className += ' underline';

            if (child.code) {
              return (
                <code
                  key={i}
                  className={`px-1.5 py-0.5 mx-0.5 rounded bg-muted font-mono ${className}`}
                >
                  {child.text}
                </code>
              );
            }

            const linkifiedSegments = renderLinkifiedText(child.text, className.trim());
            if (linkifiedSegments) {
              return (
                <React.Fragment key={i}>
                  {linkifiedSegments}
                </React.Fragment>
              );
            }

            return (
              <span key={i} className={className || undefined}>
                {child.text}
              </span>
            );
          }
          return null;
        };

        return (
          <div className="dense-mode-container">
            {loadedNodes.map((node, index) => {
              const actualIndex = paragraphNodes.indexOf(node);
              return (
                <React.Fragment key={actualIndex}>
                  {effectiveShowLineNumbers && (
                    <span
                      className="paragraph-number"
                      style={{
                        animationDelay: `${index * ANIMATION_CONSTANTS.DENSE_PARAGRAPH_LOADING_DELAY}ms`,
                        display: 'inline'
                      }}
                    >
                      {actualIndex + 1}
                    </span>
                  )}
                  <span
                    className="dense-paragraph-content"
                    style={{
                      animationDelay: `${index * ANIMATION_CONSTANTS.DENSE_PARAGRAPH_LOADING_DELAY + 100}ms`
                    }}
                  >
                    {node.children?.map((child, childIndex) => renderDenseChild(child, childIndex))}
                  </span>
                  {index < loadedNodes.length - 1 && <span className="dense-paragraph-separator"> </span>}
                </React.Fragment>
              );
            })}
          </div>
        );
      }

      // Normal mode: render as separate paragraph blocks
      return (
        <>
          {contents.map((node, index) => {
            if (!loadedParagraphs.includes(index)) return null;
            if (node.type !== CONTENT_TYPES.PARAGRAPH) return null;

            return (
              <SimpleParagraphNode
                key={index}
                node={node}
                index={index}
                canEdit={canEdit}
                isActive={activeLineIndex === index}
                onActiveLine={onActiveLine}
                showDiff={showDiff}
                isEditing={isEditing}
                animationDelay={index * ANIMATION_CONSTANTS.PARAGRAPH_LOADING_DELAY}
                handleEditLink={handleEditLink}
                lineMode={effectiveMode}
                lineFeaturesEnabled={lineFeaturesEnabled}
                showLineNumbers={effectiveShowLineNumbers}
              />
            );
          })}
        </>
      );
    }

    return null;

  } catch (error) {
    console.error('Error rendering content:', error);
    return (
      <div className="p-6 text-center space-y-4">
        <div className="text-muted-foreground">
          <p className="font-medium">Content rendering error</p>
          <p className="text-sm mt-2">
            There was an error displaying the page content. This could be due to corrupted data.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          Refresh Page
        </button>
      </div>
    );
  }
};

/**
 * SimpleParagraphNode - Renders a paragraph as a simple div
 * CSS handles dense mode styling automatically via container classes
 */
const SimpleParagraphNode = (props: {
  node: any;
  index?: number;
  canEdit?: boolean;
  isActive?: boolean;
  onActiveLine?: ((idx: number) => void) | null;
  showDiff?: boolean;
  isEditing?: boolean;
  animationDelay?: number;
  handleEditLink?: () => void;
  lineMode?: LINE_MODES;
  lineFeaturesEnabled?: boolean;
  showLineNumbers?: boolean;
}) => {
  const {
    node,
    index = 0,
    canEdit = false,
    isActive = false,
    onActiveLine = null,
    showDiff = false,
    isEditing = false,
    animationDelay = 0,
    handleEditLink,
    lineMode = LINE_MODES.NORMAL,
    lineFeaturesEnabled: lineFeaturesEnabledProp = false,
    showLineNumbers = true
  } = props;
  const lineFeaturesEnabled = Boolean(lineFeaturesEnabledProp);
  const paragraphRef = useRef(null);
  const [lineHovered, setLineHovered] = useState(false);

  // Handle click to edit - only for users with edit permissions
  const handleClick = () => {
    // Only trigger edit mode if user has edit permissions
    if (canEdit && onActiveLine) {
      onActiveLine(index);
    }
    // For users without edit permissions, do nothing
    // Links within paragraphs will handle their own navigation
  };

  // Helper function to render child nodes
  const renderChild = (child, i) => {
    console.log('🔍 TextView renderChild: Processing child:', {
      childType: child?.type,
      childText: child?.text,
      childIndex: i,
      isLink: child?.type === 'link',
      fullChild: JSON.stringify(child)
    });

    // Legacy link fallback: treat nodes with a url but missing type as links
    if (!child.type && child.url) {
      child = {
        type: 'link',
        url: child.url,
        isExternal: /^https?:\/\//i.test(child.url),
        children: [{ text: child.text || child.displayText || child.url }]
      };
    }

    // Handle link nodes with error handling
    if (child.type === 'link') {
      try {
        console.log('🔗 PARAGRAPH_LINK_DEBUG: Rendering link in paragraph:', JSON.stringify(child));
        const linkComponent = <LinkNode key={i} node={child} canEdit={canEdit} isEditing={isEditing} onEditLink={handleEditLink} />;
        console.log('🔗 PARAGRAPH_LINK_DEBUG: LinkNode component created successfully');
        return linkComponent;
      } catch (error) {
        console.error('🚨 PARAGRAPH_LINK_ERROR: Error rendering link in paragraph:', error);
        return <span key={i} className="text-red-500">[Link Error]</span>;
      }
    }
    // Handle text nodes
    else if (child.text) {
      let className = '';
      if (child.bold) className += ' font-bold';
      if (child.italic) className += ' italic';
      if (child.underline) className += ' underline';
      if ((child as any).metadata?.pasted) className += ' hover:bg-accent/20 rounded-sm transition-colors';

      // Add diff highlighting classes if showDiff is true
      if (showDiff) {
        if (child.added) className += ' bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
        if (child.removed) className += ' bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 line-through';
      }

      if (child.code) {
        return (
          <code
            key={i}
            className={`px-1.5 py-0.5 mx-0.5 rounded bg-muted font-mono ${className}`}
          >
            {child.text}
          </code>
        );
      }

      const linkifiedSegments = renderLinkifiedText(child.text, className.trim());
      if (linkifiedSegments) {
        return (
          <React.Fragment key={i}>
            {linkifiedSegments}
          </React.Fragment>
        );
      }

      return (
        <span key={i} className={className || undefined}>
          {child.text}
        </span>
      );
    }
    // Handle nested nodes
    else if (child.children && Array.isArray(child.children)) {
      return (
        <React.Fragment key={i}>
          {child.children.map((grandchild, grandchildIndex) => {
            // Legacy link fallback for nested children
            let nodeToRender = grandchild;
            if (!nodeToRender.type && nodeToRender?.url) {
              nodeToRender = {
                type: 'link',
                url: nodeToRender.url,
                isExternal: /^https?:\/\//i.test(nodeToRender.url),
                children: [{ text: nodeToRender.text || nodeToRender.displayText || nodeToRender.url }]
              };
            }

            if (nodeToRender.type === 'link') {
              return <LinkNode key={`${i}-${grandchildIndex}`} node={nodeToRender} canEdit={canEdit} isEditing={isEditing} onEditLink={handleEditLink} />;
            } else if (nodeToRender.text) {
              let className = '';
              if (nodeToRender.bold) className += ' font-bold';
              if (nodeToRender.italic) className += ' italic';
              if (nodeToRender.underline) className += ' underline';

              const linkifiedSegments = renderLinkifiedText(nodeToRender.text, className.trim());
              if (linkifiedSegments) {
                return (
                  <React.Fragment key={`${i}-${grandchildIndex}`}>
                    {linkifiedSegments}
                  </React.Fragment>
                );
              }

              return <span key={`${i}-${grandchildIndex}`} className={className || undefined}>{nodeToRender.text}</span>;
            }
            return null;
          })}
        </React.Fragment>
      );
    }
    return null;
  };

  // Use line settings (passed down) to determine current mode and whether line numbers are allowed
  const effectiveMode = isEditing
    ? LINE_MODES.NORMAL
    : (lineFeaturesEnabled ? (lineMode || LINE_MODES.NORMAL) : LINE_MODES.NORMAL);
  const shouldShowLineNumber = lineFeaturesEnabled && !!showLineNumbers;

  // Render paragraph with proper structure
  return (
    <div
      ref={paragraphRef}
      className={`unified-paragraph transition-all duration-300 ease-in-out ${
        canEdit ? 'cursor-text hover:bg-muted/30 active:bg-muted/50' : ''
      } ${
        isActive ? 'bg-[var(--active-line-highlight)]' : ''
      } ${
        isEditing ? 'editing-mode' : ''
      }`}
      style={{
        animationDelay: `${animationDelay}ms`
      }}
      data-paragraph-index={index}
      data-debug="paragraph-div"
      onClick={handleClick}
      onMouseEnter={() => canEdit && setLineHovered(true)}
      onMouseLeave={() => setLineHovered(false)}
      title={canEdit ? "Click to edit" : ""}
    >
      {/* Paragraph number - gated behind admin-only line feature flag */}
      {shouldShowLineNumber && (
        <span className="paragraph-number">
          {index + 1}
        </span>
      )}

      {/* Paragraph content */}
      <span className="unified-text-content">
        {node.children && node.children.map((child, i) => renderChild(child, i))}
      </span>

      {isActive && <span className="inline-block w-0.5 h-5 bg-primary animate-pulse ml-0.5"></span>}

      {/* Edit icon - positioned on the right side */}
      {canEdit && (
        <Edit2
          className={`h-4 w-4 text-muted-foreground absolute right-2 top-2 cursor-pointer transition-opacity duration-200 ${
            // When in edit mode: show all edit buttons prominently
            // When not in edit mode: Desktop shows on hover, Mobile shows permanently on first line only
            isEditing
              ? 'opacity-80 hover:opacity-100' // Always visible when editing
              : index === 0
                ? 'opacity-60 hover:opacity-100 md:opacity-0 md:group-hover:opacity-60 md:hover:opacity-100'
                : 'opacity-0 group-hover:opacity-60 hover:opacity-100 hidden md:block'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          title="Click to edit"
        />
      )}
    </div>
  );
};

// WeWrite only supports paragraph nodes, so we've removed CodeBlockNode, HeadingNode, and ListNode





export default TextView;
