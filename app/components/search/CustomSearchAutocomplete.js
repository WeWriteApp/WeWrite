"use client";

import React, { useRef, useEffect, useState } from 'react';
import { ReactSearchAutocomplete } from 'react-search-autocomplete';
import HighlightedText from '../utils/HighlightedText';

const CustomSearchAutocomplete = (props) => {
  const { onKeyDown, ...otherProps } = props;
  const inputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Find the input element inside the ReactSearchAutocomplete component
    if (inputRef.current) {
      const inputElement = inputRef.current.querySelector('input');
      const searchIcon = inputRef.current.querySelector('.search-icon');

      // Create cleanup functions array
      const cleanupFunctions = [];

      if (inputElement) {
        // Add keydown event listener
        const handleKeyDown = (e) => {
          if (e.key === 'Enter' && onKeyDown) {
            e.preventDefault(); // Prevent default form submission
            // Always call onKeyDown for Enter key, even with empty search
            onKeyDown(e);
          }
        };

        inputElement.addEventListener('keydown', handleKeyDown);

        // Add to cleanup functions
        cleanupFunctions.push(() => {
          inputElement.removeEventListener('keydown', handleKeyDown);
        });
      }

      // Add click listener to search icon
      if (searchIcon && onKeyDown) {
        const handleSearchIconClick = (e) => {
          e.preventDefault(); // Prevent default behavior
          e.stopPropagation(); // Stop event propagation

          console.log('Search icon clicked, navigating to search page');

          // Create a synthetic event with the current input value
          const inputValue = inputRef.current.querySelector('input')?.value || '';
          const syntheticEvent = {
            key: 'Enter',
            target: { value: inputValue },
            preventDefault: () => {}
          };

          // Always navigate to search page when clicking the search icon
          // This will work even with an empty search query
          onKeyDown(syntheticEvent);
        };

        // Remove any existing click listeners first to avoid duplicates
        searchIcon.removeEventListener('click', handleSearchIconClick);

        // Add the click listener
        searchIcon.addEventListener('click', handleSearchIconClick);

        // Add to cleanup functions
        cleanupFunctions.push(() => {
          searchIcon.removeEventListener('click', handleSearchIconClick);
        });

        // Also add a direct click handler to ensure it works
        searchIcon.onclick = handleSearchIconClick;
      }

      // Return a single cleanup function that calls all cleanup functions
      return () => {
        cleanupFunctions.forEach(cleanup => cleanup());
      };
    }
  }, [onKeyDown, inputRef]);

  // Custom formatResult function to highlight matches
  const formatResult = (item) => {
    console.log('Formatting search result item:', item);
    return (
      <div className="flex items-center justify-between w-full">
        <div>
          <HighlightedText text={item.name} highlight={searchTerm} />
          {item.type === 'user' && (
            <span className="text-xs text-muted-foreground ml-2">User</span>
          )}
          {item.username && !item.type && (
            <span className="text-xs text-muted-foreground ml-2">by {item.username}</span>
          )}
        </div>
      </div>
    );
  };

  // Handle search to capture the search term
  const handleOnSearch = (string, results) => {
    setSearchTerm(string);
    if (props.onSearch) {
      props.onSearch(string, results);
    }
  };

  return (
    <div ref={inputRef} className="wewrite-card">
      <ReactSearchAutocomplete
        {...otherProps}
        onSearch={handleOnSearch}
        formatResult={formatResult}
        styling={{
          ...otherProps.styling,
          border: "none",
          backgroundColor: "transparent",
          boxShadow: "none"
        }}
      />
    </div>
  );
};

export default CustomSearchAutocomplete;