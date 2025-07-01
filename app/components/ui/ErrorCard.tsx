"use client";

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { CopyErrorButton } from './CopyErrorButton';

interface ErrorCardProps {
  title?: string;
  message?: string;
  error?: Error | string;
  errorInfo?: React.ErrorInfo;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  showDetails?: boolean;
}

export function ErrorCard({
  title = "Something went wrong",
  message = "An error occurred. Please try again.",
  error,
  errorInfo,
  onRetry,
  retryLabel = "Try Again",
  className = "",
  showDetails = true
}: ErrorCardProps) {
  return (
    <div className={`wewrite-card ${className}`}>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4 max-w-md">
          {message}
        </p>
        
        {/* Error details */}
        {showDetails && error && (
          <details className="mb-4 text-sm text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              Error details
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-w-md">
              {error instanceof Error ? error.message : error}
            </pre>
          </details>
        )}
        
        {/* Action buttons */}
        <div className="flex gap-2">
          {onRetry && (
            <Button onClick={onRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {retryLabel}
            </Button>
          )}
          {error && (
            <CopyErrorButton 
              error={error} 
              errorInfo={errorInfo}
            />
          )}
        </div>
      </div>
    </div>
  );
}