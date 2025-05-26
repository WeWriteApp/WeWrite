"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { SectionTitle } from './ui/section-title';
import RecentActivity from './RecentActivity';

/**
 * ActivitySection Component
 *
 * A wrapper component that combines the SectionTitle and RecentActivity components,
 * placing the filter dropdown in the section title header.
 */
const ActivitySection = () => {
  const activityRef = useRef(null);
  const [filterComponent, setFilterComponent] = useState(null);

  // After the component mounts, get the filter dropdown from the RecentActivity component
  useEffect(() => {
    if (activityRef.current) {
      // Get the filter dropdown component
      const filterDropdown = activityRef.current.FilterDropdown();
      setFilterComponent(filterDropdown);
    }
  }, []);

  return (
    <div style={{ minHeight: '200px' }}>
      <RecentActivity
        ref={activityRef}
        limit={4}
        renderFilterInHeader={true}
      />
    </div>
  );
};

export default ActivitySection;
