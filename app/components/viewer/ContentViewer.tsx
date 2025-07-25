'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLineSettings, LINE_MODES } from '../../contexts/LineSettingsContext';
import { CONTENT_TYPES } from '../../utils/constants';
// Content parsing utility - inline implementation
import { PillLink } from '../utils/PillLink';

/**
 * Simple content parser for viewer
 */
const parseContent = (content: any): any[] | null => {
  if (!content) return null;

  // If it's already an array, return it
  if (Array.isArray(content)) {
    return content;
  }

  // If it's a string, try to parse it
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // If parsing fails, create a simple paragraph
      return [{
        type: CONTENT_TYPES.PARAGRAPH,
        children: [{ text: content }]
      }];
    }
  }

  // If it's an object, wrap it in an array
  if (typeof content === 'object') {
    return [content];
  }

  return null;
};

interface ContentViewerProps {
  content: any[];
  isSearch?: boolean;
  onRenderComplete?: () => void;
  showDiff?: boolean;
  showLineNumbers?: boolean;
  className?: string;
}

/**
 * ContentViewer - Pure viewing component for WeWrite content
 * 
 * This component is specifically designed for viewing content without any editing capabilities.
 * It provides a clean, distraction-free reading experience with support for dense mode toggle.
 * 
 * Key Features:
 * - Clean viewing experience without editor borders or input styling
 * - Dense mode toggle for compact reading
 * - Proper link rendering and navigation
 * - Line numbers for reference
 * - Responsive design
 * - No editing capabilities or hover states
 */
const ContentViewer: React.FC<ContentViewerProps> = ({
  content,
  isSearch = false,
  onRenderComplete,
  showDiff = false,
  showLineNumbers = true,
  className = ''
}) => {
  const { lineMode } = useLineSettings();
  const [parsedContents, setParsedContents] = useState<any[] | null>(null);
  const [loadedParagraphs, setLoadedParagraphs] = useState<number[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);

  console.log('🔍 ContentViewer: Rendering with content:', {
    content,
    contentType: typeof content,
    isArray: Array.isArray(content),
    contentLength: content ? (Array.isArray(content) ? content.length : content.length) : 0,
    lineMode
  });

  // Parse content when it changes
  useEffect(() => {
    if (content) {
      try {
        const parsed = parseContent(content);
        setParsedContents(parsed);
        
        // Load all paragraphs immediately for viewing
        if (parsed && Array.isArray(parsed)) {
          const paragraphIndices = parsed
            .map((node, index) => node.type === CONTENT_TYPES.PARAGRAPH ? index : -1)
            .filter(index => index !== -1);
          setLoadedParagraphs(paragraphIndices);
        }
      } catch (error) {
        console.error('ContentViewer: Error parsing content:', error);
        setParsedContents(null);
      }
    } else {
      setParsedContents(null);
      setLoadedParagraphs([]);
    }
  }, [content]);

  // Handle scroll detection for styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Notify when rendering is complete
  useEffect(() => {
    if (parsedContents && onRenderComplete) {
      onRenderComplete();
    }
  }, [parsedContents, onRenderComplete]);

  // Create a unique key that changes when lineMode changes to force complete re-render
  const renderKey = useMemo(() => `content-viewer-${lineMode}`, [lineMode]);

  // Get viewer-specific styles (no borders, no input styling)
  const getViewerStyles = useMemo(() => {
    const modeClass = lineMode === LINE_MODES.DENSE ? 'dense-mode' : 'normal-mode';
    return `wewrite-viewer-content ${modeClass}`;
  }, [lineMode]);

  // Render content based on mode
  if (lineMode === LINE_MODES.DENSE) {
    // Dense mode: continuous text with inline paragraph numbers
    return (
      <div
        key={`contentviewer-dense`}
        className={`wewrite-viewer-container ${className}`}
      >
        <div
          className={`${getViewerStyles} w-full text-left ${
            isScrolled ? 'pb-16' : ''
          }`}
          data-mode={lineMode}
        >
          {!parsedContents && !isSearch && (
            <div className="text-muted-foreground">
              <span className="text-sm">No content available</span>
            </div>
          )}

          {parsedContents && (
            <ViewerContent
              key={`${renderKey}-${lineMode}`}
              contents={parsedContents}
              loadedParagraphs={loadedParagraphs}
              effectiveMode={lineMode}
              showDiff={showDiff}
              showLineNumbers={showLineNumbers}
            />
          )}
        </div>
      </div>
    );
  }

  // Normal mode: standard block layout
  return (
    <div
      key={`contentviewer-normal`}
      className={`wewrite-viewer-container ${className}`}
    >
      <div
        className={`${getViewerStyles} w-full text-left ${
          isScrolled ? 'pb-16' : ''
        }`}
        data-mode={lineMode}
      >
        {!parsedContents && !isSearch && (
          <div className="text-muted-foreground">
            <div className="viewer-paragraph">
              {showLineNumbers && <span className="paragraph-number">1</span>}
              <span className="viewer-text-content">No content available</span>
            </div>
          </div>
        )}

        {parsedContents && (
          <ViewerContent
            key={`${renderKey}-${lineMode}`}
            contents={parsedContents}
            loadedParagraphs={loadedParagraphs}
            effectiveMode={lineMode}
            showDiff={showDiff}
            showLineNumbers={showLineNumbers}
          />
        )}
      </div>
    </div>
  );
};

