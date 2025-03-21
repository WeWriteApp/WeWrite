"use client";

import React, { useState, useEffect } from 'react';
import DraggableWrapper from './DraggableWrapper';

/**
 * A draggable Google Analytics debugger component
 * Shows recent GA events and pageviews
 */
const GADebugger = () => {
  const [events, setEvents] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  // Toggle visibility with keyboard shortcut (Alt+Shift+G)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.shiftKey && e.key === 'G') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize GA event tracking
  useEffect(() => {
    if (!isVisible) return;

    // Check if GA is available
    if (typeof window !== 'undefined' && window.GA_INITIALIZED) {
      setIsEnabled(true);
      
      // Create a proxy for the original ReactGA.send method
      const originalSend = window.ReactGA?.send;
      
      if (originalSend) {
        window.ReactGA.send = function(data) {
          // Add event to our log
          setEvents(prev => [{
            timestamp: new Date(),
            data: JSON.parse(JSON.stringify(data)), // Deep clone to avoid reference issues
            type: data.hitType || 'unknown'
          }, ...prev.slice(0, 19)]); // Keep only the 20 most recent events
          
          // Call the original method
          return originalSend.apply(this, arguments);
        };
      }
    }

    return () => {
      // Restore original method when component unmounts
      if (typeof window !== 'undefined' && window.ReactGA && window.originalSend) {
        window.ReactGA.send = window.originalSend;
      }
    };
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <DraggableWrapper
      id="ga-debugger"
      className="w-80"
      initialPosition={{ x: 20, y: 20 }}
    >
      <div className="p-3">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium">GA Debugger</h3>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-xs text-muted-foreground">{isEnabled ? 'Connected' : 'Not connected'}</span>
          </div>
        </div>
        
        {!isEnabled && (
          <div className="text-xs text-amber-500 mb-2">
            Google Analytics not initialized or detected
          </div>
        )}
        
        <div className="text-xs text-muted-foreground mb-1">
          Recent events ({events.length})
        </div>
        
        <div className="max-h-60 overflow-y-auto border rounded border-border/40 bg-muted/30">
          {events.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground">
              No events captured yet
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {events.map((event, index) => (
                <div key={index} className="p-2 text-xs hover:bg-muted/50">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{event.type}</span>
                    <span className="text-muted-foreground">
                      {event.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="mt-1 text-[10px] overflow-x-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground">
          Press Alt+Shift+G to toggle this debugger
        </div>
      </div>
    </DraggableWrapper>
  );
};

export default GADebugger;
