import React, { useState, useEffect, useCallback, useRef, useContext, useMemo } from "react";
import { usePage } from "../../contexts/PageContext";
import { useLineSettings } from "../../contexts/LineSettingsContext";
import { nodeTypes } from "../utils/constants";
import { PillLink } from "../utils/PillLink";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { getPageById } from "../../firebase/database";
import { LineSettingsProvider, LINE_MODES } from '../../contexts/LineSettingsContext';
import { motion, AnimatePresence, useScroll, useSpring, useInView, useTransform } from "framer-motion";
import { AuthContext } from "../../providers/AuthProvider";
import { isExternalLink } from "../utils/linkFormatters";
import { validateLink, getLinkDisplayText, extractPageIdFromUrl } from '../utils/linkValidator';
import { Button } from "../ui/button";
import { ExternalLink, Edit } from "lucide-react";
import Modal from "../ui/modal";
import { useControlledAnimation } from "../../hooks/useControlledAnimation";
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
const pageTitleCache = new Map();

// Animation constants for consistent behavior across modes
const ANIMATION_CONSTANTS = {
  PARAGRAPH_LOADING_DELAY: 30, // ms between each paragraph appearance in normal mode
  DENSE_PARAGRAPH_LOADING_DELAY: 15, // ms between each paragraph appearance in dense mode (faster)
  SPRING_STIFFNESS: 500,
  SPRING_DAMPING: 30,
  SPRING_MASS: 1
};

// Function to extract page ID from URL
// CRITICAL FIX: Use the standardized utility function from linkValidator.js
const extractPageId = (url) => {
  return extractPageIdFromUrl(url);
};

