"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { 
  getHighlightHashFromUrl, 
  getStoredHighlight, 
  removeHighlightFromUrl,
  createHighlightOverlays,
  removeHighlightOverlays,
  type HighlightInfo 
} from '../../utils/textHighlighting';

interface UnifiedTextHighlighterProps {
  contentRef: React.RefObject<HTMLElement>;
  showNotification?: boolean;
  autoScroll?: boolean;
  onHighlightFound?: (highlight: HighlightInfo) => void;
  onHighlightDismissed?: () => void;
}

const UnifiedTextHighlighter: React.FC<UnifiedTextHighlighterProps> = ({
  contentRef,
  showNotification = true,
  autoScroll = true,
  onHighlightFound,
  onHighlightDismissed
}) => {
  const [highlightInfo, setHighlightInfo] = useState<HighlightInfo | null>(null);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Check for URL-based highlights on mount and content changes
  useEffect(() => {
    if (!contentRef.current) return;

    const checkForHighlight = () => {
      const hash = getHighlightHashFromUrl();
      if (!hash) return;

      const storedHighlight = getStoredHighlight(hash);
      if (!storedHighlight) {
        console.log('No highlight data found for hash:', hash);
        return;
      }

      console.log('Found highlight:', storedHighlight);
      setHighlightInfo(storedHighlight);
      setIsHighlighting(true);

      // Notify parent component
      if (onHighlightFound) {
        onHighlightFound(storedHighlight);
      }

      // Create visual highlights
      highlightTextInContent(storedHighlight.text);
    };

    // Use a delay to ensure content is fully rendered
    const timer = setTimeout(checkForHighlight, 500);
    return () => clearTimeout(timer);
  }, [contentRef, onHighlightFound]);

  // Handle scroll and resize events to update highlight positions
  useEffect(() => {
    if (!isHighlighting) return;

    const handleScroll = () => {
      // For now, we'll just remove and recreate highlights on scroll
      // This could be optimized to update positions instead
      if (highlightInfo) {
        highlightTextInContent(highlightInfo.text);
      }
    };

    const handleResize = () => {
      if (highlightInfo) {
        highlightTextInContent(highlightInfo.text);
      }
    };

    const handleBeforeUnload = () => {
      dismissHighlight();
    };

    // Throttle scroll events
    let scrollTimeout: NodeJS.Timeout;
    const throttledScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScroll, 100);
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('scroll', throttledScroll);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearTimeout(scrollTimeout);
    };
  }, [isHighlighting, highlightInfo]);

  const dismissHighlight = useCallback(() => {
    // Clear browser selection
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }

    // Remove highlight overlays
    removeHighlightOverlays();

    // Remove highlight from URL
    removeHighlightFromUrl();

    // Reset state
    setHighlightInfo(null);
    setIsHighlighting(false);

    // Notify parent component
    if (onHighlightDismissed) {
      onHighlightDismissed();
    }
  }, [onHighlightDismissed]);

  const highlightTextInContent = useCallback((text: string) => {
    if (!contentRef.current || !text) return;

    // Wait for content to be fully rendered
    setTimeout(() => {
      const contentElement = contentRef.current;
      if (!contentElement) return;

      const isDarkMode = document.documentElement.classList.contains('dark');
      
      const highlightContainer = createHighlightOverlays(contentElement, text, {
        scrollToHighlight: autoScroll,
        showNotification,
        isDarkMode
      });

      if (!highlightContainer) {
        console.log('Text not found in content:', text);
        // If text is not found, dismiss the highlight
        dismissHighlight();
      }
    }, 100);
  }, [contentRef, autoScroll, showNotification, dismissHighlight]);

  // Render notification banner
  if (!isHighlighting || !showNotification || !highlightInfo) {
    return null;
  }

  return (
    <div
      ref={notificationRef}
      id="highlight-notification"
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-2 bg-background border-b border-border shadow-sm"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {highlightInfo.username ? (
              <>Highlighted by {highlightInfo.username}</>
            ) : (
              <>Text highlighted</>
            )}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            "{highlightInfo.text}"
          </p>
        </div>
      </div>
      
      <button
        onClick={dismissHighlight}
        className="flex-shrink-0 p-1 hover:bg-muted rounded-sm transition-colors"
        aria-label="Dismiss highlight"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default UnifiedTextHighlighter;