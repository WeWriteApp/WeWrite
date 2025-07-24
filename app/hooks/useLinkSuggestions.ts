"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { LinkSuggestion, LinkSuggestionResult, debouncedFindLinkSuggestions } from '../services/linkSuggestionService';

export interface ActiveSuggestion {
  suggestions: LinkSuggestion[];
  matchedText: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface LinkSuggestionState {
  // Current suggestions
  activeSuggestion: ActiveSuggestion | null;
  allSuggestions: LinkSuggestion[]; // All unique suggestions for processing multiple underlines
  isLoading: boolean;
  error: string | null;

  // Modal state
  showModal: boolean;

  // Dismissed suggestions (to avoid showing again in same session)
  dismissedSuggestions: Set<string>;

  // Settings
  isEnabled: boolean;
  minConfidence: number;
}

export interface LinkSuggestionActions {
  // Core actions
  analyzeText: (text: string, currentUserId?: string, excludePageId?: string) => Promise<void>;
  showSuggestionModal: (suggestion: ActiveSuggestion) => void;
  hideSuggestionModal: () => void;
  dismissSuggestion: (matchedText: string) => void;
  clearSuggestions: () => void;
  
  // Settings
  setEnabled: (enabled: boolean) => void;
  setMinConfidence: (confidence: number) => void;
  
  // Selection
  selectSuggestion: (suggestion: LinkSuggestion) => void;
}

export interface UseLinkSuggestionsOptions {
  enabled?: boolean;
  minConfidence?: number;
  debounceDelay?: number;
  onSuggestionSelected?: (suggestion: LinkSuggestion) => void;
  onSuggestionDismissed?: (matchedText: string) => void;
}

console.log('🔗 HOOK: useLinkSuggestions.ts file loaded');

export function useLinkSuggestions(options: UseLinkSuggestionsOptions = {}) {
  const {
    enabled = true,
    minConfidence = 0.3,
    debounceDelay = 1500,
    onSuggestionSelected,
    onSuggestionDismissed
  } = options;

  console.warn('🔗 HOOK: useLinkSuggestions initialized with options:', {
    enabled,
    minConfidence,
    debounceDelay
  });

  // State
  const [state, setState] = useState<LinkSuggestionState>({
    activeSuggestion: null,
    allSuggestions: [],
    isLoading: false,
    error: null,
    showModal: false,
    dismissedSuggestions: new Set(),
    isEnabled: enabled,
    minConfidence
  });

  // Refs for tracking
  const lastAnalyzedText = useRef<string>('');
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, []);

