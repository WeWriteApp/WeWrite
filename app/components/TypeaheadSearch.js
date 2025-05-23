'use client';

import React from 'react';

// Minimal placeholder component to allow testing of search API
const TypeaheadSearch = (props) => {
  return (
    <div className="p-4 border border-gray-300 rounded">
      <p>TypeaheadSearch component temporarily disabled for testing</p>
      <p>Props: {JSON.stringify(Object.keys(props))}</p>
    </div>
  );
};

export default TypeaheadSearch;
