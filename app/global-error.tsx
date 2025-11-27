"use client";

import { Inter } from "next/font/google";
import FullPageError from "./components/ui/FullPageError";

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
  // Safely handle the error object to prevent "frame.join is not a function" errors
  let safeError: Error;
  try {
    // Ensure we have a proper Error object
    if (error && typeof error === 'object') {
      safeError = {
        name: error.name || 'Error',
        message: error.message || 'Unknown error occurred',
        stack: typeof error.stack === 'string' ? error.stack : 'No stack trace available',
        digest: error.digest
      } as Error & { digest?: string };
    } else {
      safeError = new Error('Unknown error occurred');
    }
  } catch (e) {
    // Fallback if error processing fails
    safeError = new Error('Critical error occurred during error processing');
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <FullPageError
          error={safeError}
          reset={reset}
          title="Critical Error"
          message="We're sorry, but there was a critical error loading the application."
          showGoBack={false}
        />
      </body>
    </html>
  );
}