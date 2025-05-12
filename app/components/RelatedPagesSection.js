"use client";

import React, { useState, useEffect, memo } from 'react';
import RelatedPages from './RelatedPages';

/**
 * RelatedPagesSection Component
 * 
 * A memoized wrapper for the RelatedPages component that prevents re-renders during scrolling.
 * This component maintains its own state and only renders once when the page is loaded.
 * 
 * @param {Object} page - The current page object
 * @param {Array} linkedPageIds - Array of page IDs that are already linked in the page content
 */
const RelatedPagesSection = memo(({ page, linkedPageIds = [] }) => {
  // Use state to track if the component has been mounted
  const [isMounted, setIsMounted] = useState(false);

  // Set mounted state on initial render
  useEffect(() => {
    if (!isMounted) {
      setIsMounted(true);
    }
  }, []);

  // Always render the container with the same structure to prevent layout shifts
  return (
    <div className="mt-8 pt-6 min-h-[100px]">
      {isMounted && page ? (
        <RelatedPages
          key={`related-${page.id}`}
          page={page}
          linkedPageIds={linkedPageIds}
        />
      ) : (
        <>
          <h3 className="text-lg font-medium mb-4">Related Pages</h3>
          <div className="py-2 text-muted-foreground text-sm">
            Loading related pages...
          </div>
        </>
      )}
    </div>
  );
});

// Set display name for debugging
RelatedPagesSection.displayName = 'RelatedPagesSection';

export default RelatedPagesSection;
