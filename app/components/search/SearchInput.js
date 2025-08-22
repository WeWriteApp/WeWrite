"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Search, X, Pin } from 'lucide-react';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';

/**
 * SearchInput Component
 *
 * A high-performance search input component that maintains focus and cursor position
 * while providing debounced search functionality. Optimized to prevent
 * unnecessary re-renders that cause focus loss during typing.
 *
 * Key Performance Features:
 * - Isolated internal state management
 * - Stable callback references
 * - Optimized re-render prevention
 * - Debounced search with smart caching
 *
 * @param {string} initialValue - Initial search value
 * @param {Function} onSearch - Callback for search with debouncing
 * @param {Function} onClear - Callback when search is cleared
 * @param {Function} onSave - Callback to save search query
 * @param {Function} onSubmit - Callback for form submission (Enter key)
 * @param {boolean} autoFocus - Whether to auto-focus the input
 * @param {string} placeholder - Input placeholder text
 */
const SearchInput = ({
  initialValue = '',
  onSearch,
  onClear,
  onSave,
  onSubmit,
  autoFocus = true,
  placeholder = "Search for pages, users..."
}) => {
  // Internal state - isolated from parent re-renders
  const [inputValue, setInputValue] = useState(initialValue);
  const searchInputRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const lastSearchValue = useRef('');
  const isInitialized = useRef(false);
  const { trackInteractionEvent, events } = useWeWriteAnalytics();

  // Focus the search input when the component mounts
  useEffect(() => {
    if (autoFocus) {
      const focusTimer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();

          // For mobile devices, try to open the keyboard
          if (typeof window !== 'undefined' && 'ontouchstart' in window) {
            searchInputRef.current.click();
          }
        }
      }, 100);

      return () => clearTimeout(focusTimer);
    }
  }, [autoFocus]);

  // Initialize input value only once to prevent re-render loops
  useEffect(() => {
    if (!isInitialized.current && initialValue) {
      setInputValue(initialValue);
      isInitialized.current = true;
    }
  }, [initialValue]);

  // Debounced search function with smart caching to prevent duplicate calls
  const debouncedSearch = useCallback((value) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      // Only call onSearch if the value has actually changed
      if (value !== lastSearchValue.current && onSearch) {
        lastSearchValue.current = value;

        // Track search performed
        if (value.trim()) {
          trackInteractionEvent(events.SEARCH_PERFORMED, {
            query: value.trim(),
            query_length: value.trim().length,
            source: 'search_input'
          });
        }

        onSearch(value);
      }
    }, 300);
  }, [onSearch, trackInteractionEvent, events]);

  // Handle input changes - optimized to prevent re-renders
  const handleInputChange = useCallback((e) => {
    const newValue = e.target.value;

    // Update input value immediately for responsive UI
    setInputValue(newValue);

    // Debounce the search callback to prevent excessive API calls
    debouncedSearch(newValue);
  }, [debouncedSearch]);

  // Handle form submission
  const handleSubmit = useCallback((e) => {
    e.preventDefault();

    // Cancel any pending debounced search
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (onSubmit) {
      onSubmit(inputValue);
    }
  }, [inputValue, onSubmit]);

  // Handle clear button
  const handleClear = useCallback(() => {
    setInputValue('');
    lastSearchValue.current = ''; // Reset search cache

    // Cancel any pending debounced search
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (onClear) {
      onClear();
    }

    // Focus the input after clearing
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [onClear]);

  // Handle save button
  const handleSave = useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && onSave) {
      onSave(trimmedValue);
    }
  }, [inputValue, onSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <div className="relative">
        <Input
          ref={searchInputRef}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          className="w-full wewrite-input-with-left-icon wewrite-input-with-right-icon"
          autoComplete="off"
        />

        {/* Search icon on the left */}
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Clear button - larger size */}
        {inputValue.trim() && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors pointer-events-auto"
            aria-label="Clear search"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </form>
  );
};

SearchInput.displayName = 'SearchInput';

// Custom comparison function to prevent unnecessary re-renders
// Only re-render if props that actually matter have changed
const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.initialValue === nextProps.initialValue &&
    prevProps.autoFocus === nextProps.autoFocus &&
    prevProps.placeholder === nextProps.placeholder &&
    prevProps.onSearch === nextProps.onSearch &&
    prevProps.onClear === nextProps.onClear &&
    prevProps.onSave === nextProps.onSave &&
    prevProps.onSubmit === nextProps.onSubmit
  );
};

export default React.memo(SearchInput, areEqual);