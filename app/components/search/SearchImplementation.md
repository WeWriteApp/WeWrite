# Search Implementation Guide

This document provides guidance on how to implement standardized search functionality across the WeWrite application.

## Overview

We've created a centralized search service and standardized search component to ensure consistent search behavior across the application. This includes:

1. Prioritizing exact matches in search results
2. Standardizing the search UI and behavior
3. Improving error handling in search functionality

## Components

### 1. SearchService.js

The `SearchService.js` file provides a centralized service for search functionality. It includes:

- A debounced search function to limit API calls
- Standardized result formatting
- Prioritization of exact matches
- Consistent error handling

### 2. StandardSearch.js

The `StandardSearch.js` component provides a standardized search UI that can be used across the application. It includes:

- Keyboard navigation
- Highlighting of matching text
- Categorized results
- Consistent loading states

## How to Use

### Basic Usage

```jsx
import StandardSearch from '../components/search/StandardSearch';

function MyComponent() {
  return (
    <StandardSearch 
      placeholder="Search pages..."
      autoFocus={true}
    />
  );
}
```

### With Custom Selection Handling

```jsx
import StandardSearch from '../components/search/StandardSearch';

function MyComponent() {
  const handleSelect = (item) => {
    console.log('Selected item:', item);
    // Custom handling logic
  };

  return (
    <StandardSearch 
      placeholder="Search pages..."
      onSelect={handleSelect}
    />
  );
}
```

### Filtering Results

```jsx
import StandardSearch from '../components/search/StandardSearch';

function MyComponent() {
  return (
    <StandardSearch 
      placeholder="Search pages..."
      includeUsers={false} // Only show pages
      editableOnly={true} // Only show pages the user can edit
    />
  );
}
```

## Implementation Steps

To replace existing search implementations with the standardized search:

1. Import the StandardSearch component:
   ```jsx
   import StandardSearch from '../components/search/StandardSearch';
   ```

2. Replace the existing search component:
   ```jsx
   // Before
   <TypeaheadSearch />

   // After
   <StandardSearch 
     placeholder="Search pages..."
     autoFocus={true}
   />
   ```

3. If you need custom selection handling, add an onSelect prop:
   ```jsx
   <StandardSearch 
     placeholder="Search pages..."
     onSelect={(item) => {
       // Custom handling logic
     }}
   />
   ```

## Benefits

- Consistent search behavior across the application
- Improved search results with exact matches prioritized
- Better error handling
- Keyboard navigation support
- Standardized UI for better user experience
