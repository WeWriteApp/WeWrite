"use client";

import { useState, useEffect, forwardRef } from 'react';
import dynamic from 'next/dynamic';
import EditorErrorBoundary from './EditorErrorBoundary';

// Dynamically import the Editor with no SSR
const Editor = dynamic(() => import('./Editor'), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-[200px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="loader loader-md"></div>
        <span className="text-sm text-muted-foreground">Loading editor...</span>
      </div>
    </div>
  )
});

/**
 * ClientOnlyEditor - A wrapper that ensures the Slate.js editor only renders on the client
 * This prevents all hydration issues by completely avoiding SSR for the editor
 */
const ClientOnlyEditor = forwardRef(({ initialContent, onChange, placeholder, contentType, ...props }, ref) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // First mount check
    setIsMounted(true);

    // Add a small delay to ensure DOM is fully ready
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Don't render anything until we're mounted and ready
  if (!isMounted || !isReady) {
    return (
      <div className="w-full min-h-[200px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="loader loader-md"></div>
          <span className="text-sm text-muted-foreground">Loading editor...</span>
        </div>
      </div>
    );
  }

  return (
    <EditorErrorBoundary>
      <Editor
        ref={ref}
        initialContent={initialContent}
        onChange={onChange}
        placeholder={placeholder}
        contentType={contentType}
        {...props}
      />
    </EditorErrorBoundary>
  );
});

ClientOnlyEditor.displayName = 'ClientOnlyEditor';

export default ClientOnlyEditor;
