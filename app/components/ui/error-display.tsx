"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from './button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from './collapsible';
import { toast } from './use-toast';
import { cn } from '../../lib/utils';

interface ErrorDisplayProps {
  /** The error message to display */
  message: string;
  /** Optional error object for detailed information */
  error?: Error | null;
  /** Optional stack trace to display */
  stack?: string;
  /** Optional callback to retry the operation */
  onRetry?: () => void;
  /** Optional additional CSS classes */
  className?: string;
  /** Severity level of the error */
  severity?: 'error' | 'warning' | 'info';
  /** Whether to show the collapsible error details section */
  showDetails?: boolean;
  /** Whether to show the retry button */
  showRetry?: boolean;
  /** Custom title for the error display */
  title?: string;
}

/**
 * A reusable component for displaying errors with optional details and retry functionality
 */
export function ErrorDisplay({
  message,
  error = null,
  stack,
  onRetry,
  className,
  severity = 'error',
  showDetails = true,
  showRetry = true,
  title
}: ErrorDisplayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Determine colors based on severity
  const colors = {
    error: {
      bg: 'bg-orange-500/10',
      text: 'text-orange-700 dark:text-orange-400',
      border: 'border-orange-500/30',
      bgLight: 'bg-orange-500/5'
    },
    warning: {
      bg: 'bg-amber-100 dark:bg-amber-900/20',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-theme-medium',
      bgLight: 'bg-amber-50 dark:bg-amber-950/30'
    },
    info: {
      bg: 'bg-primary/10 dark:bg-primary/20',
      text: 'text-primary dark:text-primary',
      border: 'border-theme-medium',
      bgLight: 'bg-primary/5 dark:bg-primary/10'
    }
  };

  const color = colors[severity];

  // Format error details
  const errorDetails = {
    message: error?.message || message,
    stack: stack || error?.stack || '',
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'Unknown'};

  const formattedErrorText = `
Error Details:
-------------
Timestamp: ${errorDetails.timestamp}
URL: ${errorDetails.url}
User Agent: ${errorDetails.userAgent}
Message: ${errorDetails.message}

${errorDetails.stack ? `Stack Trace:\n${errorDetails.stack}` : ''}
  `.trim();

  // Function to copy error details to clipboard with fallbacks
  const copyToClipboard = async () => {
    if (typeof navigator === 'undefined') return;

    try {
      // Try to use the Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formattedErrorText);
        setCopied(true);
        toast.success('Error details copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
        return;
      }

      // Fallback to document.execCommand (older browsers)
      const textArea = document.createElement('textarea');
      textArea.value = formattedErrorText;

      // Make the textarea out of viewport
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);

      // Select and copy
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        setCopied(true);
        toast.success('Error details copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error('Failed to copy to clipboard');
      }
    } catch (err) {
      console.error('Failed to copy error details:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  // Function to handle retry with application state reset
  const handleRetry = () => {
    if (typeof window !== 'undefined') {
      // Dynamically import the error recovery utility
      import('../../utils/error-recovery').then(({ resetApplicationState }) => {
        // Reset application state but don't force reload
        resetApplicationState({
          forceReload: false,
          preserveTheme: true
        }).then(() => {
          // Call the onRetry callback if provided
          if (onRetry) onRetry();
        });
      }).catch(e => {
        console.error('Failed to import error recovery utilities:', e);
        // Call the onRetry callback directly if import fails
        if (onRetry) onRetry();
      });
    } else {
      // Call the onRetry callback directly if not in browser
      if (onRetry) onRetry();
    }
  };

  return (
    <div className={cn('rounded-lg overflow-hidden', className)}>
      <div className={cn('p-4 rounded-lg', color.bgLight)}>
        <div className="flex items-start gap-3">
          <div className={cn('mt-0.5 p-1.5 rounded-full', color.bg)}>
            <Icon name="AlertCircle" size={16} className={color.text} />
          </div>
          <div className="flex-1">
            <h3 className={cn('text-sm font-medium', color.text)}>
              {title || (severity === 'error' ? 'Error' : severity === 'warning' ? 'Warning' : 'Information')}
            </h3>
            <div className="mt-1 text-sm">
              {message}
            </div>

            {showRetry && onRetry && (
              <Button
                variant="secondary"
                size="sm"
                className={cn('mt-3 gap-1.5', color.text, color.border)}
                onClick={handleRetry}
              >
                <Icon name="RefreshCw" size={24} className="h-3.5 w-3.5" />
                Try again
              </Button>
            )}
          </div>
        </div>

        {showDetails && (errorDetails.stack || error) && (
          <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="w-full mt-3 border rounded-md"
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full flex items-center justify-between p-2 h-auto"
              >
                <span className="text-xs">Error Details</span>
                <Icon name="ChevronDown" size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3">
              <div className="bg-muted p-2 rounded-md mb-2 text-left">
                <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-40">
                  {formattedErrorText}
                </pre>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5 w-full text-xs h-8"
                onClick={copyToClipboard}
              >
                <Icon name="Copy" size={24} className="h-3.5 w-3.5" />
                {copied ? "Copied!" : "Copy to Clipboard"}
              </Button>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}