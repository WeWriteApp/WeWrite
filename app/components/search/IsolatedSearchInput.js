"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Search, X, Pin } from 'lucide-react';


/**
 * IsolatedSearchInput Component
 *
 * A completely isolated search input component that manages its own state
 * independently of parent component re-renders. This version is designed
 * to provide maximum performance and responsiveness.
 *
 * @param {string} initialValue - Initial search value
 * @param {Function} onSearch - Callback for search with debouncing
 * @param {Function} onClear - Callback when search is cleared
 * @param {Function} onSave - Callback to save search query
 * @param {Function} onSubmit - Callback for form submission (Enter key)
 * @param {boolean} autoFocus - Whether to auto-focus the input
 * @param {string} placeholder - Input placeholder text
 */
const IsolatedSearchInput = ({
  initialValue = '',
  onSearch,
  onClear,
  onSave,
  onSubmit,
  autoFocus = true,
  placeholder = "Search for pages, users..."
}) => {
  // Internal state - completely isolated from parent
  const [inputValue, setInputValue] = useState(initialValue);
  const searchInputRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const lastSearchValue = useRef('');
  const isInitialized = useRef(false);

  // Initialize input value only once
  useEffect(() => {
    if (!isInitialized.current && initialValue) {
      setInputValue(initialValue);
      isInitialized.current = true;
    }
  }, [initialValue]);

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

  // Stable debounced search function with standardized timing
  const debouncedSearch = useCallback((value) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      // Only call onSearch if the value has actually changed
      if (value !== lastSearchValue.current && onSearch) {
        lastSearchValue.current = value;
        onSearch(value);
      }
    }, 500); // Standardized to 500ms to match other search components
  }, [onSearch]);

  // Handle input changes - optimized for maximum performance
  const handleInputChange = useCallback((e) => {
    const newValue = e.target.value;

    // Update input value immediately for responsive UI
    setInputValue(newValue);

    // Debounce the search callback
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
    lastSearchValue.current = '';

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
    if (onSave && inputValue.trim()) {
      onSave(inputValue.trim());
    }
  }, [inputValue, onSave]);

  // Cleanup on unmount
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

IsolatedSearchInput.displayName = 'IsolatedSearchInput';

// Export without React.memo to test if that's causing issues
export default IsolatedSearchInput;
