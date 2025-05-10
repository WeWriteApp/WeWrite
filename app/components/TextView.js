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
import { Button } from "./ui/button";
import { ExternalLink } from "lucide-react";
import Modal from "./ui/modal";
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
  PARAGRAPH_LOADING_DELAY: 30, // ms between each paragraph appearance
  SPRING_STIFFNESS: 500,
  SPRING_DAMPING: 30,
  SPRING_MASS: 1
};

// Function to extract page ID from URL
const extractPageId = (url) => {
  if (!url) return null;
  const match = url.match(/\/pages\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
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
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    let contents;
    try {
      contents = typeof content === "string" ? JSON.parse(content) : content;
    } catch (e) {
      console.error("Error parsing content:", e);
      contents = [];
    }

    setParsedContents(contents || []);

    // Reset loaded paragraphs and initial load state when content changes
    setLoadedParagraphs([]);
    setIsInitialLoad(true);
  }, [content]);

  // Modified loading animation effect to prevent layout shifts
  useEffect(() => {
    if (parsedContents && isInitialLoad) {
      // Count the number of paragraph nodes (WeWrite only supports paragraphs)
      const paragraphNodes = parsedContents.filter(node =>
        node.type === nodeTypes.PARAGRAPH
      );

      // Get total number of nodes
      const totalNodes = paragraphNodes.length;

      // Load all paragraphs at once to prevent layout shifts
      // This preserves the fade-in animation but avoids staggered loading
      setLoadedParagraphs(Array.from({ length: totalNodes }, (_, i) => i));

      // Short delay before marking as complete
      setTimeout(() => {
        setIsInitialLoad(false);

        // Call onRenderComplete callback
        if (onRenderComplete && typeof onRenderComplete === 'function') {
          onRenderComplete();
        }
      }, 300);

      // If there are no paragraphs, call onRenderComplete immediately
      if (totalNodes === 0) {
        setIsInitialLoad(false);
        if (onRenderComplete && typeof onRenderComplete === 'function') {
          onRenderComplete();
        }
      }
    }
  }, [parsedContents, isInitialLoad, onRenderComplete]);

  const getViewModeStyles = () => {
    // Use the effective mode for styling
    if (effectiveMode === LINE_MODES.DENSE) {
      return 'space-y-0 dense-mode'; // No spacing between paragraphs for dense mode
    } else {
      return 'space-y-6'; // Normal spacing between paragraphs
    }
  };

  // Handle click to edit
  const handleActiveLine = (index) => {
    setActiveLineIndex(index);
    if (canEdit && setIsEditing) {
      // Show loading state immediately
      if (typeof window !== 'undefined') {
        // Remove any existing loading overlays first
        const existingOverlay = document.getElementById('edit-loading-overlay');
        if (existingOverlay) {
          existingOverlay.remove();
        }

        // Add a loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center';
        loadingOverlay.id = 'edit-loading-overlay';

        const spinner = document.createElement('div');
        spinner.className = 'loader loader-md';
        loadingOverlay.appendChild(spinner);

        document.body.appendChild(loadingOverlay);

        // Set a timeout to remove the overlay after 10 seconds (failsafe)
        setTimeout(() => {
          const overlay = document.getElementById('edit-loading-overlay');
          if (overlay) {
            overlay.remove();
          }
        }, 10000);
      }

      // Set editing state immediately
      setIsEditing(true);

      // Remove loading overlay after a short delay
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          const overlay = document.getElementById('edit-loading-overlay');
          if (overlay) {
            overlay.remove();
          }

          // Show a toast notification to indicate edit mode
          if (window.toast) {
            window.toast.info('Entering edit mode');
          }
        }
      }, 300);
    }
  };

  return (
    <motion.div
      className={`flex flex-col ${getViewModeStyles()} w-full text-left ${
        effectiveMode === LINE_MODES.NORMAL ? 'items-start' : ''
      } ${
        isScrolled ? 'pb-16' : ''
      } ${
        canEdit ? 'relative' : ''
      } min-h-screen`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onClick={() => {
        if (canEdit && setIsEditing) {
          // Show loading state immediately
          if (typeof window !== 'undefined') {
            // Remove any existing loading overlays first
            const existingOverlay = document.getElementById('edit-loading-overlay');
            if (existingOverlay) {
              existingOverlay.remove();
            }

            // Add a loading overlay
            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center';
            loadingOverlay.id = 'edit-loading-overlay';

            const spinner = document.createElement('div');
            spinner.className = 'loader loader-md';
            loadingOverlay.appendChild(spinner);

            document.body.appendChild(loadingOverlay);

            // Set a timeout to remove the overlay after 10 seconds (failsafe)
            setTimeout(() => {
              const overlay = document.getElementById('edit-loading-overlay');
              if (overlay) {
                overlay.remove();
              }
            }, 10000);
          }

          // Set editing state immediately
          setIsEditing(true);

          // Remove loading overlay after a short delay
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              const overlay = document.getElementById('edit-loading-overlay');
              if (overlay) {
                overlay.remove();
              }
            }
          }, 300);
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
    </motion.div>
  );
};

