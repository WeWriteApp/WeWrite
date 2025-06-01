"use client";

/**
 * Heading hierarchy validation and optimization utilities for SEO
 */

/**
 * Validates heading hierarchy on a page
 * 
 * @param {HTMLElement} container - Container element to check (defaults to document)
 * @returns {Object} - Validation result with issues and suggestions
 */
export function validateHeadingHierarchy(container = document) {
  if (typeof window === 'undefined') return { valid: true, issues: [] };
  
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const issues = [];
  const suggestions = [];
  
  if (headings.length === 0) {
    return {
      valid: false,
      issues: ['No headings found on the page'],
      suggestions: ['Add at least one H1 heading for the main page title']
    };
  }
  
  // Check for H1
  const h1Elements = container.querySelectorAll('h1');
  if (h1Elements.length === 0) {
    issues.push('No H1 heading found');
    suggestions.push('Add an H1 heading for the main page title');
  } else if (h1Elements.length > 1) {
    issues.push(`Multiple H1 headings found (${h1Elements.length})`);
    suggestions.push('Use only one H1 heading per page');
  }
  
  // Check heading sequence
  let previousLevel = 0;
  headings.forEach((heading, index) => {
    const currentLevel = parseInt(heading.tagName.charAt(1));
    
    if (index === 0 && currentLevel !== 1) {
      issues.push(`First heading is H${currentLevel}, should be H1`);
      suggestions.push('Start with an H1 heading');
    }
    
    if (currentLevel > previousLevel + 1) {
      issues.push(`Heading level jumps from H${previousLevel} to H${currentLevel}`);
      suggestions.push(`Use sequential heading levels (H${previousLevel} → H${previousLevel + 1})`);
    }
    
    // Check for empty headings
    if (!heading.textContent.trim()) {
      issues.push(`Empty H${currentLevel} heading found`);
      suggestions.push('Remove empty headings or add descriptive text');
    }
    
    previousLevel = currentLevel;
  });
  
  return {
    valid: issues.length === 0,
    issues,
    suggestions,
    headingCount: headings.length,
    h1Count: h1Elements.length
  };
}

/**
 * Generates a table of contents from headings
 * 
 * @param {HTMLElement} container - Container element to scan
 * @param {Object} options - TOC generation options
 * @returns {Array} - Array of TOC items
 */
export function generateTableOfContents(container = document, options = {}) {
  if (typeof window === 'undefined') return [];
  
  const {
    minLevel = 2,
    maxLevel = 4,
    includeH1 = false
  } = options;
  
  const selector = includeH1 
    ? `h1, h2, h3, h4, h5, h6`
    : `h2, h3, h4, h5, h6`;
    
  const headings = container.querySelectorAll(selector);
  const toc = [];
  
  headings.forEach((heading, index) => {
    const level = parseInt(heading.tagName.charAt(1));
    
    if (level >= minLevel && level <= maxLevel) {
      // Generate ID if not present
      if (!heading.id) {
        heading.id = generateHeadingId(heading.textContent);
      }
      
      toc.push({
        id: heading.id,
        text: heading.textContent.trim(),
        level: level,
        element: heading
      });
    }
  });
  
  return toc;
}

/**
 * Generates a URL-friendly ID from heading text
 * 
 * @param {string} text - Heading text
 * @returns {string} - URL-friendly ID
 */
function generateHeadingId(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Adds proper heading structure to Slate content
 * 
 * @param {Array} slateContent - Slate content nodes
 * @returns {Array} - Optimized Slate content with proper headings
 */
export function optimizeSlateHeadings(slateContent) {
  if (!Array.isArray(slateContent)) return slateContent;
  
  let hasH1 = false;
  let lastHeadingLevel = 0;
  
  return slateContent.map(node => {
    if (node.type && node.type.startsWith('heading-')) {
      const level = parseInt(node.type.split('-')[1]);
      
      // Ensure first heading is H1
      if (!hasH1 && level !== 1) {
        hasH1 = true;
        return {
          ...node,
          type: 'heading-1'
        };
      }
      
      if (level === 1) {
        hasH1 = true;
      }
      
      // Prevent level jumping
      if (level > lastHeadingLevel + 1) {
        const correctedLevel = Math.min(level, lastHeadingLevel + 1);
        lastHeadingLevel = correctedLevel;
        return {
          ...node,
          type: `heading-${correctedLevel}`
        };
      }
      
      lastHeadingLevel = level;
    }
    
    return node;
  });
}

/**
 * Extracts heading outline from content for SEO
 * 
 * @param {Array|string} content - Slate content or HTML string
 * @returns {Array} - Heading outline
 */
export function extractHeadingOutline(content) {
  if (!content) return [];
  
  let headings = [];
  
  if (typeof content === 'string') {
    // Parse HTML string
    if (typeof window !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const headingElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
      
      headings = Array.from(headingElements).map(el => ({
        level: parseInt(el.tagName.charAt(1)),
        text: el.textContent.trim()
      }));
    }
  } else if (Array.isArray(content)) {
    // Parse Slate content
    headings = extractHeadingsFromSlate(content);
  }
  
  return headings;
}

/**
 * Extracts headings from Slate content
 * 
 * @param {Array} nodes - Slate nodes
 * @returns {Array} - Heading objects
 */
function extractHeadingsFromSlate(nodes) {
  const headings = [];
  
  function traverse(nodeArray) {
    nodeArray.forEach(node => {
      if (node.type && node.type.startsWith('heading-')) {
        const level = parseInt(node.type.split('-')[1]);
        const text = extractTextFromNode(node);
        
        if (text.trim()) {
          headings.push({
            level,
            text: text.trim()
          });
        }
      }
      
      if (node.children) {
        traverse(node.children);
      }
    });
  }
  
  traverse(nodes);
  return headings;
}

/**
 * Extracts text from a Slate node
 * 
 * @param {Object} node - Slate node
 * @returns {string} - Extracted text
 */
function extractTextFromNode(node) {
  if (node.text !== undefined) {
    return node.text;
  }
  
  if (node.children) {
    return node.children.map(extractTextFromNode).join('');
  }
  
  return '';
}

/**
 * Validates heading accessibility
 * 
 * @param {HTMLElement} container - Container to check
 * @returns {Object} - Accessibility validation result
 */
export function validateHeadingAccessibility(container = document) {
  if (typeof window === 'undefined') return { valid: true, issues: [] };
  
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const issues = [];
  
  headings.forEach(heading => {
    // Check for proper contrast (basic check)
    const styles = window.getComputedStyle(heading);
    const fontSize = parseFloat(styles.fontSize);
    
    if (fontSize < 16) {
      issues.push(`Heading "${heading.textContent.trim()}" has small font size (${fontSize}px)`);
    }
    
    // Check for descriptive text
    const text = heading.textContent.trim();
    if (text.length < 3) {
      issues.push(`Heading "${text}" is too short to be descriptive`);
    }
    
    // Check for generic headings
    const genericTerms = ['heading', 'title', 'section', 'content'];
    if (genericTerms.some(term => text.toLowerCase().includes(term))) {
      issues.push(`Heading "${text}" uses generic terminology`);
    }
  });
  
  return {
    valid: issues.length === 0,
    issues
  };
}
