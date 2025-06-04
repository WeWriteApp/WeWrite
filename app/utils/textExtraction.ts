/**
 * Unified text extraction utilities for WeWrite
 * Consolidates text extraction logic from multiple files
 */

import type { SlateContent } from '../types/database';

/**
 * Extracts plain text from Slate content structure
 * @param content - Slate content array or string
 * @returns Plain text string
 */
export function extractTextFromSlate(content: SlateContent | string): string {
  if (!content) return '';

  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return extractTextFromSlate(parsed);
    } catch {
      return content;
    }
  }

  if (!Array.isArray(content)) return '';

  let text = '';

  for (const node of content) {
    if ((node as any).text) {
      text += (node as any).text;
    } else if ((node as any).children) {
      text += extractTextFromSlate((node as any).children);
    }
  }

  return text;
}

/**
 * Extracts text from children nodes (for diff operations)
 * @param children - Array of child nodes
 * @returns Plain text string
 */
export function extractTextFromChildren(children: any[]): string {
  if (!children || !Array.isArray(children)) return '';
  
  return children
    .map(child => {
      if (child.text) return child.text;
      if (child.children) return extractTextFromChildren(child.children);
      return '';
    })
    .join('');
}

/**
 * Comprehensive text extraction that handles various content formats
 * @param content - Content in various formats
 * @returns Plain text string
 */
export function extractTextContent(content: any): string {
  if (!content) return '';
  
  // Handle string content
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return extractTextContent(parsed);
    } catch {
      return content;
    }
  }
  
  // Handle array content (Slate format)
  if (Array.isArray(content)) {
    return extractTextFromSlate(content);
  }
  
  // Handle object content
  if (typeof content === 'object') {
    // Check if it's a Slate node
    if (content.text) return content.text;
    if (content.children) return extractTextFromChildren(content.children);
    
    // Try to extract text from object properties
    const textFields = ['text', 'content', 'body', 'description'];
    for (const field of textFields) {
      if (content[field]) {
        return extractTextContent(content[field]);
      }
    }
    
    // Last resort: stringify the object
    return JSON.stringify(content);
  }
  
  return String(content);
}

/**
 * Extracts a clean description from content with length limit
 * @param content - Content to extract description from
 * @param maxLength - Maximum length of description
 * @returns Clean description string
 */
export function extractDescription(content: any, maxLength: number = 160): string {
  const text = extractTextContent(content);
  
  // Clean up the text
  const cleanText = text
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();
  
  // Truncate if necessary
  if (cleanText.length <= maxLength) {
    return cleanText;
  }
  
  // Find the last complete word within the limit
  const truncated = cleanText.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > maxLength * 0.8) {
    return truncated.substring(0, lastSpaceIndex) + '...';
  }
  
  return truncated + '...';
}

/**
 * Counts characters in content (for diff operations)
 * @param content - Content to count
 * @returns Character count
 */
export function countCharacters(content: any): number {
  return extractTextContent(content).length;
}

/**
 * Counts words in content
 * @param content - Content to count
 * @returns Word count
 */
export function countWords(content: any): number {
  const text = extractTextContent(content);
  if (!text.trim()) return 0;
  
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length;
}
