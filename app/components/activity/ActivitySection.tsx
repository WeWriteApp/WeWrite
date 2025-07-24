'use client';

import React from 'react';
import SimpleRecentEdits from '../features/SimpleRecentEdits';

interface ActivitySectionProps {
  limit?: number;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * ActivitySection component - simplified without unnecessary dynamic loading
 * This is the main ActivitySection implementation that should be used throughout the app.
 */
const ActivitySection = React.memo(function ActivitySection({
  limit = 4,
  priority = "high"
}: ActivitySectionProps) {
  return (
    <div style={{ minHeight: '200px' }}>
      <SimpleRecentEdits />
    </div>
  );
});

export default ActivitySection;