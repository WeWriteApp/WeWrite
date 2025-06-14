"use client";

import React, { useMemo } from 'react';
import SearchInput from './SearchInput';
import SearchResultsDisplay from './SearchResultsDisplay';
import SavedSearches from './SavedSearches';
import RecentPages from './RecentPages';
import SearchRecommendations from './SearchRecommendations';

interface IsolatedSearchInputProps {
  initialQuery: string;
  onSearch: (query: string) => void;
  onClear: () => void;
  onSave: (query: string) => void;
  onSubmit: (query: string) => void;
}

interface SearchResultsSectionProps {
  currentQuery: string;
  results: any[];
  isLoading: boolean;
  groupsEnabled: boolean;
  userId: string;
  onSearch: (query: string) => void;
}

interface SearchPageContentProps {
  initialQuery: string;
  currentQuery: string;
  results: any[];
  isLoading: boolean;
  groupsEnabled: boolean;
  userId: string;
  onSearch: (query: string) => void;
  onClear: () => void;
  onSave: (query: string) => void;
  onSubmit: (query: string) => void;
}

/**
 * IsolatedSearchInput Component
 *
 * This component is completely isolated and never re-renders due to parent state changes.
 * It only re-renders when its own props change.
 */
const IsolatedSearchInput = React.memo<IsolatedSearchInputProps>(({
  initialQuery,
  onSearch,
  onClear,
  onSave,
  onSubmit
}) => {
  return (
    <SearchInput
      initialValue={initialQuery}
      onSearch={onSearch}
      onClear={onClear}
      onSave={onSave}
      onSubmit={onSubmit}
      autoFocus={true}
      placeholder="Search for pages, users..."
    />
  );
}, (prevProps: IsolatedSearchInputProps, nextProps: IsolatedSearchInputProps) => {
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
const SearchResultsSection = React.memo<SearchResultsSectionProps>(({
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
}, (prevProps: SearchResultsSectionProps, nextProps: SearchResultsSectionProps) => {
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
 * WeWrite Search Performance Optimization - SearchPageContent Component
 *
 * This component provides complete isolation between input and results to eliminate
 * performance issues and visual flashing during search input typing.
 *
 * Performance Architecture:
 * - Complete isolation between input and results components
 * - Input section never re-renders due to search state changes
 * - Results section only re-renders when search results actually change
 * - Custom React.memo comparison functions prevent unnecessary re-renders
 *
 * Component Isolation Benefits:
 * - Input typing only affects the input component, not the entire page
 * - Search results update independently without affecting input stability
 * - Eliminated visual flashing and blank screen issues
 * - Maintains perfect typing performance with zero interruptions
 *
 * State Management Optimization:
 * - Replaced currentQuery with lastSearchQuery (only updates after search completion)
 * - Functional state updates eliminate callback dependencies
 * - Stable callback references prevent unnecessary re-renders
 * - Feature flag optimization to avoid real-time listeners
 *
 * Architecture:
 * SearchPageContent (isolated)
 * ├── IsolatedSearchInput (isolated input)
 * ├── EmptySearchState (when no query)
 * └── SearchResultsDisplay (isolated results)
 */
const SearchPageContent: React.FC<SearchPageContentProps> = ({
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