  // Analyze text for link suggestions
  const analyzeText = useCallback(async (
    text: string,
    currentUserId?: string,
    excludePageId?: string
  ) => {
    console.warn('🔗 HOOK: analyzeText called with:', {
      textLength: text.length,
      isEnabled: state.isEnabled,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      currentUserId,
      excludePageId
    });

    // DEBUG: Always try to make the API call regardless of conditions
    console.warn('🔗 HOOK: DEBUG - Making API call regardless of conditions');

    // TEMPORARY: Skip the isEnabled check for debugging
    if (!text || text.trim().length < 10) {
      console.warn('🔗 HOOK: Skipping analysis - text too short:', {
        textLength: text.length,
        trimmedLength: text.trim().length,
        isEnabled: state.isEnabled
      });
      setState(prev => ({ ...prev, activeSuggestion: null, allSuggestions: [], isLoading: false }));
      return;
    }

    if (!state.isEnabled) {
      console.warn('🔗 HOOK: Hook is disabled but proceeding anyway for debugging');
    }

    // Avoid re-analyzing the same text
    if (text === lastAnalyzedText.current) {
      return;
    }

    lastAnalyzedText.current = text;

    // Clear previous timeout
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.warn('🔗 LINK_SUGGESTIONS_HOOK: Analyzing text for suggestions');
      console.warn('🔗 HOOK: About to call debouncedFindLinkSuggestions with:', {
        text: text.substring(0, 50) + '...',
        currentUserId,
        excludePageId,
        debounceDelay
      });

      const result: LinkSuggestionResult = await debouncedFindLinkSuggestions(
        text,
        currentUserId,
        excludePageId,
        debounceDelay
      );

      console.warn('🔗 HOOK: *** API RETURNED SUGGESTIONS ***', {
        suggestionsCount: result.suggestions.length,
        totalMatches: result.totalMatches,
        allSuggestions: result.suggestions.map(s => ({
          title: s.title,
          confidence: s.confidence,
          matchedText: s.matchedText
        }))
      });

      // Filter suggestions by confidence and dismissed status
      const filteredSuggestions = result.suggestions.filter(suggestion => {
        const key = `${suggestion.matchedText}-${suggestion.id}`;
        return suggestion.confidence >= state.minConfidence &&
               !state.dismissedSuggestions.has(key);
      });

      if (filteredSuggestions.length > 0) {
        // Group by matched text and find the best suggestion for each
        const suggestionGroups = filteredSuggestions.reduce((groups, suggestion) => {
          const key = suggestion.matchedText;
          if (!groups[key] || groups[key].confidence < suggestion.confidence) {
            groups[key] = suggestion;
          }
          return groups;
        }, {} as Record<string, LinkSuggestion>);

        // Get all unique suggestions (one per matched text)
        const allUniqueSuggestions = Object.values(suggestionGroups)
          .sort((a, b) => b.confidence - a.confidence);

        if (allUniqueSuggestions.length > 0) {
          // For now, still use the best suggestion as the active one for modal purposes
          // But we'll modify the SlateEditor to process all suggestions
          const bestSuggestion = allUniqueSuggestions[0];
          const relatedSuggestions = filteredSuggestions.filter(
            s => s.matchedText === bestSuggestion.matchedText
          );

          const activeSuggestion: ActiveSuggestion = {
            suggestions: relatedSuggestions,
            matchedText: bestSuggestion.matchedText,
            startIndex: bestSuggestion.startIndex,
            endIndex: bestSuggestion.endIndex,
            confidence: bestSuggestion.confidence
          };

          // Store all unique suggestions for the SlateEditor to process
          setState(prev => ({
            ...prev,
            activeSuggestion,
            allSuggestions: allUniqueSuggestions, // Add this new field
            isLoading: false,
            error: null
          }));

          console.log('🔗 LINK_SUGGESTIONS_HOOK: Found suggestions:', {
            totalUniqueSuggestions: allUniqueSuggestions.length,
            allMatchedTexts: allUniqueSuggestions.map(s => s.matchedText),
            bestSuggestion: {
              matchedText: bestSuggestion.matchedText,
              confidence: bestSuggestion.confidence
            }
          });

          console.log('🔗 LINK_SUGGESTIONS_HOOK: Setting state with allSuggestions:', allUniqueSuggestions);
        } else {
          setState(prev => ({ ...prev, activeSuggestion: null, allSuggestions: [], isLoading: false }));
        }
      } else {
        setState(prev => ({ ...prev, activeSuggestion: null, allSuggestions: [], isLoading: false }));
      }

    } catch (error) {
      console.error('🔴 LINK_SUGGESTIONS_HOOK: Error analyzing text:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to analyze text for link suggestions',
        activeSuggestion: null,
        allSuggestions: []
      }));
    }
  }, [state.isEnabled, state.minConfidence, state.dismissedSuggestions, debounceDelay]);

  // Show suggestion modal
  const showSuggestionModal = useCallback((suggestion: ActiveSuggestion) => {
    setState(prev => ({
      ...prev,
      activeSuggestion: suggestion,
      showModal: true
    }));
  }, []);

  // Hide suggestion modal
  const hideSuggestionModal = useCallback(() => {
    setState(prev => ({ ...prev, showModal: false }));
  }, []);

  // Dismiss a suggestion
  const dismissSuggestion = useCallback((matchedText: string) => {
    setState(prev => {
      const newDismissed = new Set(prev.dismissedSuggestions);
      
      // Add all suggestions for this matched text to dismissed list
      if (prev.activeSuggestion?.matchedText === matchedText) {
        prev.activeSuggestion.suggestions.forEach(suggestion => {
          const key = `${suggestion.matchedText}-${suggestion.id}`;
          newDismissed.add(key);
        });
      }

      return {
        ...prev,
        dismissedSuggestions: newDismissed,
        activeSuggestion: prev.activeSuggestion?.matchedText === matchedText ? null : prev.activeSuggestion,
        showModal: false
      };
    });

    onSuggestionDismissed?.(matchedText);
    console.log('🔗 LINK_SUGGESTIONS_HOOK: Dismissed suggestion:', matchedText);
  }, [onSuggestionDismissed]);

  // Clear all suggestions
  const clearSuggestions = useCallback(() => {
    setState(prev => ({
      ...prev,
      activeSuggestion: null,
      isLoading: false,
      error: null,
      showModal: false
    }));
    lastAnalyzedText.current = '';
  }, []);

  // Set enabled state
  const setEnabled = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, isEnabled: enabled }));
    if (!enabled) {
      clearSuggestions();
    }
  }, [clearSuggestions]);

  // Set minimum confidence
  const setMinConfidence = useCallback((confidence: number) => {
    setState(prev => ({ ...prev, minConfidence: Math.max(0, Math.min(1, confidence)) }));
  }, []);

  // Select a suggestion
  const selectSuggestion = useCallback((suggestion: LinkSuggestion) => {
    onSuggestionSelected?.(suggestion);
    setState(prev => ({ ...prev, showModal: false }));
    console.log('🔗 LINK_SUGGESTIONS_HOOK: Selected suggestion:', {
      title: suggestion.title,
      matchedText: suggestion.matchedText,
      confidence: suggestion.confidence
    });
  }, [onSuggestionSelected]);

  // Actions object
  const actions: LinkSuggestionActions = {
    analyzeText,
    showSuggestionModal,
    hideSuggestionModal,
    dismissSuggestion,
    clearSuggestions,
    setEnabled,
    setMinConfidence,
    selectSuggestion
  };

  return {
    state,
    actions
  };
}
