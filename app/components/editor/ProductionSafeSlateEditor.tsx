"use client";

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';

// Only import Slate components on client-side to prevent production hydration issues
const SlateEditor = dynamic(() => import('./SlateEditor'), {
  ssr: false,
  loading: () => (
    <div className="w-full p-4 border rounded-lg">
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-3/4"></div>
        <div className="h-4 bg-muted rounded w-1/2"></div>
        <div className="h-4 bg-muted rounded w-5/6"></div>
      </div>
    </div>
  )
});

interface ProductionSafeSlateEditorProps {
  initialContent?: any[];
  onChange?: (content: any[]) => void;
  onEmptyLinesChange?: (emptyLines: number) => void;
  placeholder?: string;
  readOnly?: boolean;
  location?: any;
  setLocation?: (location: any) => void;
  onSave?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  isSaving?: boolean;
  error?: string | null;
  isNewPage?: boolean;
  showToolbar?: boolean;
  onInsertLinkRequest?: () => void;
}

/**
 * ProductionSafeSlateEditor - Environment-aware Slate editor wrapper
 * 
 * This component handles the differences between local development and production
 * environments to prevent hydration mismatches and React errors.
 */
export default function ProductionSafeSlateEditor(props: ProductionSafeSlateEditorProps) {
  const [isClient, setIsClient] = useState(false);
  const [isProduction, setIsProduction] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setIsProduction(process.env.NODE_ENV === 'production');
  }, []);

  // Don't render anything until we're on the client
  if (!isClient) {
    return (
      <div className="w-full p-4 border rounded-lg">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-4 bg-muted rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  // In production, add extra safety measures
  if (isProduction) {
    return (
      <div className="production-safe-editor">
        <SlateEditor {...props} />
      </div>
    );
  }

  // In development, render normally
  return <SlateEditor {...props} />;
}
