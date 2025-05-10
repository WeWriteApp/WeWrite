"use client";

import React, { useRef, useEffect, useState } from 'react';
import { ReactSearchAutocomplete } from 'react-search-autocomplete';
import HighlightedText from './HighlightedText';
import { useRouter } from 'next/navigation';

const CustomSearchAutocomplete = (props) => {
  const { onKeyDown, onSelect, items, ...otherProps } = props;
  const inputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
  const router = useRouter();

  // Reset selected item when items change
  useEffect(() => {
    setSelectedItemIndex(-1);
  }, [items]);

  useEffect(() => {
    // Find the input element inside the ReactSearchAutocomplete component
    if (inputRef.current) {
      const inputElement = inputRef.current.querySelector('input');
      const searchIcon = inputRef.current.querySelector('.search-icon');
      const resultsContainer = inputRef.current.querySelector('.results');

      // Create cleanup functions array
      const cleanupFunctions = [];

      if (inputElement) {
        // Add keydown event listener for keyboard navigation
        const handleKeyDown = (e) => {
          // Handle arrow keys for navigation
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedItemIndex(prev =>
              prev < items.length - 1 ? prev + 1 : prev
            );
          }
          else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedItemIndex(prev =>
              prev > 0 ? prev - 1 : 0
            );
          }
          // Handle Enter key
          else if (e.key === 'Enter') {
            e.preventDefault();

            // If an item is selected, navigate to that item
            if (selectedItemIndex >= 0 && items[selectedItemIndex]) {
              if (onSelect) {
                onSelect(items[selectedItemIndex]);
              }
            }
            // Otherwise, go to search page with current query
            else if (onKeyDown) {
              onKeyDown(e);
            }
          }
        };

        inputElement.addEventListener('keydown', handleKeyDown);

        // Add to cleanup functions
        cleanupFunctions.push(() => {
          inputElement.removeEventListener('keydown', handleKeyDown);
        });
      }

      // Add click listener to search icon only
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
  }, [onKeyDown, inputRef, items, selectedItemIndex, onSelect]);

  // Custom formatResult function to highlight matches
  const formatResult = (item, index) => {
    const isSelected = index === selectedItemIndex;

    return (
      <div
        className={`flex items-center justify-between w-full p-2 rounded-md ${
          isSelected ? 'bg-primary/10' : ''
        }`}
        onMouseEnter={() => setSelectedItemIndex(index)}
      >
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

  // Custom onSelect handler to use our selectedItemIndex
  const handleOnSelect = (item) => {
    if (onSelect) {
      onSelect(item);
    }
  };

  return (
    <div ref={inputRef}>
      <ReactSearchAutocomplete
        {...otherProps}
        items={items}
        onSearch={handleOnSearch}
        onSelect={handleOnSelect}
        formatResult={formatResult}
        showIcon={true}
        showClear={true}
        maxResults={10}
        autoFocus={otherProps.autoFocus || false}
      />
    </div>
  );
};

export default CustomSearchAutocomplete;