/**
 * ViewerContent - Renders parsed content for viewing
 */
const ViewerContent = ({ 
  contents, 
  loadedParagraphs, 
  effectiveMode, 
  showDiff = false, 
  showLineNumbers = true 
}) => {
  try {
    if (!contents) return null;

    if (Array.isArray(contents)) {
      // Dense mode: render as continuous text with inline paragraph numbers
      if (effectiveMode === LINE_MODES.DENSE) {
        const paragraphNodes = contents.filter(node => node.type === CONTENT_TYPES.PARAGRAPH);
        const loadedNodes = paragraphNodes.filter((_, index) => loadedParagraphs.includes(index));

        return (
          <div className="dense-content-flow">
            {loadedNodes.map((node, index) => (
              <ViewerParagraphNode
                key={`dense-${index}`}
                node={node}
                index={index}
                showDiff={showDiff}
                showLineNumbers={showLineNumbers}
                isDense={true}
              />
            ))}
          </div>
        );
      }

      // Normal mode: standard paragraph blocks
      const paragraphNodes = contents.filter(node => node.type === CONTENT_TYPES.PARAGRAPH);
      const loadedNodes = paragraphNodes.filter((_, index) => loadedParagraphs.includes(index));

      return (
        <div className="normal-content-flow">
          {loadedNodes.map((node, index) => (
            <ViewerParagraphNode
              key={`normal-${index}`}
              node={node}
              index={index}
              showDiff={showDiff}
              showLineNumbers={showLineNumbers}
              isDense={false}
            />
          ))}
        </div>
      );
    }

    return null;
  } catch (error) {
    console.error('ViewerContent: Error rendering content:', error);
    return (
      <div className="text-muted-foreground">
        <span className="text-sm">Error displaying content</span>
      </div>
    );
  }
};

/**
 * ViewerParagraphNode - Renders a single paragraph for viewing
 */
const ViewerParagraphNode = ({ 
  node, 
  index = 0, 
  showDiff = false, 
  showLineNumbers = true,
  isDense = false 
}) => {
  const paragraphRef = useRef(null);

  // Render paragraph content
  const renderParagraphContent = () => {
    if (!node.children || !Array.isArray(node.children)) {
      return <span className="viewer-text-content">Empty paragraph</span>;
    }

    return node.children.map((child, childIndex) => {
      if (child.type === 'link') {
        return (
          <PillLink
            key={`link-${childIndex}`}
            href={child.href || child.url || '#'}
            pageId={child.pageId}
            isPublic={child.isPublic}
            isEditing={false}
            className="viewer-pill-link"
          >
            {child.children?.[0]?.text || child.text || 'Link'}
          </PillLink>
        );
      }

      // Regular text node
      return (
        <span key={`text-${childIndex}`} className="viewer-text-content">
          {child.text || ''}
        </span>
      );
    });
  };

  // Render paragraph with proper structure
  return (
    <div
      ref={paragraphRef}
      className={`viewer-paragraph ${isDense ? 'dense-paragraph' : 'normal-paragraph'}`}
      data-paragraph-index={index}
    >
      {/* Paragraph number - show if enabled */}
      {showLineNumbers && (
        <span className="paragraph-number">
          {index + 1}
        </span>
      )}

      {/* Paragraph content */}
      <span className="paragraph-content">
        {renderParagraphContent()}
      </span>
    </div>
  );
};

export default ContentViewer;
