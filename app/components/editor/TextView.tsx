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
import { nodeTypes } from "../../utils/constants";
import { PillLink } from "../utils/PillLink";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { getPageById } from "../../firebase/database";
import { LINE_MODES } from '../../contexts/LineSettingsContext';
import { motion, AnimatePresence, useScroll, useSpring, useInView, useTransform } from "framer-motion";
import { useAuth } from "../../providers/AuthProvider";
import { isExternalLink } from "../../utils/linkFormatters";
import { validateLink, getLinkDisplayText, extractPageIdFromUrl } from '../../utils/linkValidator';
import { Button } from "../ui/button";
import { usePillStyle } from "../../contexts/PillStyleContext";
import { ExternalLink, Edit2 } from "lucide-react";
import Modal from "../ui/modal";
import ExternalLinkPreviewModal from "../ui/ExternalLinkPreviewModal";
import { useControlledAnimation } from "../../hooks/useControlledAnimation";
import type { TextViewProps } from "../../types/components";
import type { SlateContent, SlateNode, SlateChild, ViewMode } from "../../types/database";
import "../paragraph-styles.css";
import "../diff-styles.css";

/**
 * TextView Component - Renders text content with different paragraph modes
 *
 * PARAGRAPH MODES REQUIREMENTS:
 *
 * 1. Normal Mode:
 *    - Paragraph numbers create indentation (like traditional documents)
 *    - Numbers positioned to the left of the text
 *    - Creates a clear indent for each paragraph
 *    - Standard text size (1rem/16px)
 *    - Proper spacing between paragraphs
 *
 * 2. Dense Mode:
 *    - Collapses all paragraphs for a more comfortable reading experience
 *    - NO line breaks between paragraphs
 *    - Text wraps continuously as if newline characters were temporarily deleted
 *    - Paragraph numbers are inserted inline within the continuous text
 *    - Standard text size (1rem/16px)
 *    - Only a small space separates one paragraph from the next
 *
 * IMPLEMENTATION NOTES:
 * - Both modes use the same paragraph number style (text-muted-foreground)
 * - Both modes use the same text size (1rem/16px)
 * - Dense mode is implemented directly in RenderContent for a truly continuous flow
 * - Normal mode uses ParagraphNode component with proper spacing and indentation
 * - Animations are applied to both modes for smooth transitions
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
  const [parsedContents, setParsedContents] = useState<SlateContent | null>(null);
  const [language, setLanguage] = useState<string | null>(null);

  // Get the full context to ensure we're subscribed to all updates
  const lineSettingsContext = useLineSettings();
  const { lineMode, setLineMode: contextSetLineMode } = lineSettingsContext;

  const [loadedParagraphs, setLoadedParagraphs] = useState<number[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [showEditTooltip, setShowEditTooltip] = useState<boolean>(false);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const { user } = useAuth();
  const { page } = usePage();

  // Debug: Check if context is working
  console.log('🔍 TextView: Full context:', lineSettingsContext);

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

  // Check if current user can view this page (public or owner)
  const canView = Boolean(
    page?.isPublic ||
    (user?.uid && page?.userId && user.uid === page.userId)
  );

  // Use lineMode from context as the primary mode
  const effectiveMode = lineMode || LINE_MODES.NORMAL;

  // Create a unique key that changes when lineMode changes to force complete re-render
  // This ensures the component properly updates when switching between dense and normal modes
  const renderKey = useMemo(() => `content-view-${effectiveMode}`, [effectiveMode]);

  // Force re-render when lineMode changes
  useEffect(() => {
    console.log('TextView: lineMode changed to:', lineMode);
    // Force a re-render by updating the loaded paragraphs
    if (parsedContents && Array.isArray(parsedContents)) {
      const paragraphCount = parsedContents.filter(node => node.type === nodeTypes.PARAGRAPH).length;
      setLoadedParagraphs(Array.from({ length: paragraphCount }, (_, i) => i));
    }
  }, [lineMode, parsedContents]);

  // Additional effect to force re-render when context changes
  useEffect(() => {
    console.log('TextView: Context changed, lineMode:', lineMode);
  }, [lineSettingsContext, lineMode]);

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
      console.log("TextView: Content is null or undefined, using empty content");
      setParsedContents([]);
      setLoadedParagraphs([]);
      setIsInitialLoad(true);
      return;
    }

    let contents;
    try {
      // CRITICAL FIX: Add more detailed logging to track content changes
      console.log("TextView: Content changed, parsing content", {
        contentType: typeof content,
        contentLength: content ? (typeof content === 'string' ? content.length : Array.isArray(content) ? content.length : 'unknown') : 0,
        contentSample: typeof content === 'string' ? content.substring(0, 50) + '...' : 'not a string',
        timestamp: new Date().toISOString()
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

    // CRITICAL FIX: Force a re-render to ensure the content is displayed
    window.requestAnimationFrame(() => {
      console.log("TextView: Forcing re-render after content update");

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
        node.type === nodeTypes.PARAGRAPH
      );

      // Get total number of nodes
      const totalNodes = paragraphNodes.length;

      // Log the total number of paragraphs for debugging
      console.log("TextView: Total paragraphs to load:", totalNodes);

      // Determine which mode we're in to set the appropriate delay
      const isInDenseMode = effectiveMode === LINE_MODES.DENSE;
      const loadingDelay = isInDenseMode
        ? ANIMATION_CONSTANTS.DENSE_PARAGRAPH_LOADING_DELAY
        : ANIMATION_CONSTANTS.PARAGRAPH_LOADING_DELAY;

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

  // Use the same CSS class structure as the Editor component for consistency
  const getViewModeStyles = useMemo(() => {
    // CRITICAL: Use the same class structure as Editor component with smooth transitions
    return `prose prose-lg max-w-none editor-content page-editor-stable box-border mode-transition ${effectiveMode === LINE_MODES.DENSE ? 'dense-mode' : 'normal-mode'}`;
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

    return (
      <div
        key={`textview-${effectiveMode}`}
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
            <div className="p-6 text-muted-foreground">No content available</div>
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

export const RenderContent = ({ contents, loadedParagraphs, effectiveMode, canEdit = false, activeLineIndex = null, onActiveLine = null, showDiff = false, clickPosition = null, isEditing = false }) => {
  // Wrap in try-catch to handle any rendering errors
  try {
    if (!contents) return null;

    if (Array.isArray(contents)) {
      // For dense mode, render as continuous text with inline paragraph numbers
      if (effectiveMode === LINE_MODES.DENSE) {
        return (
          <div className="dense-content-wrapper mode-transition">
            {contents.map((node, index) => {
              if (!loadedParagraphs.includes(index)) return null;
              if (node.type !== nodeTypes.PARAGRAPH) return null;

              return (
                <Fragment key={index}>
                  <span className="dense-paragraph-number">
                    {index + 1}
                  </span>
                  <span
                    className="dense-paragraph-content"
                    onClick={() => canEdit && onActiveLine && onActiveLine(index)}
                    style={{ cursor: canEdit ? 'text' : 'default' }}
                  >
                    {node.children && node.children.map((child, i) => {
                      if (child.type === 'link') {
                        return <LinkNode key={i} node={child} canEdit={canEdit} isEditing={isEditing} />;
                      } else if (child.text) {
                        return <span key={i}>{child.text}</span>;
                      }
                      return null;
                    })}
                  </span>
                  {index < contents.length - 1 && <span className="dense-paragraph-separator"> </span>}
                </Fragment>
              );
            })}
          </div>
        );
      }

      // For normal mode, render as separate paragraph blocks
      return (
        <>
          {contents.map((node, index) => {
            if (!loadedParagraphs.includes(index)) return null;
            if (node.type !== nodeTypes.PARAGRAPH) return null;

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
const SimpleParagraphNode = ({ node, index = 0, canEdit = false, isActive = false, onActiveLine = null, showDiff = false, isEditing = false }) => {
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
    // Handle link nodes with error handling
    if (child.type === 'link') {
      try {
        console.log('PARAGRAPH_LINK_DEBUG: Rendering link in paragraph:', JSON.stringify(child));
        return <LinkNode key={i} node={child} canEdit={canEdit} isEditing={isEditing} />;
      } catch (error) {
        console.error('PARAGRAPH_LINK_ERROR: Error rendering link in paragraph:', error);
        return <span key={i} className="text-red-500">[Link Error]</span>;
      }
    }
    // Handle text nodes
    else if (child.text) {
      let className = '';
      if (child.bold) className += ' font-bold';
      if (child.italic) className += ' italic';
      if (child.underline) className += ' underline';

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
            if (grandchild.type === 'link') {
              return <LinkNode key={`${i}-${grandchildIndex}`} node={grandchild} canEdit={canEdit} isEditing={isEditing} />;
            } else if (grandchild.text) {
              let className = '';
              if (grandchild.bold) className += ' font-bold';
              if (grandchild.italic) className += ' italic';
              if (grandchild.underline) className += ' underline';

              return <span key={`${i}-${grandchildIndex}`} className={className || undefined}>{grandchild.text}</span>;
            }
            return null;
          })}
        </React.Fragment>
      );
    }
    return null;
  };

  // Use LineSettings context to determine current mode
  const { lineMode } = useLineSettings();
  const effectiveMode = lineMode || LINE_MODES.NORMAL;

  // Render paragraph with proper structure for both normal and dense modes
  return (
    <div
      ref={paragraphRef}
      className={`unified-paragraph transition-all duration-300 ease-in-out ${
        effectiveMode === LINE_MODES.DENSE ? 'dense-mode' : ''
      } ${
        canEdit ? 'cursor-text hover:bg-muted/30 active:bg-muted/50' : ''
      } ${
        isActive ? 'bg-[var(--active-line-highlight)]' : ''
      } ${
        isEditing ? 'editing-mode' : ''
      }`}
      data-paragraph-index={index}
      data-debug="paragraph-div"
      onClick={handleClick}
      onMouseEnter={() => canEdit && setLineHovered(true)}
      onMouseLeave={() => setLineHovered(false)}
      title={canEdit ? "Click to edit" : ""}
    >
      {/* Paragraph number - only in normal mode (dense mode handled in RenderContent) */}
      {effectiveMode === LINE_MODES.NORMAL && (
        <span className="unified-paragraph-number">
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

const LinkNode = ({ node, canEdit = false, isEditing = false }) => {
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);
  const [linkNode, setLinkNode] = useState(node);

  // Listen for page title updates
  useEffect(() => {
    const handleTitleUpdate = (event: CustomEvent) => {
      const { pageId, newTitle } = event.detail;

      // Check if this link references the updated page
      if (linkNode.pageId === pageId && shouldUpdateLink(linkNode)) {
        console.log(`🔗 TextView: Updating link title in real-time: ${linkNode.pageTitle} -> ${newTitle}`);

        setLinkNode(prevNode => ({
          ...prevNode,
          pageTitle: newTitle,
          originalPageTitle: newTitle,
          displayText: newTitle,
          children: prevNode.children?.map(child =>
            child.text === prevNode.pageTitle || child.text === prevNode.originalPageTitle
              ? { ...child, text: newTitle }
              : child
          ) || [{ text: newTitle }]
        }));
      }
    };

    window.addEventListener('page-title-updated', handleTitleUpdate as EventListener);

    return () => {
      window.removeEventListener('page-title-updated', handleTitleUpdate as EventListener);
    };
  }, [linkNode]);

  // Helper function to determine if link should be updated
  const shouldUpdateLink = (node: any): boolean => {
    // Don't update if custom text differs from original page title
    if (node.displayText &&
        node.originalPageTitle &&
        node.displayText !== node.originalPageTitle) {
      return false;
    }
    return true;
  };

  // Add more robust error handling for invalid link nodes
  if (!linkNode || typeof linkNode !== 'object') {
    console.error('LINK_RENDER_ERROR: Invalid link node:', linkNode);
    return <span className="text-red-500">[Invalid Link]</span>;
  }

  // Debug log to help diagnose link rendering issues
  console.log('LINK_RENDER_DEBUG: Rendering link node:', JSON.stringify(linkNode));

  // MAJOR FIX: Completely rewritten link validation for view mode
  // This ensures links created with any version of the editor will render correctly
  let validatedNode;
  try {
    // First try to validate the node directly
    validatedNode = validateLink(linkNode);

    // If validation failed or returned null, try to extract a link object from the node
    if (!validatedNode && linkNode.children) {
      // Look for link objects in children
      for (const child of linkNode.children) {
        if (child && child.type === 'link') {
          console.log('LINK_RENDER_DEBUG: Found link in children, extracting:', JSON.stringify(child));
          validatedNode = validateLink(child);
          if (validatedNode) break;
        }
      }
    }

    // If we still don't have a valid node but have a URL, create a minimal valid link
    if (!validatedNode && linkNode.url) {
      console.log('LINK_RENDER_DEBUG: Creating minimal valid link from URL:', linkNode.url);
      validatedNode = validateLink({
        type: 'link',
        url: linkNode.url,
        children: [{ text: linkNode.displayText || linkNode.children?.[0]?.text || linkNode.url }],
        id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });
    }

    // If still no valid node, check if this is a nested structure
    if (!validatedNode && linkNode.link && typeof linkNode.link === 'object') {
      console.log('LINK_RENDER_DEBUG: Found nested link object, extracting:', JSON.stringify(linkNode.link));
      validatedNode = validateLink(linkNode.link);
    }

    // Check for data property that might contain link information
    if (!validatedNode && linkNode.data && typeof linkNode.data === 'object') {
      if (linkNode.data.url || linkNode.data.href || linkNode.data.pageId) {
        console.log('LINK_RENDER_DEBUG: Found link data in data property:', JSON.stringify(linkNode.data));
        validatedNode = validateLink({
          ...linkNode.data,
          type: 'link',
          children: [{ text: linkNode.data.displayText || linkNode.data.text || 'Link' }],
          id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
      }
    }

    console.log('LINK_RENDER_DEBUG: After validation:', JSON.stringify(validatedNode));

    // If still no valid node, create a fallback
    if (!validatedNode) {
      // Create a minimal valid link as fallback with a unique ID
      validatedNode = {
        type: 'link',
        url: linkNode.url || '#',
        children: [{ text: linkNode.displayText || linkNode.children?.[0]?.text || 'Link (Error)' }],
        displayText: linkNode.displayText || linkNode.children?.[0]?.text || 'Link (Error)',
        className: 'error-link',
        isError: true,
        id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
    }

    // CRITICAL FIX: Ensure the validated node has a unique ID
    if (!validatedNode.id) {
      validatedNode.id = `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // CRITICAL FIX: Ensure the validated node has proper children structure
    if (!validatedNode.children || !Array.isArray(validatedNode.children) || validatedNode.children.length === 0) {
      validatedNode.children = [{ text: validatedNode.displayText || 'Link' }];
    }
  } catch (error) {
    console.error('LINK_RENDER_ERROR: Error during link validation:', error);
    // Create a minimal valid link as fallback with a unique ID
    validatedNode = {
      type: 'link',
      url: linkNode.url || '#',
      children: [{ text: linkNode.displayText || linkNode.children?.[0]?.text || 'Link (Error)' }],
      displayText: linkNode.displayText || linkNode.children?.[0]?.text || 'Link (Error)',
      className: 'error-link',
      isError: true,
      id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  // If validation failed or returned null, show an error
  if (!validatedNode) {
    console.error('LINK_RENDER_ERROR: Link validation failed for node:', linkNode);
    return <span className="text-red-500">[Invalid Link]</span>;
  }

  // Extract properties from the validated node
  const href = validatedNode.url || '#';
  const pageId = validatedNode.pageId;
  const isExternal = validatedNode.isExternal === true;
  const isPageLink = validatedNode.isPageLink === true;

  // Determine if this is a protocol link
  const isProtocolLink =
    validatedNode.className?.includes('protocol-link') ||
    validatedNode.isProtocolLink === true ||
    (validatedNode.children?.[0]?.text === "WeWrite as a decentralized open protocol");

  // IMPROVED: Extract display text with better fallbacks and proper custom text handling
  const getTextFromNode = (node) => {
    // NOTE: Compound links are now handled separately in the rendering logic,
    // so this function only extracts the base text without compound formatting

    // CRITICAL FIX: Properly extract custom text from children array first
    // This is the most important source of custom text that users configure
    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      // Concatenate all text from children to handle custom text properly
      let customText = '';
      for (const child of node.children) {
        if (child && child.text) {
          customText += child.text;
        }
      }
      // If we found custom text and it's not just the default "Link", use it
      if (customText.trim() && customText !== 'Link' && customText !== 'Page Link') {
        return customText.trim();
      }
    }

    // 2. Check for explicit displayText property (backup for custom text)
    if (node.displayText && node.displayText !== 'Link' && node.displayText.trim()) {
      console.log('CUSTOM_TEXT_DEBUG: Found displayText:', node.displayText);
      return node.displayText;
    }

    // 3. Check for pageTitle (for page links without custom text)
    if (node.pageTitle && node.pageTitle !== 'Link') {
      return node.pageTitle;
    }

    // 4. Check for originalPageTitle
    if (node.originalPageTitle && node.originalPageTitle !== 'Link') {
      return node.originalPageTitle;
    }

    // 5. Use the standardized utility function as fallback
    const utilityText = getLinkDisplayText(node);
    if (utilityText && utilityText !== 'Link') {
      return utilityText;
    }

    // 6. Check for text in data property
    if (node.data && typeof node.data === 'object') {
      if (node.data.text && node.data.text.trim()) return node.data.text;
      if (node.data.displayText && node.data.displayText.trim()) return node.data.displayText;
    }

    // 7. Use appropriate fallbacks based on link type
    if (isExternal && href) return href;
    if (pageId) return pageId.replace(/-/g, ' ');

    // Last resort fallback
    return null; // Return null so we can handle it explicitly
  };

  // Get display text with improved extraction
  let displayText = getTextFromNode(validatedNode);

  // If displayText is still empty or null, use appropriate fallbacks
  if (!displayText) {
    if (pageId) {
      displayText = validatedNode.pageTitle || validatedNode.originalPageTitle || `Page: ${pageId}`;
    } else if (isExternal) {
      displayText = href;
    } else {
      displayText = 'Link';
    }
  }

  // For protocol links, use a special component - no tooltip in view mode
  if (isProtocolLink) {
    return (
      <span className="inline-block">
        <PillLink
          href="/protocol"
          isPublic={true}
          className="protocol-link"
        >
          {displayText || "WeWrite Protocol"}
        </PillLink>
      </span>
    );
  }

  // For internal page links, check if it's a compound link first
  if (pageId) {
    console.log('RENDERING_PAGE_LINK:', { pageId, displayText, validatedNode });

    // CRITICAL FIX: Extract original page title from multiple possible sources
    const originalPageTitle = validatedNode.pageTitle ||
                              validatedNode.originalPageTitle ||
                              validatedNode.data?.pageTitle ||
                              validatedNode.data?.originalPageTitle ||
                              null;

    // Check if this is a compound link with author attribution
    if (validatedNode.showAuthor && validatedNode.authorUsername) {
      // Render compound link as two separate pills: [Page Title] by [Author Username]

      // Use the extracted displayText which already handles custom text properly
      let pageTitleText = displayText || originalPageTitle || 'Page';

      // Remove @ symbol from username if present
      const cleanUsername = validatedNode.authorUsername.replace(/^@/, '');

      // Ensure href is properly formatted for internal links
      const formattedHref = href.startsWith('/') ? href : `/pages/${pageId}`;

      // Use PillStyleContext for consistent styling between edit and view modes
      const { getPillStyleClasses } = usePillStyle();
      const pillStyles = getPillStyleClasses();

      // Handle edit mode vs view mode click behavior
      if (canEdit && isEditing) {
        // In edit mode, clicking should open the link editor
        // Use the same pill styling as view mode for consistency
        return (
          <span className="inline-flex items-center gap-1 compound-link-container">
            {/* Page title portion - clickable for editing */}
            <span className="inline-block">
              <span
                className={`${pillStyles} cursor-pointer page-link page-portion`}
                data-page-id={pageId}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // TODO: Open link editor for this link
                  console.log('Edit mode: Open link editor for compound link');
                }}
              >
                <span className="pill-text">{pageTitleText}</span>
              </span>
            </span>

            {/* "by" text */}
            <span className="text-muted-foreground text-sm">by</span>

            {/* Author username portion - clickable for editing */}
            <span className="inline-block">
              <span
                className={`${pillStyles} cursor-pointer user-link author-portion`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // TODO: Open link editor for this link
                  console.log('Edit mode: Open link editor for compound link');
                }}
              >
                <span className="pill-text">{cleanUsername}</span>
              </span>
            </span>
          </span>
        );
      } else {
        // In view mode, normal navigation behavior
        return (
          <span className="inline-flex items-center gap-1 compound-link-container">
            {/* Page title portion - clickable pill */}
            <span className="inline-block">
              <PillLink
                href={formattedHref}
                isPublic={true}
                className="inline page-link page-portion"
                data-page-id={pageId}
              >
                {pageTitleText}
              </PillLink>
            </span>

            {/* "by" text */}
            <span className="text-muted-foreground text-sm">by</span>

            {/* Author username portion - clickable pill */}
            <span className="inline-block">
              <PillLink
                href={`/user/${cleanUsername}`}
                isPublic={true}
                className="inline user-link author-portion"
              >
                {cleanUsername}
              </PillLink>
            </span>
          </span>
        );
      }
    }

    // Regular single page link (non-compound)
    // Ensure href is properly formatted for internal links
    const formattedHref = href.startsWith('/') ? href : `/pages/${pageId}`;

    // Ensure we have a valid display text for page links
    let finalDisplayText = displayText;
    if (!finalDisplayText) {
      finalDisplayText = originalPageTitle || `TEST PAGE LINK: ${pageId}`;
    }

    return (
      <span className="inline-block">
        <InternalLinkWithTitle
          pageId={pageId}
          href={formattedHref}
          displayText={finalDisplayText}
          originalPageTitle={originalPageTitle}
          showAuthor={false}
          authorUsername={null}
          canEdit={canEdit}
          isEditing={isEditing}
        />
      </span>
    );
  }

  // For external links, use the PillLink component with a modal confirmation
  if (isExternal) {
    // Ensure we have a valid display text for external links
    let finalDisplayText = displayText;

    // Double-check for text in children as a fallback
    if (!finalDisplayText && validatedNode.children && validatedNode.children.length > 0 && validatedNode.children[0].text) {
      finalDisplayText = validatedNode.children[0].text;
    }

    // If still no text, use the URL as a last resort
    if (!finalDisplayText) {
      finalDisplayText = href;
    }

    // Handle edit mode vs view mode click behavior
    if (canEdit && isEditing) {
      // In edit mode, clicking should open the link editor
      return (
        <span
          className="inline-block cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // TODO: Open link editor for this link
            console.log('Edit mode: Open link editor for external link');
          }}
        >
          <span className="inline-flex items-center px-2 py-1 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/80 transition-colors">
            {finalDisplayText}
            <ExternalLink className="ml-1 h-3 w-3" />
          </span>
        </span>
      );
    } else {
      // In view mode, normal external link behavior with modal
      const handleExternalLinkClick = (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent event bubbling to prevent edit mode activation
        setShowExternalLinkModal(true);
      };

      return (
        <>
          <span className="inline-block">
            <PillLink
              href={href}
              isPublic={true}
              className="external-link"
              onClick={handleExternalLinkClick}
            >
              {finalDisplayText}
              {/* Removed duplicate ExternalLink icon - PillLink already adds it */}
            </PillLink>
          </span>

          <ExternalLinkPreviewModal
            isOpen={showExternalLinkModal}
            onClose={() => setShowExternalLinkModal(false)}
            url={href}
            displayText={finalDisplayText}
          />
        </>
      );
    }
  }

  // For other links (like special links), use the PillLink component
  // If displayText is empty or undefined, try to get text from children
  if (!displayText && validatedNode.children && Array.isArray(validatedNode.children)) {
    // Try to find any child with text
    for (const child of validatedNode.children) {
      if (child.text) {
        displayText = child.text;
        break;
      }
    }
  }

  // If still no text, use a generic fallback
  if (!displayText) {
    displayText = "Link";
  }

  // Use PillStyleContext for consistent styling between edit and view modes
  const { getPillStyleClasses } = usePillStyle();
  const pillStyles = getPillStyleClasses();

  // Handle edit mode vs view mode click behavior for other links
  if (canEdit && isEditing) {
    // In edit mode, clicking should open the link editor
    // Use the same pill styling as view mode for consistency
    return (
      <span className="inline-block">
        <span
          className={`${pillStyles} cursor-pointer special-link`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // TODO: Open link editor for this link
            console.log('Edit mode: Open link editor for special link');
          }}
        >
          <span className="pill-text">{displayText}</span>
        </span>
      </span>
    );
  } else {
    // In view mode, normal navigation behavior
    return (
      <span className="inline-block">
        <PillLink
          href={href}
          isPublic={true}
          className="inline special-link"
        >
          {displayText}
        </PillLink>
      </span>
    );
  }
};

// Component for internal links that fetches and displays page titles
const InternalLinkWithTitle = ({ pageId, href, displayText, originalPageTitle, showAuthor, authorUsername, canEdit = false, isEditing = false }) => {
  const [currentTitle, setCurrentTitle] = useState(null);
  const [isLoading, setIsLoading] = useState(false); // Start with false, only set to true when actually fetching
  const [fetchError, setFetchError] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Ensure href is properly formatted
  const formattedHref = useMemo(() => {
    // If we have a valid pageId, always use that to create a consistent href
    if (pageId) {
      return `/pages/${pageId}`;
    }

    // Fallback handling if no valid pageId
    if (!href || href === '#') {
      return '#';
    }

    // If href doesn't start with /, add it
    if (href && !href.startsWith('/')) {
      return `/${href}`;
    }

    return href;
  }, [href, pageId]);

  useEffect(() => {
    // Reset states when pageId changes
    setFetchError(false);
    setCurrentTitle(null);

    const fetchTitle = async () => {
      try {
        if (!pageId) {
          setFetchError(true);
          setIsLoading(false);
          return;
        }

        // Only show loading if we don't have originalPageTitle
        if (!originalPageTitle) {
          setIsLoading(true);
        }

        // Check cache first to avoid unnecessary API calls
        const pageTitle = await getPageTitle(pageId);

        if (isMounted) {
          setCurrentTitle(pageTitle);
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setFetchError(true);
          setIsLoading(false);
        }
      }
    };

    // Only fetch if we don't have originalPageTitle or if we want to update the cache
    // But prioritize showing originalPageTitle immediately
    if (pageId) {
      fetchTitle();
    }
  }, [pageId, isMounted, originalPageTitle]);

  // Determine what text to display using a clear priority system
  let textToDisplay;

  // CRITICAL FIX: Always prioritize displayText if it exists and is not empty
  // The displayText comes from the link's children and represents what the user actually typed
  if (displayText && displayText.trim() && displayText !== 'Link' && displayText !== 'Page Link') {
    textToDisplay = displayText;
  }
  // If we have a currentTitle from the database (updated page title), use it
  else if (currentTitle && currentTitle.trim()) {
    textToDisplay = currentTitle;
  }
  // If originalPageTitle is available, use it (original page title)
  else if (originalPageTitle && originalPageTitle.trim()) {
    textToDisplay = originalPageTitle;
  }
  // If we're loading and have no other text, show a loading indicator
  else if (isLoading) {
    textToDisplay = (
      <>
        <span className="inline-block w-3 h-3 border-2 border-t-transparent border-primary rounded-full animate-spin mr-1"></span>
        <span className="text-xs">Loading</span>
      </>
    );
  }
  // If there was an error or we have no other text, use a fallback
  else {
    const fallbackText = fetchError ? 'Page Link (Error)' : (pageId ? `Page: ${pageId}` : 'Page Link');
    textToDisplay = fallbackText;
  }

  // Use PillStyleContext for consistent styling between edit and view modes
  const { getPillStyleClasses } = usePillStyle();
  const pillStyles = getPillStyleClasses();

  // Handle edit mode vs view mode click behavior
  if (canEdit && isEditing) {
    // In edit mode, clicking should open the link editor
    // Use the same pill styling as view mode for consistency
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <span
                className={`${pillStyles} cursor-pointer page-link`}
                data-page-id={pageId}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // TODO: Open link editor for this link
                  console.log('Edit mode: Open link editor for single link');
                }}
              >
                <span className="pill-text">{textToDisplay}</span>
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Click to edit link: {currentTitle || originalPageTitle || displayText || 'Page Link'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  } else {
    // In view mode, normal navigation behavior - no tooltip
    return (
      <span className="inline-block">
        <PillLink
          href={formattedHref}
          isPublic={true}
          className="inline page-link"
          data-page-id={pageId}
        >
          {textToDisplay}
        </PillLink>
      </span>
    );
  }
};

export default TextView;
