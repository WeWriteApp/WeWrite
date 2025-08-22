"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "./button";
import { Home, ArrowLeft, RefreshCw, ChevronDown, Copy, AlertCircle } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "./collapsible";
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
  const [isOpen, setIsOpen] = useState(false);
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

  // Handle go home with state reset
  const handleGoHome = async () => {
    try {
      // Try to use error recovery utilities
      const { resetApplicationState } = await import('../../utils/error-recovery');
      await resetApplicationState({
        forceReload: true,
        redirectUrl: '/',
        preserveTheme: true,
        clearCache: true
      });
    } catch (e) {
      console.error("Failed to import error recovery utilities:", e);
      
      // Fallback implementation
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

        // Redirect with cache buster
        if (typeof window !== 'undefined') {
          window.location.href = `/?_cb=${Date.now()}`;
        }
      } catch (fallbackError) {
        console.error("Fallback reset also failed:", fallbackError);
        // Last resort - just redirect
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full wewrite-card p-8 rounded-lg shadow-lg text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
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
              <RefreshCw className="h-5 w-5" />
              Try again
            </Button>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {showGoHome && (
              <Button
                size="lg"
                className="gap-2 w-full sm:w-1/2"
                onClick={handleGoHome}
              >
                <Home className="h-5 w-5" />
                Back to Home
              </Button>
            )}
            
            {showGoBack && (
              <Button
                variant="outline"
                size="lg"
                className="gap-2 w-full sm:w-1/2"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="h-5 w-5" />
                Go Back
              </Button>
            )}
          </div>
        </div>

        {/* Error Details Section */}
        {(error || formattedErrorText) && (
          <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="w-full border rounded-md"
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full flex items-center justify-between p-4"
              >
                <span>Error Details</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4">
              <div className="bg-muted p-3 rounded-md mb-3 text-left">
                <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-60">
                  {formattedErrorText}
                </pre>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 w-full"
                onClick={copyToClipboard}
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copied!" : "Copy to Clipboard"}
              </Button>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
