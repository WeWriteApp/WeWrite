"use client";

import React, { useMemo } from 'react';
import OptimizedSearchInput from './OptimizedSearchInput';
import SearchResultsDisplay from './SearchResultsDisplay';
import SavedSearches from './SavedSearches';
import RecentPages from './RecentPages';
import SearchRecommendations from './SearchRecommendations';

/**
 * IsolatedSearchInput Component
 *
 * This component is completely isolated and never re-renders due to parent state changes.
 * It only re-renders when its own props change.
 */
const IsolatedSearchInput = React.memo(({
  initialQuery,
  onSearch,
  onClear,
  onSave,
  onSubmit
}) => {
  return (
    <OptimizedSearchInput
      initialValue={initialQuery}
      onSearch={onSearch}
      onClear={onClear}
      onSave={onSave}
      onSubmit={onSubmit}
      autoFocus={true}
      placeholder="Search for pages, users..."
    />
  );
}, (prevProps, nextProps) => {
  // Only re-render if callback references change
  return (
    prevProps.initialQuery === nextProps.initialQuery &&
    prevProps.onSearch === nextProps.onSearch &&
    prevProps.onClear === nextProps.onClear &&
    prevProps.onSave === nextProps.onSave &&
    prevProps.onSubmit === nextProps.onSubmit
  );
});

IsolatedSearchInput.displayName = 'IsolatedSearchInput';

/**
 * SearchResultsSection Component
 *
 * This component handles the search results and empty state.
 * It's separate from the input to prevent input re-renders.
 */
const SearchResultsSection = React.memo(({
  currentQuery,
  results,
  isLoading,
  groupsEnabled,
  userId,
  onSearch
}) => {
  // Memoized empty search state component
  const EmptySearchState = useMemo(() => {
    if (currentQuery) return null;

    return (
      <div className="empty-search-state">
        {/* Saved Searches */}
        <SavedSearches
          userId={userId}
          onSelect={onSearch}
        />

        {/* Recent Pages */}
        <RecentPages />

        {/* Search Recommendations */}
        <SearchRecommendations
          onSelect={onSearch}
        />
      </div>
    );
  }, [currentQuery, userId, onSearch]);

  return (
    <>
      {/* Empty search state */}
      {EmptySearchState}

      {/* Search Results Display Component */}
      <SearchResultsDisplay
        query={currentQuery}
        results={results}
        isLoading={isLoading}
        groupsEnabled={groupsEnabled}
        userId={userId}
      />
    </>
  );
}, (prevProps, nextProps) => {
  // Only re-render when results-related props change
  return (
    prevProps.currentQuery === nextProps.currentQuery &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.groupsEnabled === nextProps.groupsEnabled &&
    prevProps.userId === nextProps.userId &&
    prevProps.onSearch === nextProps.onSearch &&
    JSON.stringify(prevProps.results) === JSON.stringify(nextProps.results)
  );
});

SearchResultsSection.displayName = 'SearchResultsSection';

/**
 * SearchPageContent Component
 *
 * This component provides complete isolation between input and results.
 * The input section never re-renders due to search state changes.
 */
const SearchPageContent = ({
  initialQuery,
  currentQuery,
  results,
  isLoading,
  groupsEnabled,
  userId,
  onSearch,
  onClear,
  onSave,
  onSubmit
}) => {
  return (
    <>
      {/* Completely isolated search input - never re-renders from typing */}
      <IsolatedSearchInput
        initialQuery={initialQuery}
        onSearch={onSearch}
        onClear={onClear}
        onSave={onSave}
        onSubmit={onSubmit}
      />

      {/* Separate results section - only re-renders when results change */}
      <SearchResultsSection
        currentQuery={currentQuery}
        results={results}
        isLoading={isLoading}
        groupsEnabled={groupsEnabled}
        userId={userId}
        onSearch={onSearch}
      />
    </>
  );
};

SearchPageContent.displayName = 'SearchPageContent';

export default SearchPageContent;
