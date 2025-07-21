"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { SectionTitle } from "../ui/section-title";
import SimpleRecentEdits from '../features/SimpleRecentEdits';

/**
 * ActivitySectionCore Component
 *
 * A wrapper component that combines the SectionTitle and RecentActivity components,
 * placing the filter dropdown in the section title header.
 * This is the core implementation used by the optimized ActivitySection wrapper.
 */
const ActivitySectionCore: React.FC = () => {
  const activityRef = useRef<any>(null);
  const [filterComponent, setFilterComponent] = useState<React.ReactNode>(null);

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
      <SimpleRecentEdits />
    </div>
  );
};

export default ActivitySectionCore;