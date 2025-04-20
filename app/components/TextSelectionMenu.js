"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Link } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const TextSelectionMenu = ({ contentRef }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState(null);
  const menuRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      
      if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
        setIsVisible(false);
        return;
      }

      // Check if selection is within the content area
      if (!contentRef.current) return;
      
      const range = selection.getRangeAt(0);
      const contentElement = contentRef.current;
      
      // Check if the selection is within the content element
      if (!contentElement.contains(range.commonAncestorContainer)) {
        setIsVisible(false);
        return;
      }
      
      // Check if selection includes paragraph numbers (which should be excluded)
      const paragraphNumbers = contentElement.querySelectorAll('.paragraph-number');
      let includesParagraphNumber = false;
      
      paragraphNumbers.forEach(numElement => {
        if (selection.containsNode(numElement, true)) {
          includesParagraphNumber = true;
        }
      });
      
      if (includesParagraphNumber) {
        // Don't show menu if selection includes paragraph numbers
        setIsVisible(false);
        return;
      }

      // Get selection text and position
      const selectedText = selection.toString().trim();
      if (selectedText) {
        const rect = range.getBoundingClientRect();
        
        // Position the menu above the selection
        setPosition({
          top: rect.top + window.scrollY - 45, // Position above selection
          left: rect.left + window.scrollX + (rect.width / 2) - 75, // Center horizontally
        });
        
        setSelectedText(selectedText);
        setSelectionRange(range.cloneRange()); // Store a copy of the range
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // Handle clicks outside the menu to close it
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsVisible(false);
      }
    };

    // Add event listeners
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleSelectionChange);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contentRef]);

  const copyText = () => {
    navigator.clipboard.writeText(selectedText)
      .then(() => {
        toast.success('Text copied to clipboard');
        setIsVisible(false);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        toast.error('Failed to copy text');
      });
  };

  const copyLink = () => {
    // Get current URL
    const currentUrl = window.location.href;
    
    // Create a unique identifier for this selection
    // For simplicity, we'll use a hash of the selected text
    const selectionHash = btoa(selectedText.substring(0, 100)).replace(/[+/=]/g, '');
    
    // Create the link with the selection hash
    const linkWithSelection = `${currentUrl}#highlight=${selectionHash}`;
    
    // Store the selection in sessionStorage for retrieval when the link is visited
    sessionStorage.setItem(`highlight_${selectionHash}`, selectedText);
    
    // Copy the link to clipboard
    navigator.clipboard.writeText(linkWithSelection)
      .then(() => {
        toast.success('Link copied to clipboard');
        setIsVisible(false);
      })
      .catch(err => {
        console.error('Failed to copy link: ', err);
        toast.error('Failed to copy link');
      });
  };

  // Don't render anything if not visible
  if (!isVisible) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-background border border-border rounded-md shadow-md py-2 px-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-5 duration-200"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <button
        onClick={copyText}
        className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
        title="Copy text"
      >
        <Copy className="h-4 w-4" />
        <span>Copy</span>
      </button>
      <div className="h-4 w-px bg-border"></div>
      <button
        onClick={copyLink}
        className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
        title="Copy link to selection"
      >
        <Link className="h-4 w-4" />
        <span>Copy link</span>
      </button>
    </div>
  );
};

export default TextSelectionMenu;
