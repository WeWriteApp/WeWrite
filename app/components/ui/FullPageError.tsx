"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "./button";
import { toast } from "./use-toast";

interface FullPageErrorProps {
  /** The error object */
  error?: Error & { digest?: string };
  /** Function to reset/retry the error state */
  reset?: () => void;
  /** Custom title for the error */
  title?: string;
  /** Custom message for the error */
  message?: string;
  /** Whether to show the "Go Back" button */
  showGoBack?: boolean;
  /** Whether to show the "Go Home" button */
  showGoHome?: boolean;
  /** Whether to show the "Try Again" button */
  showTryAgain?: boolean;
  /** Custom retry function */
  onRetry?: () => void;
  /** Additional error info for debugging */
  errorInfo?: any;
}

interface ErrorDetails {
  message: string;
  stack: string;
  timestamp: string;
  userAgent: string;
  url: string;
  referrer: string;
}

/**
 * Unified Full Page Error Component
 * 
 * Provides a consistent error page layout with:
 * - Error icon and message
 * - Action buttons (Try Again, Go Home, Go Back)
 * - Collapsible error details with copy functionality
 * - Automatic error reporting
 */
export default function FullPageError({
  error,
  reset,
  title = "Something went wrong",
  message = "We're sorry, but there was an error loading this page.",
  showGoBack = true,
  showGoHome = true,
  showTryAgain = true,
  onRetry,
  errorInfo
}: FullPageErrorProps) {
  const [copied, setCopied] = useState(false);
  const [formattedErrorText, setFormattedErrorText] = useState("");

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  useEffect(() => {
    // Log the error to an error reporting service
    if (error) {
      console.error("FullPageError:", error, errorInfo);

      // Attempt to log to backend error service if available
      try {
        fetch("/api/errors", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            error: {
              message: error?.message || "Unknown error",
              stack: error?.stack || "",
              timestamp: new Date().toISOString(),
              url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
              errorInfo: errorInfo
            }
          })
        }).catch(e => console.warn("Failed to log error to backend:", e));
      } catch (e) {
        console.warn("Error logging to backend:", e);
      }
    }

    // Format error details
    try {
      const formatDetails: ErrorDetails = {
        message: error?.message || message || "Unknown error",
        stack: error?.stack || "",
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : "Unknown",
        url: typeof window !== 'undefined' ? window.location.href : "Unknown",
        referrer: typeof document !== 'undefined' ? document.referrer : "Unknown"
      };

      const formatted = `
Error Report:
============
Timestamp: ${formatDetails.timestamp}
URL: ${formatDetails.url}
Referrer: ${formatDetails.referrer}
User Agent: ${formatDetails.userAgent}
Message: ${formatDetails.message}

${formatDetails.stack ? `Stack Trace:\n${formatDetails.stack}` : ''}

${errorInfo ? `Additional Info:\n${JSON.stringify(errorInfo, null, 2)}` : ''}
      `.trim();

      setFormattedErrorText(formatted);
    } catch (e) {
      console.error("Error in error formatting:", e);
      setFormattedErrorText(`Error: ${error?.message || message}\nTimestamp: ${new Date().toISOString()}`);
    }
  }, [error, message, errorInfo]);

  // Function to copy error details to clipboard
  const copyToClipboard = async () => {
    if (typeof navigator === 'undefined') return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formattedErrorText);
        setCopied(true);
        toast({
          title: "Copied!",
          description: "Error details copied to clipboard"
        });
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = formattedErrorText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          setCopied(true);
          toast({
            title: "Copied!",
            description: "Error details copied to clipboard"
          });
        } else {
          toast({
            title: "Copy failed",
            description: "Unable to copy to clipboard",
            variant: "destructive"
          });
        }
      }
    } catch (err) {
      console.error('Failed to copy error details:', err);
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  // Handle retry/refresh
  const handleTryAgain = async () => {
    if (onRetry) {
      onRetry();
    } else if (reset) {
      reset();
    } else {
      // Fallback to page refresh
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  // Handle go home with state reset - use direct navigation for reliability
  const handleGoHome = () => {
    try {
      // Clear localStorage except theme
      if (typeof localStorage !== 'undefined') {
        const theme = localStorage.getItem('theme');
        localStorage.clear();
        if (theme) localStorage.setItem('theme', theme);
      }

      // Clear sessionStorage
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
    } catch (e) {
      console.error("Failed to clear storage:", e);
    }

    // Always use direct navigation - most reliable for chunk loading errors
    if (typeof window !== 'undefined') {
      window.location.href = `/?_cb=${Date.now()}`;
    }
  };

  // Handle go back - use direct navigation fallback
  const handleGoBack = () => {
    try {
      // Check if there's history to go back to
      if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back();
      } else {
        // No history, go home instead
        handleGoHome();
      }
    } catch (e) {
      console.error("Failed to go back:", e);
      // Fallback to home
      handleGoHome();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative">
      {/* Go Back icon button in top left */}
      {showGoBack && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4"
          onClick={handleGoBack}
          aria-label="Go back"
        >
          <Icon name="ArrowLeft" size={20} />
        </Button>
      )}

      <div className="max-w-md w-full wewrite-card p-8 rounded-lg shadow-lg text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
            <Icon name="AlertCircle" size={32} className="text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <h1 className="text-4xl font-bold mb-4">{title}</h1>
        <p className="text-lg text-muted-foreground mb-8">{message}</p>

        <div className="flex flex-col gap-4 mb-6">
          {showTryAgain && (
            <Button
              size="lg"
              className="gap-2 w-full"
              onClick={handleTryAgain}
            >
              <Icon name="RefreshCw" size={20} />
              Try again
            </Button>
          )}

          {showGoHome && (
            <Button
              variant="secondary"
              size="lg"
              className="gap-2 w-full"
              onClick={handleGoHome}
            >
              <Icon name="Home" size={20} />
              Go Home
            </Button>
          )}
        </div>

        {/* Error Details Section - always expanded */}
        {(error || formattedErrorText) && (
          <div className="w-full">
            <div className="bg-muted p-3 rounded-md mb-3 text-left">
              <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-48">
                {formattedErrorText}
              </pre>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="gap-2 w-full"
              onClick={copyToClipboard}
            >
              <Icon name="Copy" size={16} />
              {copied ? "Copied!" : "Copy Error"}
            </Button>
          </div>
        )}

        {/* Fallback link for noscript only */}
        <noscript>
          <a href="/" className="text-primary underline mt-4 block">Go to Home Page</a>
        </noscript>
      </div>
    </div>
  );
}