// Function to get page title from ID
const getPageTitle = async (pageId) => {
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

const TextView = ({ content, isSearch = false, viewMode = 'normal', onRenderComplete, setIsEditing, showDiff = false, canEdit: propCanEdit }) => {
  const [parsedContents, setParsedContents] = useState(null);
  const [language, setLanguage] = useState(null);
  const { lineMode } = useLineSettings();
  const [loadedParagraphs, setLoadedParagraphs] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState(null);
  const [isHovering, setIsHovering] = useState(false);
  const [clickPosition, setClickPosition] = useState(null);
  const { user } = useContext(AuthContext);
  const { page } = usePage();

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
  // We no longer need this for re-rendering since we'll handle mode changes directly
  const renderKey = useMemo(() => 'content-view', []);

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

  const getViewModeStyles = () => {
    // Use the effective mode for styling
    if (effectiveMode === LINE_MODES.DENSE) {
      return 'space-y-0 dense-mode'; // No spacing between paragraphs for dense mode
    } else {
      return 'space-y-0 normal-mode'; // Normal mode with inline paragraph numbers
    }
  };

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
    if (!canEdit || !setIsEditing) return;

    // Don't trigger edit mode if clicking on interactive elements
    const target = event.target;
    const isInteractiveElement = target.closest('a, button, [role="button"], .no-edit-trigger');

    if (isInteractiveElement) {
      return;
    }

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
      <div className="relative">
        <div
          className={`flex flex-col ${getViewModeStyles()} w-full text-left ${
            isScrolled ? 'pb-16' : ''
          } ${
            canEdit ? 'relative cursor-text' : ''
          } min-h-screen ${
            canEdit && isHovering ? 'bg-muted/20' : ''
          } transition-colors duration-150`}
          onClick={handleContentClick}
          onMouseEnter={() => canEdit && setIsHovering(true)}
          onMouseLeave={() => canEdit && setIsHovering(false)}
          title={canEdit ? "Click to edit" : ""}
        >
          {canEdit && (
            <div className={`absolute top-3 right-3 transition-opacity duration-200 ${
              isHovering ? 'opacity-70' : 'opacity-0'
            }`}>
              <Edit className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          {!parsedContents && !isSearch && (
            <div className="p-6 text-muted-foreground">No content available</div>
          )}

          {parsedContents && (
            <RenderContent
              key={renderKey}
              contents={parsedContents}
              language={language}
              loadedParagraphs={loadedParagraphs}
              effectiveMode={effectiveMode}
              canEdit={canEdit}
              activeLineIndex={activeLineIndex}
              onActiveLine={handleActiveLine}
              showDiff={showDiff}
              clickPosition={clickPosition}
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

export const RenderContent = ({ contents, loadedParagraphs, effectiveMode, canEdit = false, activeLineIndex = null, onActiveLine = null, showDiff = false, clickPosition = null }) => {
  // Wrap in try-catch to handle any rendering errors
  try {
    // Additional safety checks for browser compatibility
    if (typeof window !== 'undefined') {
      // Ensure required browser APIs are available
      if (!window.requestAnimationFrame) {
        console.warn('RenderContent: requestAnimationFrame not available, animations may not work');
      }
    }

    // Use the line mode settings
    const { lineMode } = useLineSettings();

    // Always use the latest lineMode from context to ensure immediate updates
    // Fall back to effectiveMode only if lineMode is not available
    const mode = lineMode || effectiveMode || LINE_MODES.NORMAL;

    if (!contents) return null;

  /**
   * DENSE MODE IMPLEMENTATION
   *
   * Bible verse style with continuous text flow:
   * - NO line breaks between paragraphs
   * - Text wraps continuously as if newline characters were temporarily deleted
   * - Paragraph numbers are inserted inline within the continuous text
   * - Standard text size (1rem/16px)
   * - Only a small space separates one paragraph from the next
   * - Progressive loading animations with shorter delays than normal mode
   */
  if (mode === LINE_MODES.DENSE) {
    // For array of nodes (multiple paragraphs)
    if (Array.isArray(contents)) {
      return (
        <div className="relative min-h-screen">
          <div className="prose max-w-full">
            <p className="text-foreground leading-normal text-base">
              {contents.map((node, index) => {
                if (!loadedParagraphs.includes(index)) return null;

                // Only process paragraph nodes
                if (node.type !== nodeTypes.PARAGRAPH) return null;

                // Calculate animation delay for dense mode
                const animationDelay = ANIMATION_CONSTANTS.DENSE_PARAGRAPH_LOADING_DELAY / 1000 * index; // Convert ms to seconds for framer-motion

                return (
                  <motion.span
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: ANIMATION_CONSTANTS.SPRING_STIFFNESS,
                      damping: ANIMATION_CONSTANTS.SPRING_DAMPING,
                      mass: ANIMATION_CONSTANTS.SPRING_MASS,
                      delay: animationDelay // Use dense mode delay
                    }}
                  >
                    {/* Only add a space if this isn't the first paragraph */}
                    {index > 0 && ' '}

                    {/* Paragraph number - FIXED: Ensure correct paragraph numbering */}
                    <span
                      className="paragraph-number text-xs ml-1 select-none"
                      style={{
                        verticalAlign: 'top',
                        position: 'relative',
                        top: '0.5em'
                      }}
                      aria-hidden="true"
                      data-paragraph-index={index + 1}
                    >
                      {index + 1}
                    </span>{'\u00A0'}

                    {/* Paragraph content without any breaks */}
                    {node.children && node.children.map((child, childIndex) => {

                      // IMPROVED: More robust link handling in dense mode
                      if (child.type === 'link') {
                        console.log('LINK_DEBUG: Found link in dense mode:', JSON.stringify(child));
                        try {
                          return <LinkNode key={childIndex} node={child} />;
                        } catch (error) {
                          console.error('LINK_RENDER_ERROR: Error rendering link in dense mode:', error);
                          return <span key={childIndex} className="text-red-500">[Link Error]</span>;
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
                            <code key={childIndex} className="px-1.5 py-0.5 mx-0.5 rounded bg-muted font-mono">
                              {child.text}
                            </code>
                          );
                        }

                        return (
                          <span key={childIndex} className={className || undefined}>
                            {child.text}
                          </span>
                        );
                      }
                      // IMPROVED: Handle other node types that might contain links
                      else if (child.children && Array.isArray(child.children)) {
                        console.log('LINK_DEBUG: Found node with children in dense mode:', JSON.stringify(child));



                        return (
                          <React.Fragment key={childIndex}>
                            {child.children.map((grandchild, grandchildIndex) => {


                              if (grandchild.type === 'link') {
                                try {
                                  return <LinkNode key={`${childIndex}-${grandchildIndex}`} node={grandchild} />;
                                } catch (error) {
                                  console.error('LINK_RENDER_ERROR: Error rendering link in grandchild:', error);
                                  return <span key={`${childIndex}-${grandchildIndex}`} className="text-red-500">[Link Error]</span>;
                                }
                              } else if (grandchild.text) {
                                return <span key={`${childIndex}-${grandchildIndex}`}>{grandchild.text}</span>;
                              }
                              return null;
                            })}
                          </React.Fragment>
                        );
                      }
                      return null;
                    })}
                  </motion.span>
                );
              })}
            </p>
          </div>
        </div>
      );
    }
  }

  /**
   * NORMAL MODE IMPLEMENTATION
   *
   * Traditional document style:
   * - Paragraph numbers create indentation
   * - Numbers positioned to the left of the text
   * - Clear indent for each paragraph
   * - Standard text size (1rem/16px)
   * - Proper spacing between paragraphs
   */
  // If it's an array, map through and render each node
  if (Array.isArray(contents)) {
    return (
      <div className="w-full text-left min-h-screen">
        {contents.map((node, index) => (
          <React.Fragment key={index}>
            {loadedParagraphs.includes(index) && renderNode(node, mode, index, canEdit, activeLineIndex, onActiveLine, showDiff)}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // If it's a single node, render it directly
  return renderNode(contents, mode, 0, canEdit, activeLineIndex, onActiveLine, showDiff);

  } catch (error) {
    console.error('Error rendering content:', error);
    console.error('RenderContent error details:', {
      contentType: typeof contents,
      isArray: Array.isArray(contents),
      contentLength: Array.isArray(contents) ? contents.length : 0,
      errorMessage: error.message,
      errorStack: error.stack
    });

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

// Render content based on node type
const renderNode = (node, mode, index, canEdit = false, activeLineIndex = null, onActiveLine = null, showDiff = false) => {
  if (!node) return null;

  // Add special debugging for paragraph 2 (index 1)
  if (index === 1) {
    console.log(`PARAGRAPH_DEBUG: Rendering paragraph 2 (index ${index}):`, JSON.stringify(node));

    // Check if this paragraph has any link children
    if (node.children) {
      node.children.forEach((child, childIndex) => {
        if (child.type === 'link') {
          console.log(`PARAGRAPH_DEBUG: Found link in paragraph 2 at child index ${childIndex}:`, JSON.stringify(child));
        }
      });
    }
  }

  // Only use ParagraphNode for normal mode
  if (mode === LINE_MODES.NORMAL) {
    // WeWrite only supports paragraph nodes
    if (node.type === nodeTypes.PARAGRAPH) {
      return (
        <ParagraphNode
          key={index}
          node={node}
          index={index}
          canEdit={canEdit}
          isActive={activeLineIndex === index}
          onActiveLine={onActiveLine}
          showDiff={showDiff}
        />
      );
    }
  }

  // For any other modes, we'll handle them in RenderContent directly
  return null;
};

/**
 * ParagraphNode - Renders a paragraph in NORMAL mode
 *
 * Features:
 * - Paragraph numbers create indentation (traditional document style)
 * - Numbers positioned to the left of the text
 * - Clear indent for each paragraph
 * - Standard text size (1rem/16px)
 * - Proper spacing between paragraphs
 */
const ParagraphNode = ({ node, index = 0, canEdit = false, isActive = false, onActiveLine = null, showDiff = false }) => {
  const { lineMode } = useLineSettings();
  const paragraphRef = useRef(null);
  const [lineHovered, setLineHovered] = useState(false);

  // Define consistent text size for all modes
  const TEXT_SIZE = "text-base"; // 1rem (16px) for all modes

  // Use reduced vertical padding for normal mode (approximately 15-20% less)
  const spacingClass = 'py-2';

  // Handle click to edit
  const handleClick = () => {
    if (canEdit && onActiveLine) {
      onActiveLine(index);
    }
  };

  // Helper function to render child nodes
  const renderChild = (child, i) => {
    // Handle link nodes with error handling
    if (child.type === 'link') {
      try {
        console.log('PARAGRAPH_LINK_DEBUG: Rendering link in paragraph:', JSON.stringify(child));
        return <LinkNode key={i} node={child} />;
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
              return <LinkNode key={`${i}-${grandchildIndex}`} node={grandchild} />;
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

  // WYSIWYG mode - consistent with edit mode styling
  return (
    <motion.div
      ref={paragraphRef}
      id={`paragraph-${index + 1}`}
      className={`group relative ${canEdit ? 'cursor-text hover:bg-muted/30 active:bg-muted/50 transition-colors duration-150' : ''} ${isActive ? 'bg-[var(--active-line-highlight)]' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.2,
        ease: "easeOut"
      }}
      onClick={handleClick}
      onMouseEnter={() => canEdit && setLineHovered(true)}
      onMouseLeave={() => setLineHovered(false)}
      title={canEdit ? "Click to edit" : ""}
    >
      {/* Paragraph with inline number at beginning */}
      <div className="paragraph-with-number py-2.5 flex">
        {/* Paragraph number - fixed width for consistent alignment */}
        <span
          className="paragraph-number-inline select-none flex-shrink-0"
          data-paragraph-index={index + 1}
          aria-hidden="true"
        >{index + 1}</span>

        {/* Paragraph content with proper text wrapping */}
        <p className={`flex-grow text-left text-base leading-normal break-words ${lineHovered && !isActive ? 'bg-muted/30' : ''} ${canEdit ? 'relative' : ''}`}>
          {node.children && node.children.map((child, i) => renderChild(child, i))}
          {isActive && <span className="inline-block w-0.5 h-5 bg-primary animate-pulse ml-0.5"></span>}
        </p>
      </div>
    </motion.div>
  );
};

// WeWrite only supports paragraph nodes, so we've removed CodeBlockNode, HeadingNode, and ListNode

const LinkNode = ({ node }) => {
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);

  // Add more robust error handling for invalid link nodes
  if (!node || typeof node !== 'object') {
    console.error('LINK_RENDER_ERROR: Invalid link node:', node);
    return <span className="text-red-500">[Invalid Link]</span>;
  }

  // Debug log to help diagnose link rendering issues
  console.log('LINK_RENDER_DEBUG: Rendering link node:', JSON.stringify(node));

  // MAJOR FIX: Completely rewritten link validation for view mode
  // This ensures links created with any version of the editor will render correctly
  let validatedNode;
  try {
    // First try to validate the node directly
    validatedNode = validateLink(node);

    // If validation failed or returned null, try to extract a link object from the node
    if (!validatedNode && node.children) {
      // Look for link objects in children
      for (const child of node.children) {
        if (child && child.type === 'link') {
          console.log('LINK_RENDER_DEBUG: Found link in children, extracting:', JSON.stringify(child));
          validatedNode = validateLink(child);
          if (validatedNode) break;
        }
      }
    }

    // If we still don't have a valid node but have a URL, create a minimal valid link
    if (!validatedNode && node.url) {
      console.log('LINK_RENDER_DEBUG: Creating minimal valid link from URL:', node.url);
      validatedNode = validateLink({
        type: 'link',
        url: node.url,
        children: [{ text: node.displayText || node.children?.[0]?.text || node.url }],
        id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });
    }

    // If still no valid node, check if this is a nested structure
    if (!validatedNode && node.link && typeof node.link === 'object') {
      console.log('LINK_RENDER_DEBUG: Found nested link object, extracting:', JSON.stringify(node.link));
      validatedNode = validateLink(node.link);
    }

    // Check for data property that might contain link information
    if (!validatedNode && node.data && typeof node.data === 'object') {
      if (node.data.url || node.data.href || node.data.pageId) {
        console.log('LINK_RENDER_DEBUG: Found link data in data property:', JSON.stringify(node.data));
        validatedNode = validateLink({
          ...node.data,
          type: 'link',
          children: [{ text: node.data.displayText || node.data.text || 'Link' }],
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
        url: node.url || '#',
        children: [{ text: node.displayText || node.children?.[0]?.text || 'Link (Error)' }],
        displayText: node.displayText || node.children?.[0]?.text || 'Link (Error)',
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
      url: node.url || '#',
      children: [{ text: node.displayText || node.children?.[0]?.text || 'Link (Error)' }],
      displayText: node.displayText || node.children?.[0]?.text || 'Link (Error)',
      className: 'error-link',
      isError: true,
      id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  // If validation failed or returned null, show an error
  if (!validatedNode) {
    console.error('LINK_RENDER_ERROR: Link validation failed for node:', node);
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

  // IMPROVED: Extract display text with better fallbacks
  const getTextFromNode = (node) => {
    // CRITICAL FIX: Try multiple approaches to extract text

    // 1. Check for explicit displayText property
    if (node.displayText && node.displayText !== 'Link') {
      return node.displayText;
    }

    // 2. Check for text in children array
    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      // Try to find the first child with text
      for (const child of node.children) {
        if (child && child.text && child.text.trim()) {
          return child.text;
        }
      }
    }

    // 3. Check for pageTitle (for page links)
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

  // For protocol links, use a special component
  if (isProtocolLink) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <PillLink
                href="/protocol"
                isPublic={true}
                className="protocol-link"
              >
                {displayText || "WeWrite Protocol"}
              </PillLink>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Learn about the WeWrite protocol</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // For internal page links, use the InternalLinkWithTitle component
  if (pageId) {
    console.log('RENDERING_PAGE_LINK:', { pageId, displayText, validatedNode });

    // CRITICAL FIX: Extract original page title from multiple possible sources
    const originalPageTitle = validatedNode.pageTitle ||
                              validatedNode.originalPageTitle ||
                              validatedNode.data?.pageTitle ||
                              validatedNode.data?.originalPageTitle ||
                              null;

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
        />
      </span>
    );
  }

  // For external links, use the PillLink component with a modal confirmation
  if (isExternal) {
    // Handle click on external link
    const handleExternalLinkClick = (e) => {
      e.preventDefault();
      setShowExternalLinkModal(true);
    };

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

        <Modal
          isOpen={showExternalLinkModal}
          onClose={() => setShowExternalLinkModal(false)}
          title="External Link"
          footer={
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowExternalLinkModal(false)}
              >
                Back
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  window.open(href, '_blank', 'noopener,noreferrer');
                  setShowExternalLinkModal(false);
                }}
              >
                Visit link
              </Button>
            </div>
          }
        >
          <p className="mb-4">You're about to visit an external website:</p>
          <div className="bg-muted p-3 rounded mb-2 break-all">
            <code>{href}</code>
          </div>
        </Modal>
      </>
    );
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
};

// Component for internal links that fetches and displays page titles
const InternalLinkWithTitle = ({ pageId, href, displayText, originalPageTitle }) => {
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

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>
          <p>{currentTitle || originalPageTitle || displayText || 'Page Link'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default TextView;
