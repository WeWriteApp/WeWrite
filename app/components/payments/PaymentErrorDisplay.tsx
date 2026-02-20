"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '../ui/collapsible';
import { toast } from '../ui/use-toast';
import { cn } from '../../lib/utils';
import { formatStripeErrorForDisplay, createDetailedErrorLog } from '../../utils/stripeErrorMessages';

interface PaymentErrorDisplayProps {
  /** The error object from Stripe or payment processing */
  error: any;
  /** Optional callback to retry the payment */
  onRetry?: () => void;
  /** Whether the retry button should be shown */
  showRetry?: boolean;
  /** Whether to show detailed technical information */
  showTechnicalDetails?: boolean;
  /** Additional context for error logging */
  context?: Record<string, any>;
  /** Custom CSS classes */
  className?: string;
  /** Whether the error display is in a compact mode */
  compact?: boolean;
}

/**
 * Enhanced payment error display component with detailed Stripe error handling
 */
export function PaymentErrorDisplay({
  error,
  onRetry,
  showRetry = true,
  showTechnicalDetails = false,
  context,
  className,
  compact = false
}: PaymentErrorDisplayProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Parse the error using our detailed error utility
  const errorDetails = formatStripeErrorForDisplay(error);

  const handleRetry = async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCopyError = () => {
    const errorLog = createDetailedErrorLog(error, context);
    navigator.clipboard.writeText(errorLog);
    toast({
      title: "Error details copied",
      description: "Technical error information has been copied to your clipboard."
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-50 dark:bg-red-950/20',
          border: 'border-theme-medium',
          borderStyle: { borderColor: 'hsl(0 84% 60% / 0.3)' },
          text: 'text-red-800 dark:text-red-200',
          icon: 'text-red-600 dark:text-red-400'
        };
      case 'high':
        return {
          bg: 'bg-orange-50 dark:bg-orange-950/20',
          border: 'border-theme-medium',
          borderStyle: { borderColor: 'hsl(30 80% 50% / 0.3)' },
          text: 'text-orange-800 dark:text-orange-200',
          icon: 'text-orange-600 dark:text-orange-400'
        };
      case 'medium':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-950/20',
          border: 'border-theme-medium',
          borderStyle: { borderColor: 'hsl(45 93% 47% / 0.3)' },
          text: 'text-yellow-800 dark:text-yellow-200',
          icon: 'text-yellow-600 dark:text-yellow-400'
        };
      default:
        return {
          bg: 'bg-muted/50',
          border: 'border-theme-medium',
          borderStyle: { borderColor: 'oklch(var(--border))' },
          text: 'text-muted-foreground',
          icon: 'text-muted-foreground'
        };
    }
  };

  const colors = getSeverityColor(errorDetails.severity);

  const getSeverityBadge = () => {
    const variant = errorDetails.severity === 'critical' || errorDetails.severity === 'high' 
      ? 'destructive' 
      : errorDetails.severity === 'medium' 
        ? 'secondary' 
        : 'outline';
    
    return (
      <Badge variant={variant} className="text-xs">
        {errorDetails.severity.toUpperCase()}
      </Badge>
    );
  };

  if (compact) {
    return (
      <Alert variant="destructive" className={cn('', className)}>
        <Icon name="AlertTriangle" size={16} />
        <AlertTitle className="flex items-center justify-between">
          {errorDetails.title}
          {getSeverityBadge()}
        </AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{errorDetails.message}</p>
          {showRetry && errorDetails.retryable && onRetry && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying}
              className="gap-2"
            >
              <Icon name={isRetrying ? "Loader" : "RefreshCw"} size={12} />
              {isRetrying ? 'Retrying...' : 'Try Again'}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={cn('border-l-4', colors.border, colors.bg, className)} style={colors.borderStyle}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-full bg-background shadow-sm')}>
              <Icon name="CreditCard" size={20} className={colors.icon} />
            </div>
            <div>
              <CardTitle className={cn('text-lg', colors.text)}>
                {errorDetails.title}
              </CardTitle>
              <p className={cn('text-sm mt-1', colors.text, 'opacity-80')}>
                {errorDetails.message}
              </p>
            </div>
          </div>
          {getSeverityBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Action Steps */}
        <div>
          <h4 className={cn('font-medium text-sm mb-2', colors.text)}>
            What you can do:
          </h4>
          <ul className="space-y-1">
            {errorDetails.steps.map((step, index) => (
              <li key={index} className={cn('text-sm flex items-start gap-2', colors.text, 'opacity-90')}>
                <span className="text-xs mt-1">•</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          {showRetry && errorDetails.retryable && onRetry && (
            <Button
              variant="default"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying}
              className="gap-2"
            >
              <Icon name={isRetrying ? "Loader" : "RefreshCw"} size={12} />
              {isRetrying ? 'Retrying Payment...' : 'Try Payment Again'}
            </Button>
          )}
          
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open('/settings/subscription', '_blank')}
            className="gap-2"
          >
            <Icon name="ExternalLink" size={12} />
            Update Payment Method
          </Button>
        </div>

        {/* Technical Details (Collapsible) */}
        {showTechnicalDetails && (
          <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-xs p-0 h-auto"
              >
                <Icon name="ChevronDown" size={12} className={cn(
                  "transition-transform",
                  isDetailsOpen && "rotate-180"
                )} />
                {isDetailsOpen ? 'Hide' : 'Show'} Technical Details
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Error Details
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyError}
                    className="gap-1 h-auto p-1 text-xs"
                  >
                    <Icon name="Copy" size={12} />
                    Copy
                  </Button>
                </div>
                <div className="text-xs font-mono text-muted-foreground space-y-1">
                  {error?.type && <div><strong>Type:</strong> {error.type}</div>}
                  {error?.code && <div><strong>Code:</strong> {error.code}</div>}
                  {error?.decline_code && <div><strong>Decline Code:</strong> {error.decline_code}</div>}
                  {error?.message && <div><strong>Message:</strong> {error.message}</div>}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Help Text */}
        <div className="text-xs text-muted-foreground pt-2 border-t-only">
          <p>
            If you continue having issues, please contact your bank or{' '}
            <button 
              className="underline hover:no-underline"
              onClick={() => window.open('/support', '_blank')}
            >
              contact our support team
            </button>
            {' '}for assistance.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