export const RenderContent = ({ contents, language, loadedParagraphs, effectiveMode, canEdit = false, activeLineIndex = null, onActiveLine = null, showDiff = false }) => {
  // Try to use the page context, but provide a fallback if it's not available
  const pageContext = usePage();
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

                return (
                  <React.Fragment key={index}>
                    {/* Only add a space if this isn't the first paragraph */}
                    {index > 0 && ' '}

                    {/* Paragraph number */}
                    <span className="paragraph-number text-xs ml-1">
                      {index + 1}
                    </span>{'\u00A0'}

                    {/* Paragraph content without any breaks */}
                    {node.children && node.children.map((child, childIndex) => {
                      if (child.type === 'link') {
                        return <LinkNode key={childIndex} node={child} />;
                      } else if (child.text) {
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
                      return null;
                    })}
                  </React.Fragment>
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
};

// Render content based on node type
const renderNode = (node, mode, index, canEdit = false, activeLineIndex = null, onActiveLine = null, showDiff = false) => {
  if (!node) return null;

  // Only use ParagraphNode for normal mode
  if (mode === LINE_MODES.NORMAL) {
    // WeWrite only supports paragraph nodes
    if (node.type === nodeTypes.PARAGRAPH) {
      return (
        <ParagraphNode
          key={index}
          node={node}
          effectiveMode={mode}
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
const ParagraphNode = ({ node, effectiveMode = 'normal', index = 0, canEdit = false, isActive = false, onActiveLine = null, showDiff = false }) => {
  const { lineMode } = useLineSettings();
  // Always use the latest lineMode from context to ensure immediate updates
  // Fall back to effectiveMode only if lineMode is not available
  const mode = lineMode || (effectiveMode === 'dense' ? LINE_MODES.DENSE : LINE_MODES.NORMAL);

  const paragraphRef = useRef(null);
  const [lineHovered, setLineHovered] = useState(false);

  // Define consistent text size for all modes
  const TEXT_SIZE = "text-base"; // 1rem (16px) for all modes

  // Spacing is now handled by paragraph-with-hanging-indent class
  const spacingClass = '';

  // Handle click to edit
  const handleClick = () => {
    if (canEdit && onActiveLine) {
      onActiveLine(index);
    }
  };

  // Helper function to render child nodes
  const renderChild = (child, i) => {
    if (child.type === 'link') {
      return <LinkNode key={i} node={child} />;
    } else if (child.text) {
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
    return null;
  };

  // Consistent paragraph number style for both modes
  const renderParagraphNumber = (index) => (
    <span className="paragraph-number-wrapper">
      <span className="paragraph-number">
        {index + 1}
      </span>
    </span>
  );

  // Normal mode with motion animations
  return (
    <motion.div
      ref={paragraphRef}
      className={`group relative ${spacingClass} ${canEdit ? 'cursor-text hover:bg-muted/30 active:bg-muted/50 transition-colors duration-150' : ''} ${isActive ? 'bg-[var(--active-line-highlight)]' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: ANIMATION_CONSTANTS.SPRING_STIFFNESS,
        damping: ANIMATION_CONSTANTS.SPRING_DAMPING,
        mass: ANIMATION_CONSTANTS.SPRING_MASS
      }}
      onClick={handleClick}
      onMouseEnter={() => canEdit && setLineHovered(true)}
      onMouseLeave={() => setLineHovered(false)}
      title={canEdit ? "Click to edit" : ""}
    >
      {/* Normal mode - paragraph numbers create indentation */}
      <div className="flex">
        {/* Paragraph number - precisely aligned with centerline of first line of text */}
        <motion.div
          className="flex-shrink-0 w-6 text-right pr-1 flex items-center justify-end"
          style={{
            height: "1.5rem",
            transform: "translateY(0.15rem)"
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            delay: 0.05,
            type: "spring",
            stiffness: ANIMATION_CONSTANTS.SPRING_STIFFNESS,
            damping: ANIMATION_CONSTANTS.SPRING_DAMPING
          }}
        >
          <span className="text-muted-foreground text-sm select-none leading-none">
            {index + 1}
          </span>
        </motion.div>

        {/* Paragraph content */}
        <div className="flex-1">
          <p className={`text-left ${TEXT_SIZE} ${lineHovered && !isActive ? 'bg-muted/30' : ''} ${canEdit ? 'relative' : ''}`}>
            {node.children && node.children.map((child, i) => renderChild(child, i))}
            {isActive && <span className="inline-block w-0.5 h-5 bg-primary animate-pulse ml-0.5"></span>}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// WeWrite only supports paragraph nodes, so we've removed CodeBlockNode, HeadingNode, and ListNode

const LinkNode = ({ node, index }) => {
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);
  const href = node.url || node.href || node.link || '#';
  const pageId = extractPageId(href);
  const isExternal = isExternalLink(href);

  // Extract text content from children array if available
  const getTextFromNode = (node) => {
    if (node.displayText) return node.displayText;
    if (node.text) return node.text;
    if (node.content) return node.content;
    // Check for children array and extract text
    if (node.children && Array.isArray(node.children)) {
      return node.children.map(child => child.text || '').join('');
    }
    return href;
  };

  const displayText = getTextFromNode(node);

  // For internal links, use the InternalLinkWithTitle component
  if (pageId) {
    // Pass the original page title if available in the node
    const originalPageTitle = node.pageTitle || null;

    return (
      <span className="inline-block">
        <InternalLinkWithTitle
          pageId={pageId}
          href={href}
          displayText={displayText}
          originalPageTitle={originalPageTitle}
        />
      </span>
    );
  }

  // For external links, use the PillLink component with a modal confirmation
  if (isExternal) {
    return (
      <>
        <span className="inline-block">
          <PillLink href={href} isPublic={true} className="external-link">
            {displayText}
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

  // For other links, use the PillLink component
  return (
    <span className="inline-block">
      <PillLink href={href} isPublic={true} className="inline">
        {displayText}
      </PillLink>
    </span>
  );
};

// Component for internal links that fetches and displays page titles
const InternalLinkWithTitle = ({ pageId, href, displayText, originalPageTitle }) => {
  const [currentTitle, setCurrentTitle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTitle = async () => {
      setIsLoading(true);
      const pageTitle = await getPageTitle(pageId);
      setCurrentTitle(pageTitle);
      setIsLoading(false);
    };

    fetchTitle();
  }, [pageId]);

  // Determine if displayText was customized or not
  // If originalPageTitle exists and displayText is different, it was customized
  const wasCustomized = originalPageTitle && displayText !== originalPageTitle;

  // If it was customized, use the custom displayText
  // If not customized, use the current title from the database
  const textToDisplay = wasCustomized
    ? displayText
    : (currentTitle || (isLoading ? <><span className="inline-block w-3 h-3 border-2 border-t-transparent border-primary rounded-full animate-spin mr-1"></span><span className="text-xs">Loading</span></> : 'Page Link'));

  return (
    <PillLink href={href} isPublic={true} className="inline">
      {textToDisplay}
    </PillLink>
  );
};

export default TextView;
