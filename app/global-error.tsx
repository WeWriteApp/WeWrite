"use client";

import { useState, useEffect } from "react";
import { Inter } from "next/font/google";
import { Button } from "./components/ui/button";
import { RefreshCw, ChevronDown, Copy, AlertCircle } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "./components/ui/collapsible";

const inter = Inter({ subsets: ["latin"] });

// Type definitions
interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

interface ErrorDetails {
  message: string;
  stack: string;
  timestamp: string;
  userAgent: string;
  url: string;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  // Format error details with additional debugging information
  const [errorDetails, setErrorDetails] = useState<ErrorDetails>({
    message: error?.message || "Unknown error",
    stack: error?.stack || "",
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : "Unknown",
    url: typeof window !== 'undefined' ? window.location.href : "Unknown"
  });

  const [formattedErrorText, setFormattedErrorText] = useState<string>('');

  // Load error formatting utilities
  useEffect(() => {
    // Use a try-catch block since we can't use async/await in useEffect directly
    try {
      // This is a workaround for the global error handler where dynamic imports might not work reliably
      const formatDetails = {
        message: error?.message || "Unknown error",
        stack: error?.stack || "",
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : "Unknown",
        url: typeof window !== 'undefined' ? window.location.href : "Unknown"};

      const formatted = `
Error Details:
-------------
Timestamp: ${formatDetails.timestamp}
URL: ${formatDetails.url}
User Agent: ${formatDetails.userAgent}
Message: ${formatDetails.message}

Stack Trace:
${formatDetails.stack}
      `.trim();

      setErrorDetails(formatDetails);
      setFormattedErrorText(formatted);

      // Try to load the utility functions, but don't rely on them
      import('./utils/error-recovery').then(({ formatErrorDetails, createFormattedErrorText }) => {
        const details = formatErrorDetails(error);
        setErrorDetails(details);
        setFormattedErrorText(createFormattedErrorText(details));
      }).catch(e => {
        // Already set fallback values above
        console.error("Failed to import error formatting utilities in global error handler:", e);
      });
    } catch (e) {
      console.error("Error in global error formatting:", e);
    }
  }, [error]);

  // Function to copy error details to clipboard with fallbacks
  const copyToClipboard = async (): Promise<void> => {
    if (typeof navigator === 'undefined') return;

    try {
      // Try to use the Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formattedErrorText);
        setCopied(true);
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
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      console.error("Error copying to clipboard:", e);
    }
  };

  // Function to perform a complete hard reset
  const handleHardReset = async (): Promise<void> => {
    try {
      const { resetApplicationState } = await import('./utils/error-recovery');

      // Perform a complete reset with cache clearing
      await resetApplicationState({
        resetFunction: reset,
        forceReload: true,
        redirectUrl: '/', // Redirect to home page for global errors
        clearCache: true,
        preserveTheme: true
      });
    } catch (e) {
      console.error("Failed to import error recovery utilities:", e);

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

        // Redirect with cache buster
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.href = `/?_cb=${Date.now()}`;
          }
        }, 100);
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
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
          <div className="max-w-md w-full bg-card p-8 rounded-lg shadow-lg text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
            <p className="text-lg text-muted-foreground mb-8">
              We're sorry, but there was a critical error loading the application.
            </p>
            <Button
              size="lg"
              className="gap-2 w-full mb-6"
              onClick={handleHardReset}
            >
              <RefreshCw className="h-5 w-5" />
              Try again
            </Button>

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
      </body>
    </html>
  );
}