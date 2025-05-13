"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "./components/ui/button";
import { Home, ArrowLeft, RefreshCw, ChevronDown, Copy, AlertCircle } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "./components/ui/collapsible";
import { toast } from "sonner";

export default function Error({ error, reset }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);

    // Attempt to log to backend error service if available
    try {
      fetch("/api/errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: {
            message: error?.message || "Unknown error",
            stack: error?.stack || "",
            timestamp: new Date().toISOString(),
            url: window.location.href,
          }
        }),
      }).catch(e => console.error("Failed to log error to backend:", e));
    } catch (e) {
      console.error("Error logging to backend:", e);
    }
  }, [error]);

  // Format error details with additional debugging information
  const [errorDetails, setErrorDetails] = useState({
    message: error?.message || "Unknown error",
    stack: error?.stack || "",
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : "Unknown",
    url: typeof window !== 'undefined' ? window.location.href : "Unknown",
    referrer: typeof document !== 'undefined' ? document.referrer : "Unknown",
  });

  const [formattedErrorText, setFormattedErrorText] = useState('');

  // Load error formatting utilities
  useEffect(() => {
    import('./utils/error-recovery').then(({ formatErrorDetails, createFormattedErrorText }) => {
      const details = formatErrorDetails(error);
      setErrorDetails(details);
      setFormattedErrorText(createFormattedErrorText(details));
    }).catch(e => {
      console.error("Failed to import error formatting utilities:", e);
      // Keep using the initial state if import fails
    });
  }, [error]);

  // Function to copy error details to clipboard with fallbacks
  const copyToClipboard = async () => {
    try {
      // Try to use the utility function first
      const { copyErrorToClipboard } = await import('./utils/error-recovery');
      const success = await copyErrorToClipboard(formattedErrorText);

      if (success) {
        setCopied(true);
        toast.success("Error details copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      } else {
        // If the utility function fails, try direct clipboard API
        await fallbackCopy();
      }
    } catch (err) {
      console.error("Failed to import clipboard utilities:", err);
      // Fallback to direct clipboard methods
      await fallbackCopy();
    }
  };

  // Fallback copy implementation
  const fallbackCopy = async () => {
    if (typeof navigator === 'undefined') return;

    try {
      // Try to use the Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formattedErrorText);
        setCopied(true);
        toast.success("Error details copied to clipboard");
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
        toast.success("Error details copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error("Failed to copy to clipboard");
      }
    } catch (err) {
      console.error("Failed to copy error details:", err);
      toast.error("Failed to copy to clipboard");
    }
  };

  // Function to perform a complete hard reset
  const handleHardReset = async () => {
    try {
      const { resetApplicationState } = await import('./utils/error-recovery');

      // Show toast to indicate reset is in progress
      toast.info("Resetting application state...");

      // Perform a complete reset with cache clearing
      await resetApplicationState({
        resetFunction: reset,
        forceReload: true,
        clearCache: true,
        preserveTheme: true
      });
    } catch (e) {
      console.error("Failed to import error recovery utilities:", e);
      toast.error("Error during reset, trying fallback method");

      // Fallback implementation if import fails
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

        // Call Next.js reset
        reset();

        // Force reload
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.reload(true);
          }
        }, 100);
      } catch (fallbackError) {
        console.error("Fallback reset also failed:", fallbackError);
        // Last resort - just reload
        if (typeof window !== 'undefined') {
          window.location.reload(true);
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full bg-card p-8 rounded-lg shadow-lg text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
        <p className="text-lg text-muted-foreground mb-8">
          We're sorry, but there was an error loading this page.
        </p>
        <div className="flex flex-col gap-4 mb-6">
          <Button
            size="lg"
            className="gap-2 w-full"
            onClick={handleHardReset}
          >
            <RefreshCw className="h-5 w-5" />
            Try again
          </Button>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="gap-2 w-full sm:w-1/2"
              onClick={async () => {
                try {
                  // Show toast to indicate reset is in progress
                  toast.info("Resetting and returning to home...");

                  const { resetApplicationState } = await import('./utils/error-recovery');
                  await resetApplicationState({
                    forceReload: true,
                    redirectUrl: '/',
                    preserveTheme: true,
                    clearCache: true
                  });
                } catch (e) {
                  console.error("Failed to import error recovery utilities:", e);
                  toast.error("Error during reset, trying fallback method");

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
              }}
            >
              <Home className="h-5 w-5" />
              Back to Home
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2 w-full sm:w-1/2"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-5 w-5" />
              Go Back
            </Button>
          </div>
        </div>

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
      </div>
    </div>
  );
}
