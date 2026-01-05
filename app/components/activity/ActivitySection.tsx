'use client';

import React from 'react';
import ActivityFeed from '../features/ActivityFeed';

interface ActivitySectionProps {
  limit?: number;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * ActivitySection component - wrapper for ActivityFeed
 * This component provides a minimal wrapper around ActivityFeed for use in layouts.
 */
const ActivitySection = React.memo(function ActivitySection({
  limit = 4,
  priority = "high"
}: ActivitySectionProps) {
  return (
    <div style={{ minHeight: '200px' }}>
      <ActivityFeed mode="global" />
    </div>
  );
});

export default ActivitySection;
