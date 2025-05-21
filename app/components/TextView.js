import React, { useState, useEffect, useCallback, useRef, useContext, useMemo } from "react";
import { usePage } from "../contexts/PageContext";
import { useLineSettings } from "../contexts/LineSettingsContext";
import { nodeTypes } from "../utils/constants";
import { PillLink } from "./PillLink";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { getPageById } from "../firebase/database";
import { LineSettingsProvider, LINE_MODES } from '../contexts/LineSettingsContext';
import { motion, AnimatePresence, useScroll, useSpring, useInView, useTransform } from "framer-motion";
import { AuthContext } from "../providers/AuthProvider";
import { isExternalLink } from "../utils/linkFormatters";
import { validateLink, getLinkDisplayText, extractPageIdFromUrl } from '../utils/linkValidator';
import { Button } from "./ui/button";
import { ExternalLink } from "lucide-react";
import Modal from "./ui/modal";
import { useControlledAnimation } from "../hooks/useControlledAnimation";
import "./paragraph-styles.css";
import "./diff-styles.css";

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

const TextView = ({ content, isSearch = false, viewMode = 'normal', onRenderComplete, setIsEditing, showDiff = false }) => {
  const [parsedContents, setParsedContents] = useState(null);
  const [language, setLanguage] = useState(null);
  const { lineMode } = useLineSettings();
  const [loadedParagraphs, setLoadedParagraphs] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState(null);
  const { user } = useContext(AuthContext);
  const { page } = usePage();

  // Check if current user can edit this page
  const canEdit = Boolean(
    setIsEditing &&
    user?.uid &&
    page?.userId &&
    user.uid === page.userId
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
          // Create a fallback content structure with the error message
          contents = [{
            type: "paragraph",
            children: [{ text: "Error loading content. Please try refreshing the page." }]
          }];
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
      // Create a fallback content structure with the error message
      contents = [{
        type: "paragraph",
        children: [{ text: "Error loading content. Please try refreshing the page." }]
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

  // Wrap the component in an error boundary
  try {
    return (
      <div className="relative">
        <div
          className={`flex flex-col ${getViewModeStyles()} w-full text-left ${
            isScrolled ? 'pb-16' : ''
          } ${
            canEdit ? 'relative' : ''
          } min-h-screen`}
          onClick={() => {
            if (canEdit && setIsEditing) {
              // Set editing state immediately without animations or overlays
              // for a smoother WYSIWYG transition
              setIsEditing(true);
            }
          }}
          title={canEdit ? "Click anywhere to edit" : ""}
        >
          {canEdit && (
            <div className="absolute top-0 right-0 p-2 text-xs text-muted-foreground bg-background/80 rounded-bl-md">
              Click to edit
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
            />
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error rendering TextView:', error);
    return (
      <div className="p-6 text-muted-foreground">
        Error loading content. Please try refreshing the page.
      </div>
    );
  }
};

export const RenderContent = ({ contents, loadedParagraphs, effectiveMode, canEdit = false, activeLineIndex = null, onActiveLine = null, showDiff = false }) => {
  // Wrap in try-catch to handle any rendering errors
  try {
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
                        return <LinkNode key={childIndex} node={child} />;
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
                                return <LinkNode key={`${childIndex}-${grandchildIndex}`} node={grandchild} />;
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
    return (
      <div className="p-6 text-muted-foreground">
        Error rendering content. Please try refreshing the page.
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
    // Handle link nodes
    if (child.type === 'link') {
      return <LinkNode key={i} node={child} />;
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
          className="paragraph-number-inline select-none flex-shrink-0 mr-2 text-center"
          style={{
            width: '1.5rem',
            display: 'inline-block',
            textAlign: 'right'
          }}
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

  // CRITICAL FIX: Use validateLink to standardize the link object
  // This ensures all required properties are present regardless of which editor created the link
  const validatedNode = validateLink(node);

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
    // First try using the standardized utility function
    const displayText = getLinkDisplayText(validatedNode);
    if (displayText) return displayText;

    // Deep traversal to extract text from children
    const extractTextFromNode = (node, depth = 0) => {
      if (!node) return '';
      if (depth > 5) return ''; // Prevent infinite recursion
      if (node.text) return node.text;
      if (node.children && Array.isArray(node.children)) {
        return node.children.map(child => extractTextFromNode(child, depth + 1)).join('');
      }
      return '';
    };

<<<<<<< Updated upstream
    if (node.children && Array.isArray(node.children)) {
      const extractedText = extractTextFromNode(node);
      if (extractedText) {
        return extractedText;
      }
    }

    // Check for text in the node's data property
    if (node.data && typeof node.data === 'object') {
      if (node.data.text) return node.data.text;
      if (node.data.displayText) return node.data.displayText;
    }

    // For external links, use the URL as fallback
    if (isExternal && href) {
      return href;
    }

    // For page links, try to extract a title from the URL
    if (pageId) {
      return pageId.replace(/-/g, ' ');
    }
=======
    // Try extracting from children
    if (validatedNode.children && Array.isArray(validatedNode.children)) {
      const extractedText = extractTextFromNode(validatedNode);
      if (extractedText) return extractedText;
    }

    // Check for text in data property
    if (validatedNode.data && typeof validatedNode.data === 'object') {
      if (validatedNode.data.text) return validatedNode.data.text;
      if (validatedNode.data.displayText) return validatedNode.data.displayText;
    }

    // Use appropriate fallbacks based on link type
    if (isExternal && href) return href;
    if (pageId) return validatedNode.pageTitle || pageId.replace(/-/g, ' ');
>>>>>>> Stashed changes

    // Last resort fallback
    return href || 'Link';
  };

<<<<<<< Updated upstream
  // Always ensure we get a valid display text
  let displayText = getTextFromNode(node);
=======
  // Get display text with improved extraction
  let displayText = getTextFromNode(validatedNode);
>>>>>>> Stashed changes

  // If displayText is still empty, use appropriate fallbacks
  if (!displayText) {
<<<<<<< Updated upstream
    displayText = node.pageTitle || (pageId ? `Page: ${pageId}` : (isExternal ? href : 'Link'));
  }

  // For internal links, use the InternalLinkWithTitle component
=======
    displayText = validatedNode.pageTitle || (pageId ? `Page: ${pageId}` : (isExternal ? href : 'Link'));
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
>>>>>>> Stashed changes
  if (pageId) {
    // Pass the original page title if available in the node
    const originalPageTitle = validatedNode.pageTitle || null;

    // Ensure href is properly formatted for internal links
    const formattedHref = href.startsWith('/') ? href : `/pages/${pageId}`;

<<<<<<< Updated upstream
=======
    // Ensure we have a valid display text for page links
    let finalDisplayText = displayText;
    if (!finalDisplayText) {
      finalDisplayText = validatedNode.pageTitle || `Page: ${pageId}`;
    }

>>>>>>> Stashed changes
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
            <ExternalLink size={14} className="ml-1 inline-block" />
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
  const [isLoading, setIsLoading] = useState(true);
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
    setIsLoading(true);
    setFetchError(false);
    setCurrentTitle(null);

    const fetchTitle = async () => {
      try {
        if (!pageId) {
          setFetchError(true);
          setIsLoading(false);
          return;
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

    fetchTitle();
  }, [pageId, isMounted]);

  // Determine what text to display using a clear priority system
  let textToDisplay;

  // First priority: If displayText was explicitly provided and is different from originalPageTitle,
  // it was customized by the user, so use it
  if (displayText && originalPageTitle && displayText !== originalPageTitle) {
    textToDisplay = displayText;
  }
  // Second priority: If displayText was explicitly provided and there's no originalPageTitle,
  // use the provided displayText
  else if (displayText && !originalPageTitle) {
    textToDisplay = displayText;
  }
  // Third priority: If we have a currentTitle from the database, use it
  else if (currentTitle) {
    textToDisplay = currentTitle;
  }
  // Fourth priority: If originalPageTitle is available, use it while loading
  else if (originalPageTitle && isLoading) {
    console.log('LINK_DEBUG: Using originalPageTitle while loading:', originalPageTitle);
    textToDisplay = originalPageTitle;
  }
  // Fifth priority: If we're still loading and have no originalPageTitle, show a loading indicator
  else if (isLoading) {
    textToDisplay = (
      <>
        <span className="inline-block w-3 h-3 border-2 border-t-transparent border-primary rounded-full animate-spin mr-1"></span>
        <span className="text-xs">Loading</span>
      </>
    );
  }
  // Sixth priority: If there was an error or we have no other text, use a fallback
  else {
    const fallbackText = fetchError ? 'Page Link (Error)' : (originalPageTitle || 'Page Link');
    textToDisplay = fallbackText;
  }

  // Use TooltipProvider to show the full title on hover
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
