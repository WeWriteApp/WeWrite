'use client';

import SearchResults from './SearchResults';

/**
 * TypeaheadSearch Component (Deprecated)
 *
 * This component has been renamed to SearchResults for better clarity.
 * This wrapper maintains backward compatibility while we transition.
 *
 * @deprecated Use SearchResults component instead
 */
const TypeaheadSearch = (props) => {
  return <SearchResults {...props} />;
};

export default TypeaheadSearch;
