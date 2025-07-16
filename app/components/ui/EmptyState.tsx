"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showDebugInfo?: boolean;
  debugInfo?: {
    dataSource?: string;
    lastFetch?: string;
    errorCount?: number;
    apiEndpoint?: string;
    environment?: string;
  };
}

/**
 * Standardized Empty State Component
 * 
 * Provides consistent empty states across all homepage sections
 * with optional debug information for development
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  size = 'md',
  showDebugInfo = false,
  debugInfo
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: 'p-6',
      icon: 'h-6 w-6 mb-2',
      title: 'text-sm font-medium',
      description: 'text-xs'
    },
    md: {
      container: 'p-8',
      icon: 'h-8 w-8 mb-3',
      title: 'text-base font-medium',
      description: 'text-sm'
    },
    lg: {
      container: 'p-12',
      icon: 'h-12 w-12 mb-4',
      title: 'text-lg font-medium',
      description: 'text-base'
    }
  };

  const classes = sizeClasses[size];

  return (
    <div className={cn(
      "border border-border rounded-lg text-center text-muted-foreground",
      classes.container,
      className
    )}>
      <Icon className={cn("mx-auto opacity-50", classes.icon)} />
      <h3 className={cn("mb-1", classes.title)}>
        {title}
      </h3>
      <p className={classes.description}>
        {description}
      </p>
      
      {/* Debug Information - only show in development */}
      {showDebugInfo && debugInfo && process.env.NODE_ENV === 'development' && (
        <details className="mt-4 text-left">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            🔍 Debug Info
          </summary>
          <div className="mt-2 p-3 bg-muted/30 rounded text-xs font-mono space-y-1">
            {debugInfo.dataSource && (
              <div><span className="text-primary">Source:</span> {debugInfo.dataSource}</div>
            )}
            {debugInfo.apiEndpoint && (
              <div><span className="text-primary">API:</span> {debugInfo.apiEndpoint}</div>
            )}
            {debugInfo.environment && (
              <div><span className="text-primary">Env:</span> {debugInfo.environment}</div>
            )}
            {debugInfo.lastFetch && (
              <div><span className="text-primary">Last Fetch:</span> {debugInfo.lastFetch}</div>
            )}
            {debugInfo.errorCount !== undefined && (
              <div><span className="text-primary">Errors:</span> {debugInfo.errorCount}</div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
