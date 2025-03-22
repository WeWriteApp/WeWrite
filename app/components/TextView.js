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
  const [loadedParagraphs, setLoadedParagraphs] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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
      const loadingDelay = 30; // ms between each paragraph appearance
      
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
        <RenderContent contents={parsedContents} language={language} viewMode={viewMode} loadedParagraphs={loadedParagraphs} />
      )}
    </motion.div>
  );
};

export const RenderContent = ({ contents, language, viewMode = 'default', loadedParagraphs }) => {
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
            <div className="flex flex-wrap items-baseline">
              {contents.map((node, index) => (
                <React.Fragment key={index}>
                  {/* Paragraph number */}
                  <span className="text-muted-foreground text-xs select-none flex-shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-background/50 border border-border/30 mr-2">
                    {index + 1}
                  </span>
                  
                  {/* Paragraph content with hover highlight */}
                  <div className="group inline-flex flex-wrap items-baseline hover:bg-muted/30 rounded transition-colors">
                    <WrappedNode node={node} index={index} />
                  </div>
                </React.Fragment>
              ))}
            </div>
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
            {loadedParagraphs.includes(index) && renderNode(node, viewMode, index)}
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
        <span className="inline-flex flex-wrap items-baseline w-full max-w-full break-words">
          {node.children.map((child, childIndex) => {
            if (child.type === 'link') {
              return (
                <span key={childIndex} className="inline-block">
                  <LinkNode node={child} />
                </span>
              );
            } else if (child.text) {
              let className = '';
              if (child.bold) className += ' font-bold';
              if (child.italic) className += ' italic';
              if (child.underline) className += ' underline';
              
              if (child.code) {
                return (
                  <code key={childIndex} className="px-1 py-0.5 rounded bg-muted font-mono break-all">
                    {child.text}
                  </code>
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
                        <span key={`${childIndex}-${wordIndex}`} className="whitespace-pre">
                          {word}
                        </span>
                      );
                    }
                    // For actual words, apply styling
                    return (
                      <span key={`${childIndex}-${wordIndex}`} className={`${className || ''} inline-block break-words`}>
                        {word}
                      </span>
                    );
                  })}
                </React.Fragment>
              );
            }
            return null;
          })}
        </span>
      );
    } else if (node.content) {
      // Split content by spaces if it's a string
      if (typeof node.content === 'string') {
        const words = node.content.split(/(\s+)/);
        return (
          <span className="inline-flex flex-wrap items-baseline w-full max-w-full break-words">
            {words.map((word, wordIndex) => {
              if (/^\s+$/.test(word)) {
                return (
                  <span key={wordIndex} className="whitespace-pre">
                    {word}
                  </span>
                );
              }
              return (
                <span key={wordIndex} className="inline-block break-words">
                  {word}
                </span>
              );
            })}
          </span>
        );
      }
      return <span>{node.content}</span>;
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
const ParagraphNode = ({ node, viewMode = 'default', index = 0 }) => {
  const paragraphRef = useRef(null);
  const { lineMode } = useLineSettings();
  const [lineHovered, setLineHovered] = useState(false);
  
  // Determine spacing based on view mode
  const spacingClasses = {
    'default': 'mb-3',
    'spaced': 'mb-6 max-w-3xl mx-auto',
    'wrapped': 'mb-0'
  };
  
  // Get the appropriate spacing class
  const spacingClass = spacingClasses[viewMode] || spacingClasses['default'];
  
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
  
  return (
    <motion.div 
      className={`group relative ${spacingClass}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 500, 
        damping: 30,
        mass: 1
      }}
    >
      {/* Paragraph number */}
      <motion.div 
        className="absolute left-0 top-0 flex items-center justify-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          delay: 0.05,
          type: "spring", 
          stiffness: 500, 
          damping: 30 
        }}
      >
        <span className="text-muted-foreground text-xs select-none inline-flex items-center justify-center h-5 w-5 rounded-full bg-background/50 border border-border/30 mr-2">
          {index + 1}
        </span>
      </motion.div>
      
      {/* Paragraph content with left padding for the number */}
      <p className={`pl-8 ${viewMode === 'wrapped' ? 'whitespace-normal break-words' : ''}`}>
        {node.children && node.children.map((child, i) => renderChild(child, i))}
      </p>
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
        stiffness: 500, 
        damping: 30,
        mass: 1
      }}
    >
      <motion.span 
        className="absolute -left-6 top-[0.15rem] text-muted-foreground text-xs select-none"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          delay: 0.05,
          type: "spring", 
          stiffness: 500, 
          damping: 30 
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
        stiffness: 500, 
        damping: 30,
        mass: 1
      }}
    >
      <motion.span 
        className="absolute -left-6 top-[0.15rem] text-muted-foreground text-xs select-none"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          delay: 0.05,
          type: "spring", 
          stiffness: 500, 
          damping: 30 
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
        stiffness: 500, 
        damping: 30,
        mass: 1
      }}
    >
      <motion.span 
        className="absolute -left-6 top-[0.15rem] text-muted-foreground text-xs select-none"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          delay: 0.05,
          type: "spring", 
          stiffness: 500, 
          damping: 30 
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
