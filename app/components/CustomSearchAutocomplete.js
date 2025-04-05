"use client";

import React, { useRef, useEffect, useState } from 'react';
import { ReactSearchAutocomplete } from 'react-search-autocomplete';
import HighlightedText from './HighlightedText';

const CustomSearchAutocomplete = (props) => {
  const { onKeyDown, ...otherProps } = props;
  const inputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Find the input element inside the ReactSearchAutocomplete component
    if (inputRef.current) {
      const inputElement = inputRef.current.querySelector('input');
      if (inputElement) {
        // Add keydown event listener
        const handleKeyDown = (e) => {
          if (e.key === 'Enter' && onKeyDown) {
            onKeyDown(e);
          }
        };

        inputElement.addEventListener('keydown', handleKeyDown);

        // Clean up
        return () => {
          inputElement.removeEventListener('keydown', handleKeyDown);
        };
      }
    }
  }, [onKeyDown, inputRef]);

  // Custom formatResult function to highlight matches
  const formatResult = (item) => {
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
    <div ref={inputRef}>
      <ReactSearchAutocomplete
        {...otherProps}
        onSearch={handleOnSearch}
        formatResult={formatResult}
      />
    </div>
  );
};

export default CustomSearchAutocomplete;
