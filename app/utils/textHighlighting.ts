"use client";

/**
 * Unified Text Highlighting Utilities
 * 
 * This module consolidates all text highlighting functionality including:
 * - URL-based text highlighting
 * - Visual overlay highlighting
 * - Search result highlighting
 * - Text selection highlighting
 */

export interface HighlightInfo {
  text: string;
  timestamp: number;
  username?: string;
  url: string;
  hash: string;
}

export interface HighlightOptions {
  scrollToHighlight?: boolean;
  showNotification?: boolean;
  overlayStyle?: 'default' | 'search' | 'selection';
  isDarkMode?: boolean;
}

/**
 * Creates a hash for text selection to use as a unique identifier
 */
export function createTextHash(text: string): string {
  return btoa(text).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
}

/**
 * Stores highlight information in localStorage
 */
export function storeHighlight(text: string, username?: string): string {
  const hash = createTextHash(text);
  const highlightInfo: HighlightInfo = {
    text,
    timestamp: Date.now(),
    username,
    url: window.location.href.split('#')[0],
    hash
  };
  
  localStorage.setItem(`highlight_${hash}`, JSON.stringify(highlightInfo));
  return hash;
}

/**
 * Retrieves highlight information from localStorage
 */
export function getStoredHighlight(hash: string): HighlightInfo | null {
  try {
    const stored = localStorage.getItem(`highlight_${hash}`);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    
    // Handle legacy format (plain text)
    if (typeof parsed === 'string') {
      return {
        text: parsed,
        timestamp: Date.now(),
        url: window.location.href.split('#')[0],
        hash
      };
    }
    
    return parsed;
  } catch (error) {
    console.error('Error retrieving highlight:', error);
    return null;
  }
}

/**
 * Creates a shareable link with highlight parameter
 */
export function createShareableLink(text: string, username?: string): string {
  const hash = storeHighlight(text, username);
  const currentUrl = window.location.href.split('#')[0];
  return `${currentUrl}#highlight=${hash}`;
}

/**
 * Extracts highlight hash from URL
 */
export function getHighlightHashFromUrl(): string | null {
  const hash = window.location.hash;
  if (hash && hash.includes('highlight=')) {
    return hash.split('highlight=')[1];
  }
  return null;
}

/**
 * Removes highlight parameter from URL
 */
export function removeHighlightFromUrl(): void {
  const url = window.location.href.split('#')[0];
  window.history.replaceState({}, document.title, url);
}

/**
 * Finds text within a content element and returns text nodes and positions
 */
export function findTextInContent(contentElement: HTMLElement, searchText: string): {
  textNodes: Text[];
  positions: { node: Text; start: number; end: number }[];
} {
  const textNodes: Text[] = [];
  const positions: { node: Text; start: number; end: number }[] = [];
  
  // Get all text nodes
  const walker = document.createTreeWalker(
    contentElement,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node as Text);
  }
  
  // Find positions of search text
  let contentText = '';
  const nodeMap: { start: number; end: number; node: Text }[] = [];
  
  textNodes.forEach(textNode => {
    const start = contentText.length;
    const text = textNode.textContent || '';
    contentText += text;
    const end = contentText.length;
    nodeMap.push({ start, end, node: textNode });
  });
  
  // Find all occurrences of search text
  let searchIndex = 0;
  while ((searchIndex = contentText.indexOf(searchText, searchIndex)) !== -1) {
    // Find which text node(s) contain this occurrence
    const searchEnd = searchIndex + searchText.length;
    
    for (const nodeInfo of nodeMap) {
      if (searchIndex >= nodeInfo.start && searchIndex < nodeInfo.end) {
        const nodeStart = Math.max(0, searchIndex - nodeInfo.start);
        const nodeEnd = Math.min(nodeInfo.node.textContent?.length || 0, searchEnd - nodeInfo.start);
        
        positions.push({
          node: nodeInfo.node,
          start: nodeStart,
          end: nodeEnd
        });
        
        break;
      }
    }
    
    searchIndex += searchText.length;
  }
  
  return { textNodes, positions };
}

/**
 * Creates visual highlight overlays for text
 */
export function createHighlightOverlays(
  contentElement: HTMLElement, 
  searchText: string, 
  options: HighlightOptions = {}
): HTMLElement | null {
  const { positions } = findTextInContent(contentElement, searchText);
  
  if (positions.length === 0) {
    return null;
  }
  
  // Remove any existing highlights
  removeHighlightOverlays();
  
  // Create highlight container
  const highlightContainer = document.createElement('div');
  highlightContainer.id = 'unified-text-highlights-container';
  highlightContainer.className = 'custom-text-highlights';
  
  // Apply overlay styles
  Object.assign(highlightContainer.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '40'
  });
  
  // Add darkening overlay effect
  const isDarkMode = options.isDarkMode ?? document.documentElement.classList.contains('dark');
  highlightContainer.style.backgroundColor = isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)';
  
  // Create highlight elements for each position
  const rects: DOMRect[] = [];
  
  positions.forEach(({ node, start, end }) => {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    
    const rangeRects = range.getClientRects();
    for (let i = 0; i < rangeRects.length; i++) {
      const rect = rangeRects[i];
      rects.push(rect);
      
      const highlightEl = document.createElement('div');
      highlightEl.className = 'custom-text-highlight';
      
      Object.assign(highlightEl.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        backgroundColor: 'white',
        borderRadius: '3px',
        boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.5)',
        mixBlendMode: 'difference',
        pointerEvents: 'none'
      });
      
      highlightContainer.appendChild(highlightEl);
    }
  });
  
  // Add to document
  document.body.appendChild(highlightContainer);
  
  // Store reference for cleanup
  (window as any).unifiedHighlightContainer = highlightContainer;
  
  // Scroll to first highlight if requested
  if (options.scrollToHighlight && rects.length > 0) {
    const firstRect = rects[0];
    window.scrollTo({
      top: firstRect.top + window.scrollY - 100,
      behavior: 'smooth'
    });
  }
  
  return highlightContainer;
}

/**
 * Removes all highlight overlays
 */
export function removeHighlightOverlays(): void {
  const container = (window as any).unifiedHighlightContainer;
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
    (window as any).unifiedHighlightContainer = null;
  }
  
  // Also clean up legacy containers
  const legacyContainer = (window as any).customHighlightContainer;
  if (legacyContainer && legacyContainer.parentNode) {
    legacyContainer.parentNode.removeChild(legacyContainer);
    (window as any).customHighlightContainer = null;
  }
}

/**
 * Updates highlight positions on scroll/resize
 */
export function updateHighlightPositions(): void {
  const container = (window as any).unifiedHighlightContainer;
  if (!container) return;
  
  // This would need to be implemented based on stored position data
  // For now, we'll just remove and recreate highlights
  removeHighlightOverlays();
}

/**
 * Escapes special regex characters in text
 */
export function escapeRegexChars(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}