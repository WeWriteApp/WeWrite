import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useState, useEffect, useCallback, useRef } from "react";
import { usePage } from "@/contexts/PageContext";
import { duotoneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { cx } from "class-variance-authority";
import { getLanguages } from "@/utils/common";
import { nodeTypes } from "@/utils/constants";
import { PillLink } from "./PillLink";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { getPageById } from "@/firebase/database";
import { LineSettingsProvider, useLineSettings, LINE_MODES } from '../contexts/LineSettingsContext';
import { motion, AnimatePresence, useScroll, useSpring, useInView, useTransform } from "framer-motion";

// Cache for page titles to avoid redundant API calls
const pageTitleCache = new Map();

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

const TextView = ({ content, isSearch = false, viewMode = 'default' }) => {
  const [parsedContents, setParsedContents] = useState(null);
  const [language, setLanguage] = useState(null);
  const { lineMode } = useLineSettings();
  
  useEffect(() => {
    if (content) {
      try {
        let parsedData = content;
        
        // If the content is a string, try to parse it as JSON
        if (typeof content === "string") {
          parsedData = JSON.parse(content);
        }
        
        setParsedContents(parsedData);
      } catch (error) {
        console.error("Error parsing content:", error);
        setParsedContents([{ type: "paragraph", children: [{ text: "Error parsing content" }] }]);
      }
    }
  }, [content]);
  
  const getViewModeStyles = () => {
    switch(viewMode) {
      case 'spaced':
        return 'space-y-8';
      case 'wrapped':
        return 'space-y-1';
      case 'default':
      default:
        return 'space-y-4';
    }
  };

  return (
    <motion.div 
      className={`flex flex-col ${getViewModeStyles()} px-3 md:px-4 w-full`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      {!parsedContents && !isSearch && (
        <div className="p-6 text-muted-foreground">No content available</div>
      )}
      
      {parsedContents && (
        <RenderContent contents={parsedContents} language={language} viewMode={viewMode} />
      )}
    </motion.div>
  );
};

export const RenderContent = ({ contents, language, viewMode = 'default' }) => {
  // Try to use the page context, but provide a fallback if it's not available
  const pageContext = usePage();
  const { lineMode } = useLineSettings();
  
  // Use the language from props or from context
  const contentLanguage = language || (pageContext && pageContext.language) || null;
  
  if (!contents) {
    return <div>No content to display</div>;
  }
  
  // Special handling for wrapped mode
  if (viewMode === 'wrapped') {
    return (
      <div className="relative">
        {Array.isArray(contents) && (
          <div className="flex flex-wrap">
            {/* Single flowing chunk of text with paragraph numbers interspersed */}
            <motion.div 
              className="flex flex-wrap items-baseline" 
              layout
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {contents.map((node, index) => (
                <React.Fragment key={index}>
                  {/* Paragraph number */}
                  <motion.span 
                    className="text-muted-foreground text-xs select-none flex-shrink-0 inline-block"
                    layout
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    {index + 1}
                  </motion.span>
                  
                  {/* Paragraph content with hover highlight */}
                  <motion.div 
                    className="group inline-flex flex-wrap items-baseline hover:bg-muted/30 rounded transition-colors"
                    layout
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <WrappedNode node={node} index={index} />
                  </motion.div>
                  
                  {/* Add a small space between paragraphs */}
                  <motion.span 
                    className="inline-block"
                    layout
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    {" "}
                  </motion.span>
                </React.Fragment>
              ))}
            </motion.div>
          </div>
        )}
      </div>
    );
  }
  
  // For default and spaced modes
  // If it's an array, map through and render each node
  if (Array.isArray(contents)) {
    return (
      <>
        {contents.map((node, index) => (
          <React.Fragment key={index}>
            {renderNode(node, viewMode, index)}
          </React.Fragment>
        ))}
      </>
    );
  }
  
  // If it's a single node, render it directly
  return renderNode(contents, viewMode, 0);
};

// Component for wrapped mode nodes
const WrappedNode = ({ node, index }) => {
  if (!node) return null;
  
  // Handle paragraph nodes
  if (node.type === nodeTypes.PARAGRAPH) {
    if (node.children && Array.isArray(node.children)) {
      return (
        <motion.span 
          className="inline-flex flex-wrap items-baseline"
          layout
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {node.children.map((child, childIndex) => {
            if (child.type === 'link') {
              return (
                <motion.span 
                  key={childIndex}
                  className="inline-block"
                  layout
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <LinkNode node={child} />
                </motion.span>
              );
            } else if (child.text) {
              let className = '';
              if (child.bold) className += ' font-bold';
              if (child.italic) className += ' italic';
              if (child.underline) className += ' underline';
              
              if (child.code) {
                return (
                  <motion.code 
                    key={childIndex} 
                    className="px-1 py-0.5 rounded bg-muted font-mono"
                    layout
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    {child.text}
                  </motion.code>
                );
              }
              
              // Split text by spaces to handle each word individually
              const words = child.text.split(/(\s+)/);
              return (
                <React.Fragment key={childIndex}>
                  {words.map((word, wordIndex) => {
                    // For spaces, render them directly
                    if (/^\s+$/.test(word)) {
                      return (
                        <motion.span 
                          key={`${childIndex}-${wordIndex}`} 
                          className="whitespace-pre"
                          layout
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        >
                          {word}
                        </motion.span>
                      );
                    }
                    // For actual words, apply styling
                    return (
                      <motion.span 
                        key={`${childIndex}-${wordIndex}`} 
                        className={`${className || ''} inline-block`}
                        layout
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      >
                        {word}
                      </motion.span>
                    );
                  })}
                </React.Fragment>
              );
            }
            return null;
          })}
        </motion.span>
      );
    } else if (node.content) {
      // Split content by spaces if it's a string
      if (typeof node.content === 'string') {
        const words = node.content.split(/(\s+)/);
        return (
          <motion.span 
            className="inline-flex flex-wrap items-baseline"
            layout
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {words.map((word, wordIndex) => {
              if (/^\s+$/.test(word)) {
                return (
                  <motion.span 
                    key={wordIndex} 
                    className="whitespace-pre"
                    layout
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    {word}
                  </motion.span>
                );
              }
              return (
                <motion.span 
                  key={wordIndex} 
                  className="inline-block"
                  layout
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  {word}
                </motion.span>
              );
            })}
          </motion.span>
        );
      }
      return <motion.span layout>{node.content}</motion.span>;
    }
  }
  
  // For other node types, just return the content
  return <span>{node.content || ''}</span>;
};

// Render content based on node type
const renderNode = (node, viewMode, index) => {
  if (!node) return null;
  
  switch (node.type) {
    case nodeTypes.PARAGRAPH:
      return <ParagraphNode node={node} viewMode={viewMode} index={index} />;
    case nodeTypes.CODE_BLOCK:
      return <CodeBlockNode node={node} index={index} />;
    case nodeTypes.HEADING:
      return <HeadingNode node={node} index={index} />;
    case nodeTypes.LIST:
      return <ListNode node={node} index={index} />;
    case nodeTypes.LINK:
      return <LinkNode node={node} index={index} />;
    default:
      // For any other node type, render as plain text
      if (node.content) {
        return (
          <div className="relative group">
            <span className="absolute -left-6 top-[0.15rem] text-muted-foreground text-xs select-none">
              {index + 1}
            </span>
            <div>{node.content}</div>
          </div>
        );
      }
      return null;
  }
};

// Define the missing node components
const ParagraphNode = ({ node, index = 0, viewMode = 'default', isHighlighted = false }) => {
  const paragraphRef = useRef(null);
  const { lineMode } = useLineSettings();
  const [lineHovered, setLineHovered] = useState(false);
  
  // Get view mode specific styles
  const getViewModeStyles = () => {
    switch(viewMode) {
      case 'spaced':
        return 'my-4'; 
      case 'wrapped':
        return 'my-0.5'; 
      case 'default':
      default:
        return 'my-0 pl-6'; 
    }
  };
  
  // Set up scroll-based spring animation
  const { scrollY } = useScroll();
  const springConfig = { stiffness: 800, damping: 30 };
  const ySpring = useSpring(scrollY, springConfig);
  
  // Create a transform effect based on the paragraph's position
  const y = useTransform(
    ySpring,
    [0, 500, 1000], // Scroll range to watch (3 values)
    [0, 0, 0],      // Default values (3 values)
    (value) => {
      // Only calculate if we have a ref
      if (!paragraphRef.current) return 0;
      
      // Get the element's position relative to viewport
      const rect = paragraphRef.current.getBoundingClientRect();
      const viewportPosition = rect.top;
      
      // Calculate a spring effect based on viewport position
      // The closer to the center of the viewport, the less effect
      const viewportHeight = window.innerHeight;
      const viewportCenter = viewportHeight / 2;
      const distanceFromCenter = Math.abs(viewportPosition - viewportCenter);
      const normalizedDistance = Math.min(distanceFromCenter / viewportCenter, 1);
      
      // Apply a subtle spring effect (max 5px displacement)
      return normalizedDistance * 5 * (viewportPosition < viewportCenter ? -1 : 1);
    }
  );
  
  // Handle rendering of paragraph content
  const renderParagraphContent = () => {
    if (node.children && Array.isArray(node.children)) {
      return node.children.map((child, childIndex) => {
        if (child.type === 'link') {
          return <LinkNode key={childIndex} node={child} />;
        } else if (child.text) {
          let className = '';
          if (child.bold) className += ' font-bold';
          if (child.italic) className += ' italic';
          if (child.underline) className += ' underline';
          
          if (child.code) {
            return (
              <code 
                key={childIndex} 
                className="px-1.5 py-0.5 mx-0.5 rounded bg-muted font-mono"
              >
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
      });
    } else if (node.content) {
      return node.content;
    }
    return null;
  };
  
  return (
    <motion.div 
      ref={paragraphRef}
      className={`relative group ${getViewModeStyles()} ${isHighlighted ? 'bg-accent/20' : ''}`}
      style={{ y }}
      onMouseEnter={() => setLineHovered(true)}
      onMouseLeave={() => setLineHovered(false)}
      layout
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30 
      }}
    >
      <motion.span 
        className={`absolute -left-6 top-[0.15rem] text-muted-foreground text-xs select-none px-1.5 py-0.5 rounded-full ${lineHovered ? 'bg-muted/30 opacity-100' : 'opacity-60'}`}
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {index + 1}
      </motion.span>
      <motion.div 
        className={`${lineHovered ? 'bg-muted/20 rounded' : ''}`}
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {renderParagraphContent()}
      </motion.div>
    </motion.div>
  );
};

const CodeBlockNode = ({ node, language, index = 0 }) => {
  // If language is not provided, try to extract it from the node
  const codeLanguage = language || node.language || 'javascript';
  
  return (
    <div className="relative my-4 group">
      <span className="absolute -left-6 top-[0.15rem] text-muted-foreground text-xs select-none">
        {index + 1}
      </span>
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
    </div>
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
    <div className="relative group">
      <span className="absolute -left-6 top-[0.15rem] text-muted-foreground text-xs select-none">
        {index + 1}
      </span>
      <HeadingTag className={headingClasses[level]}>
        {node.content || (node.children && node.children.map(child => child.text).join('')) || ''}
      </HeadingTag>
    </div>
  );
};

const ListNode = ({ node, index = 0 }) => {
  const isOrdered = node.ordered || false;
  const ListTag = isOrdered ? 'ol' : 'ul';
  
  return (
    <div className="relative my-4 group">
      <span className="absolute -left-6 top-0 text-muted-foreground text-xs select-none">
        {index + 1}
      </span>
      <ListTag className={isOrdered ? 'list-decimal pl-5' : 'list-disc pl-5'}>
        {node.children && node.children.map((item, i) => (
          <li key={i} className="my-1">
            {item.content || (item.children && item.children.map(child => child.text).join('')) || ''}
          </li>
        ))}
      </ListTag>
    </div>
  );
};

const LinkNode = ({ node, index }) => {
  const href = node.url || node.href || node.link || '#';
  const pageId = extractPageId(href);
  
  // For internal links, use the InternalLinkWithTitle component
  if (pageId) {
    return (
      <motion.span 
        className="inline-block"
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <InternalLinkWithTitle pageId={pageId} href={href} displayText={node.displayText || node.text} />
      </motion.span>
    );
  }
  
  // For external links, use the PillLink component
  return (
    <motion.span 
      className="inline-block"
      layout
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <PillLink href={href} isPublic={true} className="inline">
        {node.displayText || node.text || node.content || href}
      </PillLink>
    </motion.span>
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
