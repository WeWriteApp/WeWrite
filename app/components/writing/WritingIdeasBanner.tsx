'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { type WritingIdea } from '../../data/writingIdeas';

interface WritingIdeasBannerProps {
  onIdeaSelect: (title: string, placeholder: string) => void;
  selectedTitle?: string; // Track which idea is currently selected
  initialExpanded?: boolean; // Control initial expansion state
}

// Memoized idea button for performance - uses Badge-like styling
const IdeaButton = React.memo(({
  idea,
  isSelected,
  onClick
}: {
  idea: WritingIdea;
  isSelected: boolean;
  onClick: () => void;
}) => (
  <button
    className={`whitespace-nowrap h-8 flex items-center justify-center px-3 py-1 text-sm font-semibold rounded-full transition-all duration-150 ${
      isSelected
        ? "bg-primary text-primary-foreground border-transparent hover:scale-[1.02] active:scale-[0.98]"
        : "bg-neutral-10 text-foreground border-transparent hover:scale-[1.02] active:scale-[0.98]"
    }`}
    onClick={onClick}
  >
    {idea.title}
  </button>
));

export const WritingIdeasBanner = React.memo(function WritingIdeasBanner({ onIdeaSelect, selectedTitle, initialExpanded = false }: WritingIdeasBannerProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [displayedIdeas, setDisplayedIdeas] = useState<WritingIdea[]>([]);
  const [allIdeas, setAllIdeas] = useState<WritingIdea[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const contentInnerRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const DISPLAY_COUNT = 9; // 3x3 grid to fit without scrolling
  const ROWS = 2;

  // Load writing ideas from API
  const loadWritingIdeas = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/writing-ideas');
      const result = await response.json();

      if (result.success && result.data.ideas) {
        setAllIdeas(result.data.ideas);
      } else {
        console.error('Failed to load writing ideas:', result.error);
        // Fallback to empty array - component will handle gracefully
        setAllIdeas([]);
      }
    } catch (error) {
      console.error('Error loading writing ideas:', error);
      setAllIdeas([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load ideas on component mount
  useEffect(() => {
    loadWritingIdeas();
  }, [loadWritingIdeas]);

  // Auto-expand once on mount (starts closed, then animates open)
  useEffect(() => {
    if (!initialExpanded) {
      const timer = setTimeout(() => setIsExpanded(true), 80);
      return () => clearTimeout(timer);
    }
  }, [initialExpanded]);

  // Generate random ideas with staggered animation
  const generateIdeas = useCallback(async () => {
    if (allIdeas.length === 0) {
      console.warn('No writing ideas available to generate from');
      return;
    }

    setIsGenerating(true);
    setDisplayedIdeas([]);

    const shuffled = [...allIdeas].sort(() => Math.random() - 0.5).slice(0, DISPLAY_COUNT);

    // Animate in with 100ms delays
    for (let i = 0; i < shuffled.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setDisplayedIdeas(prev => [...prev, shuffled[i]]);
    }

    setIsGenerating(false);
    setHasGenerated(true);
  }, [allIdeas, DISPLAY_COUNT]);

  // Auto-generate on first expand (only if ideas are loaded)
  useEffect(() => {
    if (isExpanded && !hasGenerated && allIdeas.length > 0 && !isLoading) {
      generateIdeas();
    }
  }, [isExpanded, hasGenerated, allIdeas.length, isLoading, generateIdeas]);

  const handleShuffle = useCallback(() => {
    setHasGenerated(false);
    generateIdeas();
  }, [generateIdeas]);

  // Track usage when an idea is selected
  const trackUsage = useCallback(async (title: string) => {
    try {
      // Fire and forget - don't block the user experience
      fetch('/api/writing-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      }).catch(() => {
        // Silently fail - usage tracking is not critical
      });
    } catch {
      // Silently fail
    }
  }, []);

  // Wrapper for onIdeaSelect that also tracks usage
  const handleIdeaSelect = useCallback((title: string, placeholder: string) => {
    trackUsage(title);
    onIdeaSelect(title, placeholder);
  }, [trackUsage, onIdeaSelect]);

  const handleExpand = () => setIsExpanded(true);
  const handleCollapse = () => setIsExpanded(false);

  // Measure content height for smooth animations
  useEffect(() => {
    const measure = () => {
      if (contentInnerRef.current) {
        setContentHeight(contentInnerRef.current.scrollHeight);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (contentInnerRef.current) {
      observer.observe(contentInnerRef.current);
    }
    return () => observer.disconnect();
  }, [displayedIdeas.length, isLoading, allIdeas.length]);

  // Scroll button visibility
  const updateScrollButtons = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollButtons();
  }, [displayedIdeas.length, isExpanded, updateScrollButtons]);

  const scrollByAmount = (delta: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
    setTimeout(updateScrollButtons, 150);
  };

  return (
    <div className="w-full wewrite-card transition-all duration-300 ease-in-out flex flex-col">
      {/* Header - clickable to toggle */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors duration-200 flex-shrink-0"
        onClick={isExpanded ? handleCollapse : handleExpand}
      >
        <div className="flex items-center gap-2">
          <Icon name="Lightbulb" size={20} className="text-muted-foreground" />
          <span className="text-sm font-medium">
            {isLoading ? 'Loading writing ideas...' : 'Need writing ideas?'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Icon name="RefreshCw" size={16} className="text-muted-foreground animate-spin" />}
          {isExpanded ? (
            <Icon name="ChevronUp" size={16} className="text-muted-foreground transition-transform duration-200" />
          ) : (
            <Icon name="ChevronDown" size={16} className="text-muted-foreground transition-transform duration-200" />
          )}
        </div>
      </div>

      {/* Ideas Container */}
      <div
        className="overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out"
        style={{
          maxHeight: isExpanded ? contentHeight + 16 : 0,
          opacity: isExpanded ? 1 : 0,
          transform: isExpanded ? 'translateY(0)' : 'translateY(-4px)'
        }}
      >
        <div ref={contentInnerRef}>
          <div className="relative px-4 py-2">
            <div
              ref={scrollContainerRef}
              onScroll={updateScrollButtons}
              className="overflow-x-auto no-scrollbar"
            >
              {/* NOTE: keep this flex-wrap lane (not grid). Grid caused uneven gaps when chips had varied widths,
                  and was previously reverted. Flex + gap keeps gutters consistent regardless of label length. */}
              <div className="flex flex-wrap gap-2 pb-1 items-start">
                {isLoading || allIdeas.length === 0 ? (
                  <div className="flex items-center justify-center w-full h-full">
                    <div className="text-center">
                      {isLoading ? (
                        <>
                          <Icon name="RefreshCw" size={24} className="animate-spin mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Loading ideas...</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">No writing ideas available</p>
                      )}
                    </div>
                  </div>
                ) : (
                  Array.from({ length: DISPLAY_COUNT }, (_, index) => {
                    const idea = displayedIdeas[index];
                    return (
                      <div
                        key={index}
                        className={`transition-all duration-300 ${idea ? 'animate-in fade-in-0 slide-in-from-bottom-2' : 'opacity-0'}`}
                        style={{
                          animationDelay: idea ? `${index * 100}ms` : '0ms',
                          minHeight: '36px'
                        }}
                      >
                        {idea && (
                          <IdeaButton
                            idea={idea}
                            isSelected={selectedTitle === idea.title}
                            onClick={() => handleIdeaSelect(idea.title, idea.placeholder)}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Scroll hints */}
            {canScrollRight && (
              <button
                aria-label="Scroll ideas right"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-card/90 border border-border/70 shadow-md rounded-full p-1"
                onClick={() => scrollByAmount(200)}
              >
                <Icon name="ChevronRight" size={20} />
              </button>
            )}
            {canScrollLeft && (
              <button
                aria-label="Scroll ideas left"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-card/90 border border-border/70 shadow-md rounded-full p-1"
                onClick={() => scrollByAmount(-200)}
              >
                <Icon name="ChevronLeft" size={20} />
              </button>
            )}
          </div>

          {/* Shuffle Button - Pinned to Bottom */}
          <div className="p-4 pt-0 flex-shrink-0">
            <Button
              variant="secondary"
              size="default"
              onClick={handleShuffle}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 font-medium py-3 px-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group"
            >
              <svg
                className={`h-5 w-5 transition-transform duration-200 ${
                  isGenerating
                    ? 'animate-spin'
                    : 'group-hover:rotate-180'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isGenerating ? 'Generating...' : 'More ideas'}
            </Button>
          </div>
        </div>
      </div>

      {/* Legacy layout removed */}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if selectedTitle changed (ignore function reference changes)
  return prevProps.selectedTitle === nextProps.selectedTitle;
});
