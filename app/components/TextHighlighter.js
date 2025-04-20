"use client";

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const TextHighlighter = ({ contentRef }) => {
  const [highlightedText, setHighlightedText] = useState('');
  const [isHighlighting, setIsHighlighting] = useState(false);

  useEffect(() => {
    // Check if there's a highlight parameter in the URL
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.includes('highlight=')) {
        const highlightId = hash.split('highlight=')[1];
        
        // Get the highlighted text from sessionStorage
        const storedHighlight = sessionStorage.getItem(`highlight_${highlightId}`);
        
        if (storedHighlight) {
          setHighlightedText(storedHighlight);
          setIsHighlighting(true);
          
          // Highlight the text in the content
          highlightTextInContent(storedHighlight);
        }
      }
    }
  }, [contentRef]);

  const highlightTextInContent = (text) => {
    if (!contentRef.current || !text) return;
    
    // Wait for content to be fully rendered
    setTimeout(() => {
      const contentElement = contentRef.current;
      const contentText = contentElement.textContent;
      
      // Find the text in the content
      const textIndex = contentText.indexOf(text);
      
      if (textIndex !== -1) {
        // Create a range for the text
        const range = document.createRange();
        const textNodes = [];
        
        // Get all text nodes in the content
        const walker = document.createTreeWalker(
          contentElement,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        let node;
        while (node = walker.nextNode()) {
          textNodes.push(node);
        }
        
        // Find the node(s) containing the text
        let currentIndex = 0;
        let startNode = null;
        let startOffset = 0;
        let endNode = null;
        let endOffset = 0;
        
        for (const node of textNodes) {
          const nodeText = node.textContent;
          const nodeLength = nodeText.length;
          
          // Check if this node contains the start of the text
          if (!startNode && textIndex >= currentIndex && textIndex < currentIndex + nodeLength) {
            startNode = node;
            startOffset = textIndex - currentIndex;
          }
          
          // Check if this node contains the end of the text
          const textEnd = textIndex + text.length - 1;
          if (startNode && !endNode && textEnd >= currentIndex && textEnd < currentIndex + nodeLength) {
            endNode = node;
            endOffset = (textEnd - currentIndex) + 1;
            break;
          }
          
          currentIndex += nodeLength;
        }
        
        // If we found the text, highlight it
        if (startNode && endNode) {
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
          
          // Create a selection and highlight it
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          
          // Scroll to the highlighted text
          const rect = range.getBoundingClientRect();
          window.scrollTo({
            top: rect.top + window.scrollY - 100,
            behavior: 'smooth'
          });
        }
      }
    }, 500);
  };

  const dismissHighlight = () => {
    // Clear the selection
    window.getSelection().removeAllRanges();
    
    // Remove the highlight parameter from the URL
    if (typeof window !== 'undefined') {
      const url = window.location.href.split('#')[0];
      window.history.replaceState({}, document.title, url);
    }
    
    setIsHighlighting(false);
    setHighlightedText('');
  };

  if (!isHighlighting) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-primary text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <span className="text-sm">Highlighted text</span>
      <button
        onClick={dismissHighlight}
        className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors"
        aria-label="Dismiss highlight"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default TextHighlighter;
