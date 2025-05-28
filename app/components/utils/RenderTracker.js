"use client";

import React, { useEffect, useRef } from 'react';

/**
 * RenderTracker Component
 * 
 * A utility component for tracking and logging component renders
 * Useful for performance debugging and optimization
 */
export default function RenderTracker({ name, props = {}, enabled = true }) {
  const renderCount = useRef(0);
  const lastProps = useRef(props);
  const mountTime = useRef(Date.now());

  // Increment render count
  renderCount.current += 1;

  useEffect(() => {
    if (!enabled) return;

    const currentTime = Date.now();
    const timeSinceMount = currentTime - mountTime.current;

    // Log render information
    console.log(`[RenderTracker] ${name}:`, {
      renderCount: renderCount.current,
      timeSinceMount: `${timeSinceMount}ms`,
      props: props,
      propsChanged: JSON.stringify(props) !== JSON.stringify(lastProps.current)
    });

    // Update last props reference
    lastProps.current = props;
  });

  // Component mount/unmount tracking
  useEffect(() => {
    if (!enabled) return;

    console.log(`[RenderTracker] ${name} mounted`);
    
    return () => {
      console.log(`[RenderTracker] ${name} unmounted after ${renderCount.current} renders`);
    };
  }, [name, enabled]);

  // This component doesn't render anything visible
  return null;
}
