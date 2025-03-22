import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useState, useEffect, useCallback, useRef } from "react";
import { usePage } from "../contexts/PageContext";
import { duotoneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { cx } from "class-variance-authority";
import { getLanguages } from "../utils/common";
import { nodeTypes } from "../utils/constants";
import { PillLink } from "./PillLink";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { getPageById } from "../firebase/database";
import { LineSettingsProvider, useLineSettings, LINE_MODES } from '../contexts/LineSettingsContext';
import { motion, AnimatePresence, useScroll, useSpring, useInView, useTransform } from "framer-motion";

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
 *    - NO line breaks between paragraphs
 *    - Text wraps continuously as if newline characters were temporarily deleted
 *    - Paragraph numbers are inserted inline within the continuous text
 *    - Standard text size (1rem/16px)
 *    - Only a small space separates one paragraph from the next
 *    - Resembles Bible verses with continuous text flow
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

const TextView = ({ content, isSearch = false, viewMode = 'normal' }) => {
  const [parsedContents, setParsedContents] = useState(null);
  const [language, setLanguage] = useState(null);
  const { lineMode } = useLineSettings();
  const [loadedParagraphs, setLoadedParagraphs] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

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

  // Staggered loading animation effect
  useEffect(() => {
    if (parsedContents && isInitialLoad) {
      // Count the number of paragraph-like nodes
      const paragraphNodes = parsedContents.filter(node => 
        node.type === nodeTypes.PARAGRAPH || 
        node.type === nodeTypes.HEADING || 
        node.type === nodeTypes.CODE_BLOCK ||
        node.type === nodeTypes.LIST
      );
      
      // Create a staggered loading effect
      const totalNodes = paragraphNodes.length;
      const loadingDelay = ANIMATION_CONSTANTS.PARAGRAPH_LOADING_DELAY; // ms between each paragraph appearance
      
      if (totalNodes > 0) {
        const newLoadedParagraphs = [];
        
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
        }, totalNodes * loadingDelay + 100);
      } else {
        setIsInitialLoad(false);
      }
    }
  }, [parsedContents, isInitialLoad]);

  const getViewModeStyles = () => {
    switch(viewMode) {
      case 'normal':
        return 'space-y-6'; 
      case 'dense':
        return 'space-y-0'; 
      default:
        return 'space-y-4';
    }
  };

  return (
    <motion.div 
      className={`flex flex-col ${getViewModeStyles()} w-full text-left ${viewMode === 'normal' ? 'items-start' : ''} ${
        isScrolled 
          ? 'px-2 sm:px-3 md:px-4 max-w-full transition-all duration-200 ease-in-out' 
          : 'px-3 md:px-4 transition-all duration-200 ease-in-out'
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      {!parsedContents && !isSearch && (
        <div className="p-6 text-muted-foreground">No content available</div>
      )}
      
      {parsedContents && (
        <RenderContent contents={parsedContents} language={language} viewMode={viewMode} loadedParagraphs={loadedParagraphs} />
      )}
    </motion.div>
  );
};

export const RenderContent = ({ contents, language, viewMode = 'normal', loadedParagraphs }) => {
  // Try to use the page context, but provide a fallback if it's not available
  const pageContext = usePage();
  const { lineMode } = useLineSettings();
  
  // Use the language from props or from context
  const contentLanguage = language || (pageContext && pageContext.language) || null;
  
  if (!contents) {
    return <div>No content to display</div>;
  }
  
  /**
   * Dense Mode Implementation
   * 
   * This mode renders all paragraphs in a single continuous flow with:
   * - No line breaks between paragraphs
   * - Text wraps continuously as if newline characters were deleted
   * - Paragraph numbers are inserted inline within the continuous text
   * - Standard text size (1rem/16px)
   * - Only a small space separates one paragraph from the next
   * 
   * This creates a Bible verse style layout where text flows continuously
   * with paragraph numbers serving as the only visual separator.
   */
  if (viewMode === 'dense') {
    return (
      <div className="relative">
        {Array.isArray(contents) && (
          <div className="prose max-w-full">
            <p className="text-foreground leading-normal text-base">
              {contents.map((node, index) => (
                <React.Fragment key={index}>
                  {loadedParagraphs.includes(index) && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ 
                        duration: 0.2,
                        delay: index * 0.03
                      }}
                      className="inline"
                    >
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
                    </motion.span>
                  )}
                </React.Fragment>
              ))}
            </p>
          </div>
        )}
      </div>
    );
  }
  
  // For normal mode
  // If it's an array, map through and render each node
  if (Array.isArray(contents)) {
    return (
      <div className="w-full text-left">
        {contents.map((node, index) => (
          <React.Fragment key={index}>
            {loadedParagraphs.includes(index) && renderNode(node, viewMode, index)}
          </React.Fragment>
        ))}
      </div>
    );
  }
  
  // If it's a single node, render it directly
  return renderNode(contents, viewMode, 0);
};

// Render content based on node type
const renderNode = (node, viewMode, index) => {
  if (!node) return null;

  // Only use ParagraphNode for normal mode
  if (viewMode === 'normal') {
    switch (node.type) {
      case nodeTypes.PARAGRAPH:
        return <ParagraphNode key={index} node={node} viewMode={viewMode} index={index} />;
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

// Define the missing node components
const ParagraphNode = ({ node, viewMode = 'normal', index = 0 }) => {
  const paragraphRef = useRef(null);
  const { lineMode } = useLineSettings();
  const [lineHovered, setLineHovered] = useState(false);
  
  // Define consistent text size for all modes
  const TEXT_SIZE = "text-base"; // 1rem (16px) for all modes

  // Only used for normal mode now
  const spacingClass = 'mb-2';

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

  /**
   * Normal Mode Implementation
   * 
   * This mode renders paragraphs with:
   * - Paragraph numbers positioned to the left of the text
   * - Numbers aligned with the first line of paragraph text
   * - Clear indentation for each paragraph
   * - Proper spacing between paragraphs
   * - Standard text size (1rem/16px)
   * 
   * This creates a traditional document layout with clear paragraph
   * separation and consistent indentation.
   */
  
  // Consistent paragraph number style for both modes
  const renderParagraphNumber = (index) => (
    <span className="text-muted-foreground text-xs select-none">
      {index + 1}
    </span>
  );

  // Normal mode with motion animations
  return (
    <motion.div 
      className={`group relative ${spacingClass}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: ANIMATION_CONSTANTS.SPRING_STIFFNESS, 
        damping: ANIMATION_CONSTANTS.SPRING_DAMPING,
        mass: ANIMATION_CONSTANTS.SPRING_MASS
      }}
    >
      {/* Normal mode - paragraph numbers create indentation */}
      <div className="flex items-start">
        {/* Paragraph number - aligned with first line of text */}
        <motion.div
          className="flex-shrink-0 w-6 text-right pr-1 pt-[0.25rem]"
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
          <p className={`text-left ${TEXT_SIZE}`}>
            {node.children && node.children.map((child, i) => renderChild(child, i))}
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
      <SyntaxHighlighter
        language={codeLanguage}
        style={duotoneDark}
        customStyle={{
          borderRadius: '0.5rem',
          padding: '1rem',
          fontSize: '0.875rem',
          lineHeight: 1.7,
        }}
      >
        {node.content || (node.children && node.children.map(child => child.text).join('\n')) || ''}
      </SyntaxHighlighter>
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
  const href = node.url || node.href || node.link || '#';
  const pageId = extractPageId(href);
  
  // For internal links, use the InternalLinkWithTitle component
  if (pageId) {
    return (
      <span className="inline-block">
        <InternalLinkWithTitle pageId={pageId} href={href} displayText={node.displayText || node.text} />
      </span>
    );
  }
  
  // For external links, use the PillLink component
  return (
    <span className="inline-block">
      <PillLink href={href} isPublic={true} className="inline">
        {node.displayText || node.text || node.content || href}
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
      {displayText || title || (isLoading ? 'Loading...' : 'Page Link')}
    </PillLink>
  );
};

export default TextView;
