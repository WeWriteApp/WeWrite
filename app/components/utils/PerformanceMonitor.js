"use client";

import React, { useRef, useEffect } from 'react';

/**
 * PerformanceMonitor Component
 * 
 * A lightweight performance monitoring component that tracks re-renders
 * without causing additional re-renders itself. Only active in development.
 * 
 * @param {Object} props
 * @param {string} props.name - Name of the component being monitored
 * @param {Object} props.data - Data to track for changes
 * @param {boolean} props.enabled - Whether monitoring is enabled
 */
const PerformanceMonitor = React.memo(function PerformanceMonitor({ 
  name, 
  data = {}, 
  enabled = process.env.NODE_ENV === 'development' 
}) {
  const renderCount = useRef(0);
  const prevData = useRef(data);
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;

    renderCount.current += 1;
    const currentTime = Date.now();
    const timeSinceStart = currentTime - startTime.current;
    
    // Check which data properties changed
    const changedData = {};
    const currentData = data;
    const previousData = prevData.current;

    Object.keys(currentData).forEach(key => {
      if (currentData[key] !== previousData[key]) {
        changedData[key] = {
          from: previousData[key],
          to: currentData[key]
        };
      }
    });

    // Check for removed properties
    Object.keys(previousData).forEach(key => {
      if (!(key in currentData)) {
        changedData[key] = {
          from: previousData[key],
          to: undefined
        };
      }
    });

    // Performance monitoring data collected but not logged in production

    prevData.current = currentData;
  });

  // Never render anything to avoid affecting layout
  return null;
});

PerformanceMonitor.displayName = 'PerformanceMonitor';

export default PerformanceMonitor;