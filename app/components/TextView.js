import React, { useState, useEffect, useCallback, useRef, useContext, useMemo } from "react";
import { usePage } from "../contexts/PageContext";
import SecureSyntaxHighlighter from "./SecureSyntaxHighlighter";
import { useLineSettings } from "../contexts/LineSettingsContext";
import { getLanguages } from "../utils/common";
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

const TextView = ({ content, isSearch = false, viewMode = 'normal', onRenderComplete, setIsEditing }) => {
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

  // Modified loading animation effect to reduce layout shifts on mobile
  useEffect(() => {
    if (parsedContents && isInitialLoad) {
      // Count the number of paragraph-like nodes
      const paragraphNodes = parsedContents.filter(node =>
        node.type === nodeTypes.PARAGRAPH ||
        node.type === nodeTypes.HEADING ||
        node.type === nodeTypes.CODE_BLOCK ||
        node.type === nodeTypes.LIST
      );

      // Get total number of nodes
      const totalNodes = paragraphNodes.length;

      // Check if we're on mobile
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

      if (totalNodes > 0) {
        if (isMobile) {
          // On mobile, load all paragraphs at once to prevent layout shifts
          // This still preserves the fade-in animation but avoids staggered loading
          setLoadedParagraphs(Array.from({ length: totalNodes }, (_, i) => i));

          // Short delay before marking as complete
          setTimeout(() => {
            setIsInitialLoad(false);

            // Call onRenderComplete callback
            if (onRenderComplete && typeof onRenderComplete === 'function') {
              onRenderComplete();
            }
          }, 300);
        } else {
          // On desktop, use the original staggered loading effect
          const loadingDelay = ANIMATION_CONSTANTS.PARAGRAPH_LOADING_DELAY; // ms between each paragraph appearance

          // Schedule each paragraph to appear with a staggered delay
          for (let i = 0; i < totalNodes; i++) {
            setTimeout(() => {
              setLoadedParagraphs(prev => [...prev, i]);
            }, i * loadingDelay);
          }

          // Mark initial load as complete after all paragraphs are loaded
          setTimeout(() => {
            setIsInitialLoad(false);
            setLoadedParagraphs(Array.from({ length: totalNodes }, (_, i) => i));

            // Call onRenderComplete callback when all paragraphs are loaded
            if (onRenderComplete && typeof onRenderComplete === 'function') {
              onRenderComplete();
            }
          }, totalNodes * loadingDelay + 100);
        }
      } else {
        setIsInitialLoad(false);

        // If there are no paragraphs, call onRenderComplete immediately
        if (onRenderComplete && typeof onRenderComplete === 'function') {
          onRenderComplete();
        }
      }
    }
  }, [parsedContents, isInitialLoad, onRenderComplete]);

  const getViewModeStyles = () => {
    // Use the effective mode for styling
    if (effectiveMode === LINE_MODES.DENSE) {
      return 'space-y-0'; // No spacing between paragraphs for dense mode
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
      }`}
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
        />
      )}
    </motion.div>
  );
};

export const RenderContent = ({ contents, language, loadedParagraphs, effectiveMode, canEdit = false, activeLineIndex = null, onActiveLine = null }) => {
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
        <div className="relative">
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
                    <span className="text-muted-foreground text-xs select-none">
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
      <div className="w-full text-left">
        {contents.map((node, index) => (
          <React.Fragment key={index}>
            {loadedParagraphs.includes(index) && renderNode(node, mode, index, canEdit, activeLineIndex, onActiveLine)}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // If it's a single node, render it directly
  return renderNode(contents, mode, 0, canEdit, activeLineIndex, onActiveLine);
};

// Render content based on node type
const renderNode = (node, mode, index, canEdit = false, activeLineIndex = null, onActiveLine = null) => {
  if (!node) return null;

  // Only use ParagraphNode for normal mode
  if (mode === LINE_MODES.NORMAL) {
    switch (node.type) {
      case nodeTypes.PARAGRAPH:
        return (
          <ParagraphNode
            key={index}
            node={node}
            effectiveMode={mode}
            index={index}
            canEdit={canEdit}
            isActive={activeLineIndex === index}
            onActiveLine={onActiveLine}
          />
        );
      case nodeTypes.CODE_BLOCK:
        return <CodeBlockNode key={index} node={node} index={index} />;
      case nodeTypes.HEADING:
        return <HeadingNode key={index} node={node} index={index} />;
      case nodeTypes.LIST:
        return <ListNode key={index} node={node} index={index} />;
      default:
        return null;
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
const ParagraphNode = ({ node, effectiveMode = 'normal', index = 0, canEdit = false, isActive = false, onActiveLine = null }) => {
  const { lineMode } = useLineSettings();
  // Always use the latest lineMode from context to ensure immediate updates
  // Fall back to effectiveMode only if lineMode is not available
  const mode = lineMode || (effectiveMode === 'dense' ? LINE_MODES.DENSE : LINE_MODES.NORMAL);

  const paragraphRef = useRef(null);
  const [lineHovered, setLineHovered] = useState(false);

  // Define consistent text size for all modes
  const TEXT_SIZE = "text-base"; // 1rem (16px) for all modes

  // Only used for normal mode now
  const spacingClass = 'mb-2';

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

      if (child.code) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-muted font-mono"
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
    <span className="text-muted-foreground text-sm select-none leading-none">
      {index + 1}
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
          {renderParagraphNumber(index)}
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

const CodeBlockNode = ({ node, language, index = 0 }) => {
  // If language is not provided, try to extract it from the node
  const codeLanguage = language || node.language || 'javascript';

  return (
    <motion.div
      className="relative my-4 group"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: ANIMATION_CONSTANTS.SPRING_STIFFNESS,
        damping: ANIMATION_CONSTANTS.SPRING_DAMPING,
        mass: ANIMATION_CONSTANTS.SPRING_MASS
      }}
    >
      <motion.span
        className="absolute -left-6 top-[0.15rem] text-muted-foreground text-xs select-none"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: 0.05,
          type: "spring",
          stiffness: ANIMATION_CONSTANTS.SPRING_STIFFNESS,
          damping: ANIMATION_CONSTANTS.SPRING_DAMPING
        }}
      >
        {index + 1}
      </motion.span>
      <SecureSyntaxHighlighter
        language={codeLanguage}
        style={{
          borderRadius: '0.5rem',
          padding: '1rem',
          fontSize: '0.875rem',
          lineHeight: 1.7,
        }}
      >
        {node.content || (node.children && node.children.map(child => child.text).join('\n')) || ''}
      </SecureSyntaxHighlighter>
    </motion.div>
  );
};

const HeadingNode = ({ node, index = 0 }) => {
  const level = node.level || 1;
  const HeadingTag = `h${level}`;

  const headingClasses = {
    1: 'text-2xl font-bold mt-8 mb-4',
    2: 'text-xl font-bold mt-6 mb-3',
    3: 'text-lg font-bold mt-5 mb-2',
    4: 'text-base font-bold mt-4 mb-2',
    5: 'text-sm font-bold mt-3 mb-1',
    6: 'text-xs font-bold mt-2 mb-1'
  };

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: ANIMATION_CONSTANTS.SPRING_STIFFNESS,
        damping: ANIMATION_CONSTANTS.SPRING_DAMPING,
        mass: ANIMATION_CONSTANTS.SPRING_MASS
      }}
    >
      <motion.span
        className="absolute -left-6 top-[0.15rem] text-muted-foreground text-xs select-none"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: 0.05,
          type: "spring",
          stiffness: ANIMATION_CONSTANTS.SPRING_STIFFNESS,
          damping: ANIMATION_CONSTANTS.SPRING_DAMPING
        }}
      >
        {index + 1}
      </motion.span>
      <HeadingTag className={headingClasses[level] || headingClasses[1]}>
        {node.children && node.children.map((child, i) => (
          <span key={i} className={child.bold ? 'font-bold' : child.italic ? 'italic' : ''}>
            {child.text}
          </span>
        ))}
      </HeadingTag>
    </motion.div>
  );
};

const ListNode = ({ node, index = 0 }) => {
  const ListTag = node.listType === 'ordered' ? 'ol' : 'ul';
  const listClasses = node.listType === 'ordered' ? 'list-decimal' : 'list-disc';

  return (
    <motion.div
      className="relative my-4 pl-8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: ANIMATION_CONSTANTS.SPRING_STIFFNESS,
        damping: ANIMATION_CONSTANTS.SPRING_DAMPING,
        mass: ANIMATION_CONSTANTS.SPRING_MASS
      }}
    >
      <motion.span
        className="absolute -left-6 top-[0.15rem] text-muted-foreground text-xs select-none"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: 0.05,
          type: "spring",
          stiffness: ANIMATION_CONSTANTS.SPRING_STIFFNESS,
          damping: ANIMATION_CONSTANTS.SPRING_DAMPING
        }}
      >
        {index + 1}
      </motion.span>
      <ListTag className={`ml-5 ${listClasses}`}>
        {node.children && node.children.map((item, i) => (
          <li key={i} className="my-1">
            {item.children && item.children.map((child, j) => (
              <span key={j} className={child.bold ? 'font-bold' : child.italic ? 'italic' : ''}>
                {child.text}
              </span>
            ))}
          </li>
        ))}
      </ListTag>
    </motion.div>
  );
};

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
    return (
      <span className="inline-block">
        <InternalLinkWithTitle pageId={pageId} href={href} displayText={displayText} />
      </span>
    );
  }

  // For external links, use the PillLink component with a modal confirmation
  if (isExternal) {
    return (
      <>
        <span className="inline-block">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setShowExternalLinkModal(true);
            }}
            className="inline-flex items-center my-0.5 px-1.5 py-0.5 text-sm font-medium rounded-[8px] transition-colors duration-200 bg-[#0057FF] text-white border-[1.5px] border-[rgba(255,255,255,0.2)] hover:bg-[#0046CC] hover:border-[rgba(255,255,255,0.3)] shadow-sm cursor-pointer external-link"
          >
            {displayText}
            <ExternalLink className="inline-block h-3.5 w-3.5 ml-1 flex-shrink-0" />
          </a>
        </span>

        {showExternalLinkModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background rounded-lg p-6 max-w-md w-full shadow-lg border border-border dark:border-border">
              <h3 className="text-lg font-semibold mb-4">External Link</h3>
              <p className="mb-4">You're about to visit an external website:</p>
              <div className="bg-muted p-3 rounded mb-6 break-all">
                <code>{href}</code>
              </div>
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
            </div>
          </div>
        )}
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
const InternalLinkWithTitle = ({ pageId, href, displayText }) => {
  const [title, setTitle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTitle = async () => {
      setIsLoading(true);
      const pageTitle = await getPageTitle(pageId);
      setTitle(pageTitle);
      setIsLoading(false);
    };

    fetchTitle();
  }, [pageId]);

  return (
    <PillLink href={href} isPublic={true} className="inline">
      {displayText || title || (isLoading ? <><div className="loader"></div> Loading</> : 'Page Link')}
    </PillLink>
  );
};

export default TextView;
