"use client";

import React, { useMemo } from 'react';

interface EditorNode {
  type?: string;
  text?: string;
  code?: string;
  children?: EditorNode[];
}

interface WordCounterProps {
  content: string | EditorNode[] | EditorNode | null | undefined;
}

/**
 * WordCounter Component
 *
 * Displays word count and character count for a given text content.
 */
export default function WordCounter({ content }: WordCounterProps) {
  const wordCount = useMemo(() => {
    if (!content) {
      return 0;
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
        } else if ((content as EditorNode).children) {
          // Handle nested structure
          const extractText = (node: EditorNode | string | null): string => {
            if (!node) return '';
            if (typeof node === 'string') return node;
            if (node.text) return node.text;
            if (node.children) {
              return node.children.map(child => extractText(child)).join(' ');
            }
            return '';
          };
          textContent = extractText(content as EditorNode);
        }
      } catch (error) {
        console.error('Error extracting text from content:', error);
        // Fallback to JSON string if extraction fails
        textContent = JSON.stringify(content);
      }
    }

    // Improved word counting algorithm
    // Remove extra whitespace, split by whitespace, and filter out empty strings
    const cleanText = textContent.trim().replace(/\s+/g, ' ');

    // Split by whitespace and filter out empty strings and non-word characters
    const words = cleanText
      ? cleanText.split(/\s+/)
        .filter(word => word.length > 0 && /\w+/.test(word))
      : [];

    return words.length;
  }, [content]);

  if (!content) return null;

  return (
    <div className="text-sm text-muted-foreground w-full text-center">
      <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
    </div>
  );
}
