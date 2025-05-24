"use client";

import React, { useRef, useEffect } from 'react';

/**
 * RenderTracker Component
 * 
 * A development utility component that logs when a component re-renders
 * and helps identify the cause of re-renders.
 * 
 * @param {Object} props
 * @param {string} props.name - Name of the component being tracked
 * @param {Object} props.props - Props to track for changes
 * @param {boolean} props.enabled - Whether tracking is enabled (default: false in production)
 */
const RenderTracker = React.memo(function RenderTracker({ 
  name, 
  props = {}, 
  enabled = process.env.NODE_ENV === 'development' 
}) {
  const renderCount = useRef(0);
  const prevProps = useRef(props);

  useEffect(() => {
    if (!enabled) return;

    renderCount.current += 1;
    
    // Check which props changed
    const changedProps = {};
    const currentProps = props;
    const previousProps = prevProps.current;

    Object.keys(currentProps).forEach(key => {
      if (currentProps[key] !== previousProps[key]) {
        changedProps[key] = {
          from: previousProps[key],
          to: currentProps[key]
        };
      }
    });

    // Check for new props
    Object.keys(previousProps).forEach(key => {
      if (!(key in currentProps)) {
        changedProps[key] = {
          from: previousProps[key],
          to: undefined
        };
      }
    });

    if (Object.keys(changedProps).length > 0) {
      console.log(`🔄 ${name} re-rendered (${renderCount.current}) - Props changed:`, changedProps);
    } else if (renderCount.current > 1) {
      console.log(`🔄 ${name} re-rendered (${renderCount.current}) - No prop changes detected`);
    } else {
      console.log(`🆕 ${name} initial render`);
    }

    prevProps.current = currentProps;
  });

  // Don't render anything in production or when disabled
  if (!enabled) {
    return null;
  }

  return (
    <div 
      style={{ 
        position: 'fixed', 
        top: 10, 
        right: 10, 
        background: 'rgba(0,0,0,0.8)', 
        color: 'white', 
        padding: '4px 8px', 
        fontSize: '12px',
        borderRadius: '4px',
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    >
      {name}: {renderCount.current}
    </div>
  );
});

RenderTracker.displayName = 'RenderTracker';

export default RenderTracker;
