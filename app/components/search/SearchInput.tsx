"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Search, X, Pin } from 'lucide-react';

interface SearchInputProps {
  /** Initial search value */
  initialValue?: string;
  /** Callback for search with debouncing */
  onSearch?: (value: string) => void;
  /** Callback when search is cleared */
  onClear?: () => void;
  /** Callback to save search query */
  onSave?: (value: string) => void;
  /** Callback for form submission (Enter key) */
  onSubmit?: (value: string) => void;
  /** Whether to auto-focus the input */
  autoFocus?: boolean;
  /** Input placeholder text */
  placeholder?: string;
}

/**
 * WeWrite Search Performance Optimization - SearchInput Component
 *
 * A highly optimized search input component that prevents all unnecessary re-renders
 * and eliminates visual flashing issues during typing. This component is the result
 * of comprehensive performance optimization to fix critical search page issues.
 *
 * Performance Problems Solved:
 * - Visual flashing/blank screen during typing
 * - Input field temporarily disappearing from view
 * - Brief white/blank viewport flashes on each keystroke
 * - Difficult typing experience due to visual interruptions
 * - Component re-rendering performance issues
 *
 * Key Optimizations Implemented:
 * - Isolated internal state management (prevents parent re-renders)
 * - Stable callback references with useCallback
 * - React.memo with custom comparison function
 * - Debounced search to prevent excessive API calls (300ms)
 * - No external dependencies that could cause re-renders
 * - Complete isolation from search results state changes
 * - Functional state updates to eliminate dependencies
 *
 * Architecture Benefits:
 * - Input component completely isolated from results
 * - Only re-renders when its own internal state changes
 * - Maintains focus throughout typing with no cursor jumps
 * - Zero visual interruptions during search input
 * - Perfect typing performance with smooth user experience
 */
const SearchInput: React.FC<SearchInputProps> = ({
  initialValue = '',
  onSearch,
  onClear,
  onSave,
  onSubmit,
  autoFocus = true,
  placeholder = "Search for pages, users..."
}) => {
  // Internal state - completely isolated from parent
  const [inputValue, setInputValue] = useState<string>(initialValue);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchValue = useRef<string>('');
  const isInitialized = useRef<boolean>(false);

  // Initialize input value only once
  useEffect(() => {
    if (!isInitialized.current && initialValue) {
      setInputValue(initialValue);
      isInitialized.current = true;
    }
  }, [initialValue]);

  // Auto-focus effect
  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      // Small delay to ensure the component is fully mounted
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  // Stable debounced search function
  const debouncedSearch = useCallback((value: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      // Only call onSearch if the value has actually changed
      if (value !== lastSearchValue.current && onSearch) {
        lastSearchValue.current = value;
        onSearch(value);
      }
    }, 300);
  }, [onSearch]);

  // Handle input changes - optimized for maximum performance
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Update input value immediately for responsive UI
    setInputValue(newValue);

    // Debounce the search callback
    debouncedSearch(newValue);
  }, [debouncedSearch]);

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
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
    lastSearchValue.current = '';

    // Cancel any pending debounced search
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (onClear) {
      onClear();
    }
  }, [onClear]);

  // Handle save button
  const handleSave = useCallback(() => {
    if (onSave && inputValue.trim()) {
      onSave(inputValue.trim());
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
          className="w-full pr-20"
          autoComplete="off"
        />

        {/* Search icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Clear button - only show when there's text in the search field */}
        {inputValue.trim() && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors pointer-events-auto"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Pin button - only show when there's text in the search field */}
        {inputValue.trim() && onSave && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-16 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={handleSave}
            title="Save this search"
          >
            <Pin className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
};

SearchInput.displayName = 'SearchInput';

// Custom comparison function to prevent unnecessary re-renders
// This is the most important part for preventing re-renders
const areEqual = (prevProps: SearchInputProps, nextProps: SearchInputProps): boolean => {
  // Only re-render if these specific props change
  return (
    prevProps.initialValue === nextProps.initialValue &&
    prevProps.autoFocus === nextProps.autoFocus &&
    prevProps.placeholder === nextProps.placeholder &&
    // For callback functions, we check if they're the same reference
    // This is why it's important that parent components use useCallback
    prevProps.onSearch === nextProps.onSearch &&
    prevProps.onClear === nextProps.onClear &&
    prevProps.onSave === nextProps.onSave &&
    prevProps.onSubmit === nextProps.onSubmit
  );
};

export default React.memo(SearchInput, areEqual);
