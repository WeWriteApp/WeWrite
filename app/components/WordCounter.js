"use client";

import React, { useMemo } from 'react';

/**
 * WordCounter Component
 *
 * Displays word count and character count for a given text content.
 *
 * @param {string} content - The text content to analyze
 */
export default function WordCounter({ content }) {
  const { wordCount, charCount } = useMemo(() => {
    if (!content) {
      return { wordCount: 0, charCount: 0 };
    }

    // Handle content as string or JSON
    let textContent = '';

    if (typeof content === 'string') {
      textContent = content;
    } else if (typeof content === 'object') {
      try {
        // Extract text from editor state format
        if (Array.isArray(content)) {
          // Process each paragraph
          textContent = content.map(paragraph => {
            // Handle different node types
            if (paragraph.type === 'paragraph') {
              return paragraph.children?.map(child => child.text || '').join('') || '';
            } else if (paragraph.type === 'code') {
              return paragraph.code || '';
            } else if (paragraph.type === 'quote') {
              return paragraph.children?.map(child => child.text || '').join('') || '';
            } else if (paragraph.text) {
              return paragraph.text;
            } else if (typeof paragraph === 'string') {
              return paragraph;
            }
            return '';
          }).join(' ');
        } else if (content.children) {
          // Handle nested structure
          const extractText = (node) => {
            if (!node) return '';
            if (typeof node === 'string') return node;
            if (node.text) return node.text;
            if (node.children) {
              return node.children.map(child => extractText(child)).join(' ');
            }
            return '';
          };
          textContent = extractText(content);
        }
      } catch (error) {
        console.error('Error extracting text from content:', error);
        // Fallback to JSON string if extraction fails
        textContent = JSON.stringify(content);
      }
    }

    // Remove extra whitespace and count words
    const cleanText = textContent.trim().replace(/\\s+/g, ' ');
    const words = cleanText ? cleanText.split(' ').filter(word => word.length > 0) : [];

    return {
      wordCount: words.length,
      charCount: cleanText.length
    };
  }, [content]);

  if (!content) return null;

  return (
    <div className="text-sm text-muted-foreground flex gap-3">
      <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
      <span>•</span>
      <span>{charCount} {charCount === 1 ? 'character' : 'characters'}</span>
    </div>
  );
}
