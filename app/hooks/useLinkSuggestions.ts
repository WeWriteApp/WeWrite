"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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

export function useLinkSuggestions(options: UseLinkSuggestionsOptions = {}) {
  const {
    enabled = true,
    minConfidence = 0.3,
    debounceDelay = 1500,
    onSuggestionSelected,
    onSuggestionDismissed
  } = options;

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

  // Refs for stable access in callbacks (prevents infinite re-renders)
  const stateRef = useRef(state);
  stateRef.current = state;

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
    // Skip if text is too short - only update state if there's actually something to clear
    if (!text || text.trim().length < 10) {
      // Use functional update and only change if needed to prevent infinite loops
      setState(prev => {
        if (prev.activeSuggestion !== null || prev.allSuggestions.length > 0 || prev.isLoading) {
          return { ...prev, activeSuggestion: null, allSuggestions: [], isLoading: false };
        }
        return prev; // Return same reference to prevent re-render
      });
      return;
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
      const result: LinkSuggestionResult = await debouncedFindLinkSuggestions(
        text,
        currentUserId,
        excludePageId,
        debounceDelay
      );

      // Use ref to access current state values without adding them to dependencies
      const currentState = stateRef.current;

      // Filter suggestions by confidence and dismissed status
      const filteredSuggestions = result.suggestions.filter(suggestion => {
        const key = `${suggestion.matchedText}-${suggestion.id}`;
        return suggestion.confidence >= currentState.minConfidence &&
               !currentState.dismissedSuggestions.has(key);
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
            allSuggestions: allUniqueSuggestions,
            isLoading: false,
            error: null
          }));
        } else {
          setState(prev => ({ ...prev, activeSuggestion: null, allSuggestions: [], isLoading: false }));
        }
      } else {
        setState(prev => ({ ...prev, activeSuggestion: null, allSuggestions: [], isLoading: false }));
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to analyze text for link suggestions',
        activeSuggestion: null,
        allSuggestions: []
      }));
    }
  }, [debounceDelay]); // Use stateRef.current instead of state to avoid re-creating this callback

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
      // Check both activeSuggestion and allSuggestions for the matched text
      if (prev.activeSuggestion?.matchedText === matchedText) {
        prev.activeSuggestion.suggestions.forEach(suggestion => {
          const key = `${suggestion.matchedText}-${suggestion.id}`;
          newDismissed.add(key);
        });
      }

      // Also mark any matching suggestions from allSuggestions as dismissed
      prev.allSuggestions.forEach(suggestion => {
        if (suggestion.matchedText === matchedText) {
          const key = `${suggestion.matchedText}-${suggestion.id}`;
          newDismissed.add(key);
        }
      });

      // Remove the dismissed suggestion from allSuggestions
      const newAllSuggestions = prev.allSuggestions.filter(
        suggestion => suggestion.matchedText !== matchedText
      );

      return {
        ...prev,
        dismissedSuggestions: newDismissed,
        allSuggestions: newAllSuggestions,
        activeSuggestion: prev.activeSuggestion?.matchedText === matchedText ? null : prev.activeSuggestion,
        showModal: false
      };
    });

    onSuggestionDismissed?.(matchedText);
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
  }, [onSuggestionSelected]);

  // Memoize actions object to prevent infinite re-renders when used in dependency arrays
  const actions: LinkSuggestionActions = useMemo(() => ({
    analyzeText,
    showSuggestionModal,
    hideSuggestionModal,
    dismissSuggestion,
    clearSuggestions,
    setEnabled,
    setMinConfidence,
    selectSuggestion
  }), [
    analyzeText,
    showSuggestionModal,
    hideSuggestionModal,
    dismissSuggestion,
    clearSuggestions,
    setEnabled,
    setMinConfidence,
    selectSuggestion
  ]);

  return {
    state,
    actions
  };
}
