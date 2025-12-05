"use client";

import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, Copy, Check, RefreshCw, ChevronDown } from 'lucide-react';
import { Button } from './button';
import { cn } from '../../lib/utils';

export type InlineErrorVariant = 'error' | 'warning' | 'info';
export type InlineErrorSize = 'sm' | 'md' | 'lg';

interface InlineErrorProps {
  /** The main message to display */
  message: string;
  /** Optional title/heading */
  title?: string;
  /** Visual variant */
  variant?: InlineErrorVariant;
  /** Size variant */
  size?: InlineErrorSize;
  /** Optional error details for copy functionality */
  errorDetails?: string;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Label for retry button */
  retryLabel?: string;
  /** Whether to show copy button */
  showCopy?: boolean;
  /** Whether to show details in collapsible */
  showCollapsible?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Children for additional content */
  children?: React.ReactNode;
}

/**
 * InlineError - Unified component for all inline error/warning/info displays
 * 
 * Variants:
 * - error: Orange background/border for errors (bg-orange-500/10, border-orange-500/30)
 * - warning: Amber background/border for warnings
 * - info: Primary color background/border for informational messages
 * 
 * Sizes:
 * - sm: Compact, single line, minimal padding
 * - md: Standard size with icon and message
 * - lg: Full featured with title, message, actions
 */
export function InlineError({
  message,
  title,
  variant = 'error',
  size = 'md',
  errorDetails,
  onRetry,
  retryLabel = 'Try Again',
  showCopy = true,
  showCollapsible = false,
  className,
  children
}: InlineErrorProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Variant styles
  const variantStyles = {
    error: {
      container: 'bg-orange-500/10 border-orange-500/30',
      text: 'text-orange-700 dark:text-orange-400',
      icon: 'text-orange-600 dark:text-orange-400',
      iconBg: 'bg-orange-500/20'
    },
    warning: {
      container: 'bg-amber-500/10 border-amber-500/30',
      text: 'text-amber-700 dark:text-amber-400',
      icon: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-500/20'
    },
    info: {
      container: 'bg-primary/10 border-primary/30',
      text: 'text-primary',
      icon: 'text-primary',
      iconBg: 'bg-primary/20'
    }
  };

  // Size styles
  const sizeStyles = {
    sm: {
      container: 'p-2 text-xs',
      icon: 'h-3 w-3',
      gap: 'gap-1.5'
    },
    md: {
      container: 'p-3 text-sm',
      icon: 'h-4 w-4',
      gap: 'gap-2'
    },
    lg: {
      container: 'p-4 text-sm',
      icon: 'h-5 w-5',
      gap: 'gap-3'
    }
  };

  const styles = variantStyles[variant];
  const sizes = sizeStyles[size];

  // Icon selection based on variant
  const IconComponent = variant === 'error' ? AlertTriangle : variant === 'warning' ? AlertCircle : Info;

  // Copy error details to clipboard
  const handleCopy = async () => {
    const textToCopy = errorDetails || message;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Small variant - compact inline display
  if (size === 'sm') {
    return (
      <div className={cn(
        'flex items-center rounded-md border',
        styles.container,
        sizes.container,
        sizes.gap,
        className
      )}>
        <IconComponent className={cn(sizes.icon, styles.icon)} />
        <span className={styles.text}>{message}</span>
        {showCopy && errorDetails && (
          <button
            type="button"
            onClick={handleCopy}
            className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        )}
      </div>
    );
  }

  // Medium variant - standard error display
  if (size === 'md') {
    return (
      <div className={cn(
        'rounded-md border',
        styles.container,
        sizes.container,
        className
      )}>
        <div className={cn('flex items-start', sizes.gap)}>
          <IconComponent className={cn(sizes.icon, styles.icon, 'mt-0.5 shrink-0')} />
          <div className="flex-1 min-w-0">
            {title && <div className={cn('font-medium mb-1', styles.text)}>{title}</div>}
            <div className={styles.text}>{message}</div>
            {children}
            
            {/* Action buttons */}
            {(showCopy && errorDetails) || onRetry ? (
              <div className="flex items-center gap-2 mt-2">
                {onRetry && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="h-7 text-xs gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {retryLabel}
                  </Button>
                )}
                {showCopy && errorDetails && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors bg-background/50 px-2 py-1 rounded border border-border"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy Error
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // Large variant - full featured with collapsible details
  return (
    <div className={cn(
      'rounded-lg border',
      styles.container,
      sizes.container,
      className
    )}>
      <div className={cn('flex items-start', sizes.gap)}>
        <div className={cn('p-1.5 rounded-full shrink-0', styles.iconBg)}>
          <IconComponent className={cn(sizes.icon, styles.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          {title && <h3 className={cn('font-semibold mb-1', styles.text)}>{title}</h3>}
          <p className={cn('mb-2', styles.text)}>{message}</p>
          {children}
          
          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="h-8 text-xs gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {retryLabel}
              </Button>
            )}
            {showCopy && errorDetails && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-8 text-xs gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Error
                  </>
                )}
              </Button>
            )}
          </div>
          
          {/* Collapsible error details */}
          {showCollapsible && errorDetails && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')} />
                Error Details
              </button>
              {isExpanded && (
                <pre className="mt-2 p-2 bg-background/50 rounded text-xs overflow-x-auto max-h-40 text-muted-foreground border border-border">
                  {errorDetails}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InlineError;
