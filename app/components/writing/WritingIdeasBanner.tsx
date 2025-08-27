'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight, Lightbulb, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { type WritingIdea } from '../../data/writingIdeas';

interface WritingIdeasBannerProps {
  onIdeaSelect: (title: string, placeholder: string) => void;
  selectedTitle?: string; // Track which idea is currently selected
  initialExpanded?: boolean; // Control initial expansion state
}

// Memoized idea button for performance
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
    className={`whitespace-nowrap h-8 flex items-center justify-center px-3 py-1 text-sm font-medium border rounded-lg transition-colors ${
      isSelected
        ? "bg-primary text-white border-primary"
        : "bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground"
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

  const DISPLAY_COUNT = 9; // 3x3 grid to fit without scrolling

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

  const handleExpand = () => setIsExpanded(true);
  const handleCollapse = () => setIsExpanded(false);



  if (!isExpanded) {
    return (
      <div
        className="w-full wewrite-card flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={handleExpand}
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">
            {isLoading ? 'Loading writing ideas...' : 'Need writing ideas?'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />}
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full wewrite-card transition-all duration-300 ease-in-out flex flex-col"
      style={{ height: '320px' }}
    >
      {/* Header - clickable to collapse */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors duration-200 flex-shrink-0"
        onClick={handleCollapse}
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">
            {isLoading ? 'Loading writing ideas...' : 'Need writing ideas?'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />}
          <ChevronUp className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
        </div>
      </div>

      {/* Ideas Container */}
      <div className="flex-1 px-4 py-2 flex flex-wrap justify-center gap-2 content-start">
        {isLoading || allIdeas.length === 0 ? (
          <div className="flex items-center justify-center w-full h-full">
            <div className="text-center">
              {isLoading ? (
                <>
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
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
                    onClick={() => onIdeaSelect(idea.title, idea.placeholder)}
                  />
                )}
              </div>
            );
          })
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
  );
}, (prevProps, nextProps) => {
  // Only re-render if selectedTitle changed (ignore function reference changes)
  return prevProps.selectedTitle === nextProps.selectedTitle;
});
