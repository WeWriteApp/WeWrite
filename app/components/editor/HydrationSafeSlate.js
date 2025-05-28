"use client";

import React, { useState, useEffect } from 'react';
import { Slate } from 'slate-react';

/**
 * HydrationSafeSlate
 * 
 * A wrapper component for Slate that ensures it's only rendered after hydration is complete.
 * This helps prevent hydration errors that can occur with Slate.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.editor - The Slate editor instance
 * @param {Array} props.initialValue - The initial value for the Slate editor
 * @param {Function} props.onChange - Function to call when the editor content changes
 * @param {React.ReactNode} props.children - Child components to render inside Slate
 * @param {React.ReactNode} props.fallback - Optional fallback UI to show before hydration
 */
export default function HydrationSafeSlate({ 
  editor, 
  initialValue, 
  onChange, 
  children,
  fallback = null
}) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // First, detect if we're on the client
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Then, after a short delay, mark as hydrated
  useEffect(() => {
    if (isClient) {
      // Use requestAnimationFrame to ensure we're in a browser paint cycle
      const timeoutId = setTimeout(() => {
        requestAnimationFrame(() => {
          setIsHydrated(true);
        });
      }, 50); // Small delay to ensure hydration is complete
      
      return () => clearTimeout(timeoutId);
    }
  }, [isClient]);
  
  // If we're not on the client yet, render nothing or a fallback
  if (!isClient) {
    return fallback || null;
  }
  
  // If we're on the client but not fully hydrated, render a placeholder
  if (!isHydrated) {
    return fallback || (
      <div className="slate-placeholder p-4 bg-background rounded-lg">
        <div className="h-4 w-3/4 bg-muted rounded mb-2 animate-pulse"></div>
        <div className="h-4 w-1/2 bg-muted rounded mb-2 animate-pulse"></div>
        <div className="h-4 w-2/3 bg-muted rounded animate-pulse"></div>
      </div>
    );
  }
  
  // Once hydrated, render the actual Slate component
  return (
    <Slate
      editor={editor}
      initialValue={initialValue}
      onChange={onChange}
    >
      {children}
    </Slate>
  );
}
