"use client";

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import PledgeBar with no SSR to avoid hydration issues
const PledgeBar = dynamic(() => import('./PledgeBar'), {
  ssr: false
});

/**
 * PagePledgeBar Component
 * 
 * This component is used to explicitly render the PledgeBar on page views.
 * It's a simple wrapper that ensures the PledgeBar is included in the page.
 */
const PagePledgeBar: React.FC = () => {
  return <PledgeBar />;
};

export default PagePledgeBar;
